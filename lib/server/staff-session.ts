import 'server-only'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { adminAuth } from '@/lib/firebase-admin'
import { normalizeEmail } from '@/lib/admin'
import { ADMIN_SESSION_COOKIE } from '@/lib/admin-session'
import { verifyAdminSessionCookie } from '@/lib/server/admin-session'
import { STAFF_SESSION_COOKIE, STAFF_SESSION_TTL_MS } from '@/lib/staff-session'
import { resolveStaffAccess, type StaffRole } from '@/lib/server/staff'

export type StaffSession = {
  uid: string
  email: string | null
  role: StaffRole
  expiresAt: number
}

/**
 * Mints a Firebase session cookie from a freshly obtained ID token.
 *
 * Firebase requires the ID token to be under 5 minutes old; the login route
 * passes one that is seconds old, straight back from the browser sign-in.
 */
export async function mintStaffSessionCookie(idToken: string): Promise<string> {
  return adminAuth.createSessionCookie(idToken, { expiresIn: STAFF_SESSION_TTL_MS })
}

export function staffSessionCookieOptions() {
  return {
    httpOnly: true as const,
    // Hardcoded rather than NODE_ENV-conditional: `__Host-` requires Secure,
    // and the browsers that matter exempt localhost from the Secure rule.
    secure: true as const,
    // The staff surface has no third-party return navigation of its own, but
    // 'lax' matches the admin cookie and still withholds the cookie from
    // cross-site POST, which is where CSRF lives.
    sameSite: 'lax' as const,
    path: '/' as const,
    maxAge: Math.floor(STAFF_SESSION_TTL_MS / 1000),
  }
}

export function clearedStaffSessionCookieOptions() {
  return { ...staffSessionCookieOptions(), maxAge: 0 }
}

/**
 * Verifies a staff session cookie and re-confirms warehouse access.
 *
 * `checkRevoked: true`, matching the admin cookie path: it costs one round trip
 * to Google, and it is the only thing that makes `revokeRefreshTokens` in the
 * sign-out route mean anything. On a shared device that is the mechanism for
 * cutting off a lost iPad, so it is not optional here.
 *
 * Access is re-resolved on every verification rather than trusted from the
 * cookie, so demoting the account takes effect on the next request.
 */
export async function verifyStaffSessionCookie(cookie: string): Promise<StaffSession | null> {
  try {
    const decoded = await adminAuth.verifySessionCookie(cookie, true)
    const email = normalizeEmail(decoded.email ?? null)
    const role = await resolveStaffAccess(email, decoded.uid)
    if (!role) return null

    return { uid: decoded.uid, email, role, expiresAt: decoded.exp * 1000 }
  } catch {
    // Expired, revoked, malformed or forged -- all the same answer.
    return null
  }
}

/**
 * The staff session for the current request, or null.
 *
 * Falls back to the ADMIN session cookie when there is no staff cookie. Without
 * this, an admin already signed into `/admin` would be bounced to a second
 * login to look at stock, which is the kind of friction that gets solved by
 * sharing the warehouse password. There is precedent: `requireAdminSession` in
 * `lib/server/auth.ts` already accepts either of two credentials for the same
 * sort of reason.
 *
 * Wrapped in React `cache()` so a layout and the components beneath it share
 * one verification round trip per render pass.
 */
export const readStaffSession = cache(async (): Promise<StaffSession | null> => {
  const store = await cookies()

  const staffCookie = store.get(STAFF_SESSION_COOKIE)?.value
  if (staffCookie) {
    const session = await verifyStaffSessionCookie(staffCookie)
    if (session) return session
  }

  const adminCookie = store.get(ADMIN_SESSION_COOKIE)?.value
  if (adminCookie) {
    const adminSession = await verifyAdminSessionCookie(adminCookie)
    if (adminSession) {
      return {
        uid: adminSession.uid,
        email: adminSession.email,
        role: 'ADMIN',
        expiresAt: adminSession.expiresAt,
      }
    }
  }

  return null
})
