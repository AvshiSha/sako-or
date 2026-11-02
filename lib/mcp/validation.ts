import { z } from 'zod'

import {
  CONTENT_MEDIA_PREFIX,
  INLINE_HTML_FIELDS,
  RICH_HTML_FIELDS,
  STORAGE_HOST,
  isLocalizedField,
} from '@/lib/mcp/field-allowlist'
import { cmsHtmlToPlainText } from '@/lib/cms-html-cleanup'
import { sanitizeCmsHtml, stripInlineBlockWrapper } from '@/lib/sanitize-html'
import {
  META_DESCRIPTION_RANGE,
  SEO_TITLE_RANGE,
  getRenderedTitleLength,
} from '@/lib/seo-length'

/**
 * Server-side validation for every MCP tool call.
 *
 * Deliberately written against the app's zod 3, not the zod 4 the MCP SDK uses
 * for tool declarations. Those declarations are a hint to the model about what
 * to send; this is the check that decides what the server accepts. Keeping them
 * in different libraries makes it structurally impossible to confuse the two.
 */

export class McpValidationError extends Error {
  constructor(
    readonly code: McpErrorCode,
    readonly errors: string[]
  ) {
    super(errors[0] ?? code)
    this.name = 'McpValidationError'
  }
}

export type McpErrorCode =
  | 'INVALID_REQUEST'
  | 'FORBIDDEN_FIELD'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'FORBIDDEN'
  | 'UNAUTHORIZED'
  | 'VALIDATION_FAILED'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'

export function invalid(code: McpErrorCode, ...errors: string[]): never {
  throw new McpValidationError(code, errors)
}

/**
 * Reject any key outside the allowlist.
 *
 * Fails the whole call rather than stripping the offending key. A caller that
 * sends `status: 'published'` to update_blog_content has misunderstood what the
 * tool does, and the useful answer is to say so -- not to apply the other eight
 * fields and leave it believing the article went live.
 *
 * The error names the rejected keys and the permitted ones, because the client
 * is a language model and a list it can read is the difference between a
 * corrected retry and five identical failures.
 */
export function rejectUnknownFields(
  payload: Record<string, unknown>,
  allowed: readonly string[],
  context: string
): void {
  const rejected = Object.keys(payload).filter((key) => !allowed.includes(key))
  if (rejected.length === 0) return

  invalid(
    'FORBIDDEN_FIELD',
    `${context}: the field(s) ${rejected.map((k) => `"${k}"`).join(', ')} cannot be set ` +
      `through this integration. Writable fields are: ${allowed.join(', ')}.`
  )
}

/** A {he, en} pair. Both halves optional so a caller can fill one language at a time. */
const localizedSchema = z
  .object({
    he: z.string().max(100_000).optional(),
    en: z.string().max(100_000).optional(),
  })
  .strict()
  .refine((value) => value.he !== undefined || value.en !== undefined, {
    message: 'Provide at least one of "he" or "en".',
  })

export type LocalizedInput = z.infer<typeof localizedSchema>

/**
 * Slugs are lowercase ASCII, which is what the public URL uses and what the
 * admin form already enforces.
 *
 * This matters more here than it looks. The admin form derives a slug from the
 * *English* title through `slugify`, which strips anything outside \w -- so a
 * Hebrew-only title produces an empty slug. The form then saves it and the
 * article lands at /he/news/. An MCP caller importing Hebrew articles would hit
 * that on the first article of the day, so an empty or non-conforming slug is
 * refused here with an explanation rather than accepted.
 */
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function validateSlug(slug: unknown): string {
  if (typeof slug !== 'string' || !slug.trim()) {
    invalid(
      'INVALID_REQUEST',
      'slug is required and must be a lowercase latin-letter URL segment, e.g. "winter-boots-guide". ' +
        'A Hebrew title cannot be transliterated automatically — supply the slug explicitly.'
    )
  }
  const trimmed = slug.trim()
  if (!SLUG_RE.test(trimmed)) {
    invalid(
      'INVALID_REQUEST',
      `slug "${trimmed}" is invalid. Use lowercase a-z, digits and single hyphens between words, ` +
        'with no leading, trailing or repeated hyphens, and no Hebrew or other non-latin characters.'
    )
  }
  if (trimmed.length > 80) {
    invalid('INVALID_REQUEST', `slug is ${trimmed.length} characters; the maximum is 80.`)
  }
  return trimmed
}

/**
 * A URL pointing at media this integration uploaded.
 *
 * Restricted to the Firebase Storage download host and the content-media
 * prefix. Both halves are required: the host check stops a field being used to
 * reference an arbitrary external image (which would also be a privacy leak on
 * the storefront), and the prefix check stops it referencing a product photo or
 * anything else an admin uploaded.
 *
 * Storage download URLs percent-encode the object path, so the prefix is
 * checked against the decoded `o/...` segment rather than the raw string.
 */
export function validateContentMediaUrl(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    invalid('INVALID_REQUEST', `${field} must be a non-empty URL.`)
  }
  const raw = value.trim()

  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    invalid('INVALID_REQUEST', `${field} is not a valid URL.`)
  }

  if (parsed.protocol !== 'https:') {
    invalid('INVALID_REQUEST', `${field} must be an https URL.`)
  }
  if (parsed.hostname !== STORAGE_HOST) {
    invalid(
      'INVALID_REQUEST',
      `${field} must reference an image uploaded through upload_article_image. ` +
        `Host "${parsed.hostname}" is not allowed; expected ${STORAGE_HOST}.`
    )
  }

  const objectSegment = parsed.pathname.split('/o/')[1]
  if (!objectSegment) {
    invalid('INVALID_REQUEST', `${field} is not a Firebase Storage object URL.`)
  }
  let objectPath: string
  try {
    objectPath = decodeURIComponent(objectSegment)
  } catch {
    invalid('INVALID_REQUEST', `${field} has an undecodable object path.`)
  }

  if (!objectPath.startsWith(CONTENT_MEDIA_PREFIX)) {
    invalid(
      'INVALID_REQUEST',
      `${field} must point inside ${CONTENT_MEDIA_PREFIX}. ` +
        'Upload the image with upload_article_image first and use the URL it returns.'
    )
  }

  return raw
}

/**
 * Canonical URLs may only point at our own site or be cleared.
 *
 * The admin form accepts free text here, which means a typo can de-index an
 * article by canonicalising it to someone else's page. The MCP path does not
 * inherit that: an absolute URL must be on the configured site host, and a
 * relative path must start with a single slash.
 */
export function validateCanonicalUrl(value: unknown, siteUrl: string): string {
  if (value === '' || value === null) return ''
  if (typeof value !== 'string') {
    invalid('INVALID_REQUEST', 'canonicalUrl must be a string, or "" to clear it.')
  }
  const raw = value.trim()
  if (!raw) return ''

  if (raw.startsWith('/')) {
    if (raw.startsWith('//')) {
      invalid('INVALID_REQUEST', 'canonicalUrl must not start with "//" — that is a protocol-relative external URL.')
    }
    return raw
  }

  let parsed: URL
  let expected: URL
  try {
    parsed = new URL(raw)
    expected = new URL(siteUrl)
  } catch {
    invalid('INVALID_REQUEST', `canonicalUrl "${raw}" is not a valid URL or site-relative path.`)
  }
  if (parsed.hostname !== expected.hostname) {
    invalid(
      'INVALID_REQUEST',
      `canonicalUrl must stay on ${expected.hostname}; "${parsed.hostname}" would point search engines off-site.`
    )
  }
  return raw
}

/**
 * Sanitize one localized field according to what it is rendered as.
 *
 * This runs on *input*, before the write. The storefront sanitizes again on
 * output (RichContent -> sanitizeCmsHtml), but relying on that alone is what
 * leaves raw model-generated HTML sitting in Firestore for everything else that
 * reads the collection -- the same reasoning as lib/server/faq-mutations.ts.
 *
 * Returns the sanitized pair plus any notes worth telling the caller, so a
 * stripped script tag is visible rather than silent.
 */
export function sanitizeLocalizedField(
  field: string,
  value: LocalizedInput
): { he: string; en: string; warnings: string[] } {
  const warnings: string[] = []

  const apply = (raw: string | undefined, locale: 'he' | 'en'): string => {
    const input = raw ?? ''
    if (!input) return ''

    let output: string
    if ((RICH_HTML_FIELDS as readonly string[]).includes(field)) {
      output = sanitizeCmsHtml(input)
    } else if ((INLINE_HTML_FIELDS as readonly string[]).includes(field)) {
      output = stripInlineBlockWrapper(input)
    } else {
      // Excerpts and meta fields are rendered as text attributes; markup in
      // them would be escaped into visible angle brackets in a <meta> tag.
      output = cmsHtmlToPlainText(input)
    }

    if (hadStrippedMarkup(input, output)) {
      warnings.push(
        `${field}.${locale}: disallowed markup was removed. Allowed in article bodies: ` +
          'paragraphs, h2/h3, lists, links, images, tables, blockquote and YouTube embeds.'
      )
    }
    return output
  }

  return { he: apply(value.he, 'he'), en: apply(value.en, 'en'), warnings }
}

/**
 * True when sanitizing removed something structural.
 *
 * Compares tag inventories rather than string length, because the sanitizer
 * also rewrites attributes (adding rel="noopener", loading="lazy") and a naive
 * length comparison reports a warning on every single link.
 */
function hadStrippedMarkup(input: string, output: string): boolean {
  const tags = (html: string): Set<string> => {
    const found = new Set<string>()
    for (const match of html.matchAll(/<\s*([a-zA-Z][a-zA-Z0-9]*)/g)) {
      found.add(match[1].toLowerCase())
    }
    return found
  }
  const before = tags(input)
  const after = tags(output)
  for (const tag of before) {
    if (!after.has(tag)) return true
  }
  // An inline-only field legitimately loses its <p> wrapper.
  return false
}

/** Non-blocking SEO length advice, reported as warnings rather than refusals. */
export function seoLengthWarnings(fields: {
  seoTitle?: { he: string; en: string }
  seoDescription?: { he: string; en: string }
}): string[] {
  const warnings: string[] = []

  for (const locale of ['he', 'en'] as const) {
    const title = fields.seoTitle?.[locale]
    if (title) {
      const rendered = getRenderedTitleLength(title)
      if (rendered > SEO_TITLE_RANGE.max) {
        warnings.push(
          `seoTitle.${locale} renders as ${rendered} characters including the " | SAKO-OR" suffix; ` +
            `Google truncates past about ${SEO_TITLE_RANGE.max}.`
        )
      }
    }
    const description = fields.seoDescription?.[locale]
    if (description && description.length > META_DESCRIPTION_RANGE.max) {
      warnings.push(
        `seoDescription.${locale} is ${description.length} characters; ` +
          `Google truncates past about ${META_DESCRIPTION_RANGE.max}.`
      )
    }
  }

  return warnings
}

/**
 * Parse and sanitize a partial field payload for either content type.
 *
 * The order is load-bearing: allowlist first, then shape, then sanitize. A
 * forbidden field must be rejected before anything looks at its value, so a
 * malformed forbidden field reports "you may not set this" rather than a shape
 * complaint that implies it would be accepted if formatted correctly.
 */
export function parseFieldPayload(
  payload: Record<string, unknown>,
  allowed: readonly string[],
  context: string,
  siteUrl: string
): { fields: Record<string, unknown>; warnings: string[] } {
  rejectUnknownFields(payload, allowed, context)

  const fields: Record<string, unknown> = {}
  const warnings: string[] = []
  const errors: string[] = []

  for (const [key, raw] of Object.entries(payload)) {
    if (raw === undefined) continue

    if (isLocalizedField(key)) {
      const parsed = localizedSchema.safeParse(raw)
      if (!parsed.success) {
        errors.push(
          `${key} must be an object like { "he": "...", "en": "..." } with at least one language: ` +
            parsed.error.issues.map((i) => i.message).join('; ')
        )
        continue
      }
      const sanitized = sanitizeLocalizedField(key, parsed.data)
      warnings.push(...sanitized.warnings)
      fields[key] = { he: sanitized.he, en: sanitized.en }
      continue
    }

    switch (key) {
      case 'slug':
        fields.slug = validateSlug(raw)
        break
      case 'featuredImage':
      case 'ogImage':
      case 'image':
        fields[key] = validateContentMediaUrl(raw, key)
        break
      case 'canonicalUrl':
        fields.canonicalUrl = validateCanonicalUrl(raw, siteUrl)
        break
      default:
        // Unreachable while allowlist and this switch agree; asserted by a test.
        errors.push(`${key} is allowlisted but has no validator. This is a server bug.`)
    }
  }

  if (errors.length > 0) {
    throw new McpValidationError('VALIDATION_FAILED', errors)
  }

  warnings.push(
    ...seoLengthWarnings({
      seoTitle: fields.seoTitle as { he: string; en: string } | undefined,
      seoDescription: fields.seoDescription as { he: string; en: string } | undefined,
    })
  )

  return { fields, warnings }
}

/**
 * Everything an article needs before it may be scheduled.
 *
 * Checked at schedule time rather than at create time: a draft is allowed to be
 * incomplete -- that is what a draft is -- but nothing incomplete may be queued
 * to go live unattended, because by then there is no human in the loop to
 * notice a missing meta description.
 */
export function validateReadyToPublish(article: {
  slug?: string
  title?: { he?: string; en?: string }
  excerpt?: { he?: string; en?: string }
  content?: { he?: string; en?: string }
  featuredImage?: string
  featuredImageAlt?: { he?: string; en?: string }
  seoTitle?: { he?: string; en?: string }
  seoDescription?: { he?: string; en?: string }
}): string[] {
  const missing: string[] = []
  const bothLocales = (value?: { he?: string; en?: string }): boolean =>
    Boolean(value?.he?.trim()) && Boolean(value?.en?.trim())
  const eitherLocale = (value?: { he?: string; en?: string }): boolean =>
    Boolean(value?.he?.trim()) || Boolean(value?.en?.trim())

  if (!article.slug?.trim()) missing.push('slug is empty.')
  if (!eitherLocale(article.title)) missing.push('title is empty in both languages.')
  if (!eitherLocale(article.excerpt)) missing.push('excerpt is empty in both languages.')
  if (!eitherLocale(article.content)) missing.push('content is empty in both languages.')

  if (!article.featuredImage?.trim()) {
    missing.push('featuredImage is not set. Upload one with upload_article_image.')
  } else if (!bothLocales(article.featuredImageAlt)) {
    // Alt text in both languages, because the storefront renders whichever
    // locale the visitor is on and a missing alt is an accessibility defect on
    // a page we are publishing specifically to be found.
    missing.push('featuredImageAlt is required in both Hebrew and English.')
  }

  if (!eitherLocale(article.seoTitle)) {
    missing.push('seoTitle is empty. Without it the <title> falls back to the article title.')
  }
  if (!eitherLocale(article.seoDescription)) {
    missing.push('seoDescription is empty. Without it the meta description falls back to the excerpt.')
  }

  return missing
}

export const scheduleInputSchema = z
  .object({
    id: z.string().min(1).max(200),
    publishAt: z.string().min(1).max(64),
  })
  .strict()
