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

function getSecret(): string {
  const secret = process.env.REVIEW_TOKEN_SECRET
  if (!secret) {
    throw new Error('REVIEW_TOKEN_SECRET is not configured')
  }
  return secret
}

function sign(orderNumber: string, expiresAt: number): string {
  return crypto
    .createHmac('sha256', getSecret())
    .update(`${orderNumber}.${expiresAt}`)
    .digest('hex')
}

/** Mints a token authorizing review submission for exactly one order. */
export function signReviewToken(
  orderNumber: string,
  ttlMs: number = DEFAULT_TTL_MS
): { token: string; expiresAt: number } {
  const expiresAt = Date.now() + ttlMs
  return { token: `${expiresAt}.${sign(orderNumber, expiresAt)}`, expiresAt }
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

  const expiresAt = Number(expiresAtRaw)
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false

  const expected = Buffer.from(sign(orderNumber, expiresAt), 'hex')
  const actual = Buffer.from(signature, 'hex')
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

/** Builds the customer-facing review URL for an order. */
export function buildReviewUrl(params: {
  orderNumber: string
  language: 'he' | 'en'
  ttlMs?: number
}): string {
  const { token } = signReviewToken(params.orderNumber, params.ttlMs)
  const encodedOrder = encodeURIComponent(params.orderNumber)

  return `${getSiteOrigin()}/${params.language}/review/order/${encodedOrder}?token=${token}`
}

/** Loyalty-club signup URL included for customers who are not yet members. */
export function buildSignupUrl(language: 'he' | 'en'): string {
  return `${getSiteOrigin()}/${language}/signup`
}
