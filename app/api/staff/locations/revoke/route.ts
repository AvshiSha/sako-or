import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'

import { requireStaffRequest } from '@/lib/server/staff-request'
import { revokeEditGrantsForUid } from '@/lib/server/warehouse-locations'

/**
 * Gives up any outstanding manager edit permission for this session.
 *
 * Called when the edit dialog is cancelled. Sign-out does the same thing from
 * `app/api/staff/logout/route.ts`, so both ways of walking away from a
 * half-finished edit leave the device in viewer mode -- which is what the brief
 * asks for, and what makes a shared iPad safe to hand over.
 *
 * Idempotent, and always 200 when authenticated: "there was nothing to revoke"
 * and "I revoked one" are the same outcome from the caller's point of view, and
 * a cancel button that can fail is a cancel button people stop trusting.
 */

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const auth = await requireStaffRequest(request)
  if (auth instanceof NextResponse) return auth

  try {
    const revoked = await revokeEditGrantsForUid(auth.uid)
    return NextResponse.json(
      { ok: true, revoked },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    Sentry.captureException(error)
    console.error('[STAFF_REVOKE] failed to revoke edit grants', error)
    // Reported so the client can warn rather than silently believe the device
    // is back in viewer mode. The grant still expires on its own in minutes.
    return NextResponse.json(
      { error: 'Could not release the edit permission' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
