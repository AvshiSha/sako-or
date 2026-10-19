import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'

import { adminAuth } from '@/lib/firebase-admin'
import { STAFF_SESSION_COOKIE } from '@/lib/staff-session'
import { clearedStaffSessionCookieOptions } from '@/lib/server/staff-session'
import { revokeEditGrantsForUid } from '@/lib/server/warehouse-locations'

/**
 * Ends a staff session.
 *
 * Shaped like `app/api/admin/logout/route.ts` -- always 200, revoke before
 * building the response -- with one addition that matters on a shared device:
 * **any outstanding manager edit grant is revoked too.**
 *
 * Without that, a manager could enter the PIN, walk away mid-edit, and leave a
 * live write permission on an iPad that the next person signs into. The brief
 * requires the edit permission to be invalidated on sign-out, and this is where
 * that happens.
 *
 * Revoking refresh tokens also ends the browser's Firebase session, and
 * `verifyStaffSessionCookie` uses `checkRevoked: true`, so the cookie stops
 * working immediately rather than at its natural expiry. That is what makes the
 * seven-day session TTL acceptable for a device that could be mislaid.
 */

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const cookie = request.cookies.get(STAFF_SESSION_COOKIE)?.value

  if (cookie) {
    try {
      const decoded = await adminAuth.verifySessionCookie(cookie, false)

      // Grants first: if the revoke below throws, the write permission is
      // already gone, which is the more dangerous of the two leftovers.
      try {
        const revoked = await revokeEditGrantsForUid(decoded.uid)
        if (revoked > 0) {
          console.log(`[STAFF_LOGOUT] revoked ${revoked} outstanding edit grant(s)`)
        }
      } catch (error) {
        Sentry.captureException(error)
        console.error('[STAFF_LOGOUT] grant revoke failed', error)
      }

      await adminAuth.revokeRefreshTokens(decoded.uid)
    } catch (error) {
      // An unverifiable cookie is already useless; clearing it is still correct.
      Sentry.captureException(error)
      console.error('[STAFF_LOGOUT] revoke skipped', error)
    }
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set(STAFF_SESSION_COOKIE, '', clearedStaffSessionCookieOptions())
  return response
}
