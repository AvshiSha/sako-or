/**
 * Staff session constants.
 *
 * This module must import NOTHING. It is pulled into `middleware.ts`, which
 * runs on the Edge runtime, so a transitive `firebase-admin`, `prisma` or
 * `server-only` import here fails the Edge bundle at build time. The server
 * half is `lib/server/staff-session.ts`. Same rule, and same reason, as
 * `lib/admin-session.ts`.
 */

/**
 * `__Host-` requires Secure, Path=/ and no Domain, and in exchange the cookie
 * cannot be set or overwritten by a subdomain.
 *
 * The name is env-switched for the same reason as the admin cookie: Safari
 * rejects Secure cookies on http://localhost, which would make local
 * development on Safari impossible with a fixed `__Host-` name.
 */
export const STAFF_SESSION_COOKIE =
  process.env.NODE_ENV === 'production' ? '__Host-sako_staff' : 'sako_staff_dev'

/**
 * 7 days.
 *
 * Longer than the admin panel's 12 hours, deliberately. That value is "one
 * working day, then re-authenticate", which suits one person at their own desk.
 * This is a shared iPad on a warehouse floor: a session that expires mid-shift
 * means someone stops picking and goes to find whoever knows the password, and
 * the predictable result is the password ending up written on the device. A
 * week keeps re-authentication to a routine weekly event.
 *
 * Still well inside the 14-day ceiling `createSessionCookie` enforces, which
 * `lib/__tests__/staff-session.test.ts` asserts so the two cannot drift.
 *
 * The trade is accepted knowingly: a lost iPad has a usable warehouse session
 * for up to a week. What that session can do is bounded -- read stock, read
 * locations -- because every write needs the manager PIN on top. Revoking it is
 * `adminAuth.revokeRefreshTokens` on the shared account, which the sign-out
 * route already does and which `verifyStaffSessionCookie` honours immediately
 * via `checkRevoked`.
 */
export const STAFF_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Machine-readable login outcomes. The client maps these to Hebrew copy in
 * `lib/staff/messages.ts`; the strings themselves say nothing about which half
 * of the credential was wrong.
 */
export const STAFF_LOGIN_ERROR_CODES = {
  INVALID_REQUEST: 'INVALID_REQUEST',
  TURNSTILE_FAILED: 'TURNSTILE_FAILED',
  TOO_MANY_ATTEMPTS: 'TOO_MANY_ATTEMPTS',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  NO_STAFF_ACCESS: 'NO_STAFF_ACCESS',
  ACCOUNT_DISABLED: 'ACCOUNT_DISABLED',
  LOGIN_FAILED: 'LOGIN_FAILED',
} as const

export type StaffLoginErrorCode =
  (typeof STAFF_LOGIN_ERROR_CODES)[keyof typeof STAFF_LOGIN_ERROR_CODES]

/** Error codes the staff API returns for a location edit. */
export const STAFF_EDIT_ERROR_CODES = {
  /** PIN wrong, or no grant, or a grant that does not fit this edit. */
  FORBIDDEN: 'FORBIDDEN',
  /** Grant expired or already spent -- ask for the PIN again. */
  GRANT_EXPIRED: 'GRANT_EXPIRED',
  /** Too many wrong PINs. */
  PIN_LOCKED: 'PIN_LOCKED',
  /** No PIN configured in this environment. */
  PIN_NOT_CONFIGURED: 'PIN_NOT_CONFIGURED',
  /** A PIN is configured, but it is one published in this repository. */
  PIN_INSECURE: 'PIN_INSECURE',
  /** A newer location exists; nothing was overwritten. */
  CONFLICT: 'CONFLICT',
  /** Room, route or drawer outside the configured warehouse. */
  INVALID_LOCATION: 'INVALID_LOCATION',
  INVALID_REQUEST: 'INVALID_REQUEST',
  SAVE_FAILED: 'SAVE_FAILED',
} as const

export type StaffEditErrorCode =
  (typeof STAFF_EDIT_ERROR_CODES)[keyof typeof STAFF_EDIT_ERROR_CODES]
