import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import * as Sentry from '@sentry/nextjs'
import { languages } from '@/i18n/settings'
import {
  categoryKeysForGender,
  otherGenderWithCategory,
  resolveCategory,
  resolveColorSlugs,
  resolveGender,
  resolveSizes,
} from '@/lib/chatbase/collection-catalog'
import { checkCollectionAvailability } from '@/lib/chatbase/collection-availability'

/**
 * POST /api/chatbase/check-collection
 *
 * Answers one question for the Chatbase agent: if I send this collection link,
 * will the customer land on a page with products on it? The agent must call
 * this BEFORE offering any collection URL, and send the `url` this route
 * returns rather than assembling one itself.
 *
 * Regular collection first, the parallel outlet collection second, `none`
 * third. Availability is counted from the live product data through the exact
 * function the collection page uses, so the count equals what renders - a
 * product only counts when it is enabled, not deleted, in the requested
 * category, has an active colour variant in the requested colour, and has
 * stock in the requested size on that same variant.
 *
 * Read-only: it writes nothing and touches no customer data.
 *
 * A 4xx or 5xx from this route means "unknown" and never "unavailable". The
 * agent must not send a collection link when the check does not return 200.
 */

// Firestore client SDK plus node:crypto - not edge-safe.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Guards against a runaway filter list; the UI never sends more than a handful. */
const MAX_FILTER_VALUES = 10

/** The storefront's default locale (see DEFAULT_LOCALE in middleware.ts). */
const DEFAULT_LOCALE = 'he'

function secretMatches(provided: string, expected: string): boolean {
  const providedBytes = Buffer.from(provided, 'utf8')
  const expectedBytes = Buffer.from(expected, 'utf8')
  if (providedBytes.length !== expectedBytes.length) return false
  return timingSafeEqual(providedBytes, expectedBytes)
}

/**
 * Chatbase substitutes `{{color}}` in the action body with whatever the agent
 * collected. When it collected nothing, some versions send the placeholder
 * through verbatim instead of an empty string. Left alone, `{{color}}` would
 * resolve to a colour slug that matches no product, and the customer would be
 * told we have nothing - a false "unavailable" is the one answer this endpoint
 * exists to prevent, so an unsubstituted placeholder means "not provided".
 */
function isUnresolvedTemplate(value: string): boolean {
  return /^\{\{.*\}\}$/.test(value.trim())
}

/** Accepts a string, a comma-separated string, or an array of either. */
function toStringArray(value: unknown): string[] {
  if (value === undefined || value === null) return []
  const raw = Array.isArray(value) ? value : [value]
  return raw
    .flatMap((entry) => {
      if (typeof entry === 'number') return [String(entry)]
      if (typeof entry !== 'string') return []
      if (isUnresolvedTemplate(entry)) return []
      return entry.split(',')
    })
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, MAX_FILTER_VALUES)
}

function resolveLocale(value: unknown): string {
  if (typeof value !== 'string' || isUnresolvedTemplate(value)) return DEFAULT_LOCALE
  const normalized = value.trim().toLowerCase()
  return (languages as readonly string[]).includes(normalized) ? normalized : DEFAULT_LOCALE
}

export async function POST(request: NextRequest) {
  const expectedSecret = process.env.CHATBASE_API_SECRET

  if (!expectedSecret) {
    // Fail closed: an unset secret must never mean "open to everyone".
    console.error('[CHATBASE_CHECK_COLLECTION] CHATBASE_API_SECRET is not set')
    return NextResponse.json({ error: 'endpoint_not_configured' }, { status: 500 })
  }

  const providedSecret =
    request.headers.get('x-chatbase-secret') ||
    request.headers.get('authorization')?.replace(/^Bearer /i, '') ||
    ''

  if (!providedSecret || !secretMatches(providedSecret, expectedSecret)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const payload = body as Record<string, unknown>

  const rawCategory =
    typeof payload.category === 'string' && !isUnresolvedTemplate(payload.category)
      ? payload.category.trim()
      : ''
  if (!rawCategory) {
    const gender = resolveGender(payload.gender)
    return NextResponse.json(
      {
        error: 'missing_category',
        gender,
        validCategories: categoryKeysForGender(gender),
      },
      { status: 400 }
    )
  }

  const gender = resolveGender(payload.gender)
  const locale = resolveLocale(payload.locale)
  const category = resolveCategory(rawCategory, gender)

  if (!category) {
    return NextResponse.json(
      {
        error: 'unknown_category',
        category: rawCategory,
        gender,
        validCategories: categoryKeysForGender(gender),
        // The agent retries with the right gender; we never switch for it,
        // because sending a man to the women's collection is worse than asking.
        availableInGender: otherGenderWithCategory(rawCategory, gender),
      },
      { status: 400 }
    )
  }

  const colors = resolveColorSlugs([
    ...toStringArray(payload.color),
    ...toStringArray(payload.colors),
  ])
  const sizes = resolveSizes([...toStringArray(payload.size), ...toStringArray(payload.sizes)])

  try {
    const result = await checkCollectionAvailability({
      category,
      gender,
      locale,
      colors,
      sizes,
    })
    return NextResponse.json(result, {
      // Stock moves on a Verifone sync; a cached "available" would outlive it.
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    Sentry.captureException(error)
    console.error('[CHATBASE_CHECK_COLLECTION] Availability check failed:', error)
    return NextResponse.json({ error: 'availability_check_failed' }, { status: 500 })
  }
}
