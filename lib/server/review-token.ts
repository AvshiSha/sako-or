import 'server-only'
import crypto from 'crypto'

/**
 * Signed, order-scoped tokens for the post-delivery review page.
 *
 * Mirrors the scheme already proven in `lib/server/preview-token.ts`: an HMAC-SHA256
 * over `<subject>.<expiry>`, with the expiry carried in the clear so verification
 * needs no server-side storage. Possession of a valid token IS the authorization to
 * view and submit a review for that order — there is no login step, because the link
 * is delivered to the customer by email/SMS.
 *
 * `jsonwebtoken` is available in the project but is deliberately not used here: it
 * would produce a much longer token (an issue in an SMS, where every character
 * counts) and bring claim/algorithm handling we do not need for a single subject.
 */

/** 30 days: long enough that a customer can act on the message at their leisure. */
const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000

/**
 * Bytes of HMAC retained in the token.
 *
 * 16 bytes = 128 bits, encoded as 22 base64url characters. Forging a signature means
 * finding a 128-bit preimage, which is not a practical attack; the full 32-byte digest
 * would only double the length for no reachable security gain.
 *
 * Length is not a cosmetic concern here: this link ships inside a Hebrew SMS, which is
 * UCS-2 encoded at 70 characters per segment, so every character saved is real money
 * per message — and it keeps the link clear of any length cap on the provider's
 * merge-field storage.
 */
const SIGNATURE_BYTES = 16

function getSecret(): string {
  const secret = process.env.REVIEW_TOKEN_SECRET
  if (!secret) {
    throw new Error('REVIEW_TOKEN_SECRET is not configured')
  }
  return secret
}

/** Truncated HMAC-SHA256 over the order number and expiry, base64url encoded. */
function sign(orderNumber: string, expiresAt: number): string {
  return crypto
    .createHmac('sha256', getSecret())
    .update(`${orderNumber}.${expiresAt}`)
    .digest()
    .subarray(0, SIGNATURE_BYTES)
    .toString('base64url')
}

/**
 * Mints a token authorizing review submission for exactly one order.
 *
 * Format: `<expiry-base36>.<signature-base64url>` — roughly 32 characters. The expiry
 * travels in the clear (it is covered by the signature, so it cannot be tampered with)
 * which keeps verification stateless.
 */
export function signReviewToken(
  orderNumber: string,
  ttlMs: number = DEFAULT_TTL_MS
): { token: string; expiresAt: number } {
  const expiresAt = Date.now() + ttlMs
  return {
    token: `${expiresAt.toString(36)}.${sign(orderNumber, expiresAt)}`,
    expiresAt,
  }
}

/**
 * Verifies a token against the order it claims to authorize.
 *
 * The order number is part of the signed payload, so a token minted for order A can
 * never validate against order B even though both are signed with the same secret.
 */
export function verifyReviewToken(
  orderNumber: string,
  token: string | null | undefined
): boolean {
  if (!token) return false

  const [expiresAtRaw, signature] = token.split('.')
  if (!expiresAtRaw || !signature) return false

  const expiresAt = parseInt(expiresAtRaw, 36)
  if (!Number.isFinite(expiresAt) || expiresAt <= 0 || expiresAt < Date.now()) return false

  const expected = Buffer.from(sign(orderNumber, expiresAt), 'base64url')
  const actual = Buffer.from(signature, 'base64url')
  if (expected.length !== actual.length) return false

  return crypto.timingSafeEqual(expected, actual)
}

/** Absolute site origin, without a trailing slash. */
export function getSiteOrigin(): string {
  const raw =
    process.env.NEXT_PUBLIC_BASE_URL ??
    process.env.APP_BASE_URL ??
    'https://www.sako-or.com'
  return raw.replace(/\/+$/, '')
}

/**
 * Builds the customer-facing review URL for an order.
 *
 * Note the path shape: `/review/<lng>/...`, NOT `/<lng>/review/...`. The page lives
 * outside the `[lng]` route segment so it does not inherit that layout's header and
 * footer — the review link is a one-off destination from an SMS, and the site chrome
 * is a distraction with nowhere useful to go. `review` is registered in middleware's
 * UNLOCALIZED_ROUTES so it is not redirected to a locale-prefixed path.
 */
export function buildReviewUrl(params: {
  orderNumber: string
  language: 'he' | 'en'
  ttlMs?: number
}): string {
  const { token } = signReviewToken(params.orderNumber, params.ttlMs)
  const encodedOrder = encodeURIComponent(params.orderNumber)

  return `${getSiteOrigin()}/review/${params.language}/order/${encodedOrder}?token=${token}`
}

/**
 * Loyalty-club signup URL for customers who are not yet members.
 *
 * `returnTo` is a same-origin path the signup flow sends the customer back to once
 * registration completes — used to return them to the exact review they came from,
 * with their draft intact, rather than dumping them on /profile.
 *
 * The value is encoded, and the signup page validates it again with
 * `sanitizeRedirect` before acting on it. It is not validated here because callers
 * pass paths we construct ourselves; the guard lives at the point of use, where an
 * untrusted value could actually arrive.
 */
export function buildSignupUrl(language: 'he' | 'en', returnTo?: string): string {
  const base = `${getSiteOrigin()}/${language}/signup`
  if (!returnTo) return base
  return `${base}?redirect=${encodeURIComponent(returnTo)}`
}

/**
 * The review page's path (no origin), suitable for use as a `redirect` target.
 *
 * Mints a fresh token, so a customer returning from signup gets a link with a full
 * 30-day window rather than whatever remained of the original.
 */
export function buildReviewPath(params: {
  orderNumber: string
  language: 'he' | 'en'
  token?: string
}): string {
  const token = params.token ?? signReviewToken(params.orderNumber).token
  return `/review/${params.language}/order/${encodeURIComponent(params.orderNumber)}?token=${token}`
}
