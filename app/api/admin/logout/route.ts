import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { adminAuth } from '@/lib/firebase-admin'
import { ADMIN_SESSION_COOKIE } from '@/lib/admin-session'
import { clearedAdminSessionCookieOptions } from '@/lib/server/admin-session'

/**
 * Ends an admin session.
 *
 * Always responds 200, even when the cookie is missing or already dead, so a
 * logout from a half-expired session still clears client state instead of
 * leaving the user stuck on a page they cannot use.
 *
 * Revocation happens BEFORE the response is built: if the response is lost in
 * flight, the session is still dead server-side. Revoking refresh tokens also
 * ends the browser's Firebase session at its next hourly refresh, which is the
 * right blast radius for "log me out".
 *
 * Caveat worth knowing: `requireUserAuth` verifies bearer ID tokens with
 * `checkRevoked: false`, so an ID token already in an attacker's hands stays
 * valid on that path until its natural one-hour expiry. The session-cookie
 * path uses `checkRevoked: true` and dies immediately.
 */

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const cookie = request.cookies.get(ADMIN_SESSION_COOKIE)?.value

  if (cookie) {
    try {
      const decoded = await adminAuth.verifySessionCookie(cookie, false)
      await adminAuth.revokeRefreshTokens(decoded.uid)
    } catch (error) {
      // An unverifiable cookie is already useless; clearing it is still correct.
      Sentry.captureException(error)
      console.error('[ADMIN_LOGOUT] revoke skipped', error)
    }
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set(ADMIN_SESSION_COOKIE, '', clearedAdminSessionCookieOptions())
  return response
}
