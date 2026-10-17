import 'server-only'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { adminAuth } from '@/lib/firebase-admin'
import { normalizeEmail } from '@/lib/admin'
import { resolveIsAdmin } from '@/lib/server/admin'
import { ADMIN_SESSION_COOKIE, ADMIN_SESSION_TTL_MS } from '@/lib/admin-session'

export type AdminSession = {
  uid: string
  email: string | null
  expiresAt: number
}

/**
 * Mints a Firebase session cookie from a freshly obtained ID token.
 *
 * Firebase requires the ID token to be under 5 minutes old; ours is seconds
 * old — it comes straight back from the sign-in call in the same request.
 */
export async function mintAdminSessionCookie(idToken: string): Promise<string> {
  return adminAuth.createSessionCookie(idToken, { expiresIn: ADMIN_SESSION_TTL_MS })
}

export function adminSessionCookieOptions() {
  return {
    httpOnly: true as const,
    // Hardcoded rather than NODE_ENV-conditional: `__Host-` requires Secure,
    // and the browsers that matter exempt localhost from the Secure rule.
    secure: true as const,
    // 'lax' not 'strict'. Strict would break /api/google-drive/callback, which
    // is a top-level navigation back from Google. Lax still withholds the
    // cookie from cross-site POST, which is where CSRF lives.
    sameSite: 'lax' as const,
    path: '/' as const,
    maxAge: Math.floor(ADMIN_SESSION_TTL_MS / 1000),
  }
}

export function clearedAdminSessionCookieOptions() {
  return { ...adminSessionCookieOptions(), maxAge: 0 }
}

/**
 * Verifies a session cookie and re-confirms admin status. Null on any failure.
 *
 * `checkRevoked: true` costs one extra round trip to Google per admin page
 * navigation, which is irrelevant at this traffic volume and is the only thing
 * that makes `revokeRefreshTokens` in the logout route mean anything. The
 * bearer-token path in `lib/server/auth.ts` deliberately stays at false — it
 * serves storefront traffic and changing it is an unrelated performance call.
 *
 * Admin status is re-resolved on every verification rather than trusted from
 * the cookie, so revoking someone's role takes effect on their next request
 * instead of when their session happens to expire.
 */
export async function verifyAdminSessionCookie(cookie: string): Promise<AdminSession | null> {
  try {
    const decoded = await adminAuth.verifySessionCookie(cookie, true)
    const email = normalizeEmail(decoded.email ?? null)
    const isAdmin = await resolveIsAdmin(email, decoded.uid)
    if (!isAdmin) return null

    return { uid: decoded.uid, email, expiresAt: decoded.exp * 1000 }
  } catch {
    // Expired, revoked, malformed or forged — all the same answer.
    return null
  }
}

/**
 * The session for the current request, or null.
 *
 * Wrapped in React `cache()` so a layout and any server components rendered
 * beneath it in the same pass share one `verifySessionCookie` round trip.
 */
export const readAdminSession = cache(async (): Promise<AdminSession | null> => {
  const store = await cookies()
  const cookie = store.get(ADMIN_SESSION_COOKIE)?.value
  if (!cookie) return null
  return verifyAdminSessionCookie(cookie)
})
