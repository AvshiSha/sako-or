/**
 * Admin session constants.
 *
 * This module must import NOTHING. It is pulled into `middleware.ts`, which
 * runs on the Edge runtime, so a transitive `firebase-admin`, `prisma` or
 * `server-only` import here fails the Edge bundle at build time. The server
 * half is `lib/server/admin-session.ts`.
 */

/**
 * `__Host-` requires Secure, Path=/ and no Domain — all of which we want
 * anyway — and in exchange the cookie cannot be set or overwritten by a
 * subdomain. That matters here because the apex has other subdomains.
 *
 * The name is env-switched because Safari rejects Secure cookies on
 * http://localhost (Chrome and Firefox allow them), which would make local
 * admin development impossible on Safari with a fixed `__Host-` name.
 */
export const ADMIN_SESSION_COOKIE =
  process.env.NODE_ENV === 'production' ? '__Host-sako_admin' : 'sako_admin_dev'

/**
 * 12 hours — one working day, then re-authenticate. Firebase's
 * `createSessionCookie` accepts 5 minutes to 14 days; this stays well inside
 * that. There is no sliding refresh: it would need a refresh endpoint and a
 * renewal race for very little benefit on an admin panel.
 */
export const ADMIN_SESSION_TTL_MS = 12 * 60 * 60 * 1000

/** Firebase's hard ceiling, asserted in tests so the TTL can never drift past it. */
export const FIREBASE_SESSION_COOKIE_MAX_TTL_MS = 14 * 24 * 60 * 60 * 1000

/**
 * Machine-readable login outcomes. The client maps these to copy; the strings
 * themselves are deliberately uninformative about which half of the credential
 * was wrong.
 */
export const ADMIN_LOGIN_ERROR_CODES = {
  INVALID_REQUEST: 'INVALID_REQUEST',
  TURNSTILE_FAILED: 'TURNSTILE_FAILED',
  TOO_MANY_ATTEMPTS: 'TOO_MANY_ATTEMPTS',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  ACCOUNT_DISABLED: 'ACCOUNT_DISABLED',
  UPSTREAM_THROTTLED: 'UPSTREAM_THROTTLED',
  LOGIN_FAILED: 'LOGIN_FAILED',
} as const

export type AdminLoginErrorCode =
  (typeof ADMIN_LOGIN_ERROR_CODES)[keyof typeof ADMIN_LOGIN_ERROR_CODES]
