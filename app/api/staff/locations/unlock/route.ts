import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'

import { getClientIp } from '@/lib/turnstile'
import { requireStaffRequest } from '@/lib/server/staff-request'
import { getManagerPinStatus, verifyManagerPin } from '@/lib/server/staff-pin'
import {
  checkPinThrottle,
  recordPinAttempt,
  recordPinAttemptOutcome,
} from '@/lib/server/staff-pin-throttle'
import {
  createEditGrant,
  revokeEditGrantsForUid,
} from '@/lib/server/warehouse-locations'
import { unlockLocationSchema } from '@/lib/schemas/staff-stock-schema'
import { STAFF_EDIT_ERROR_CODES } from '@/lib/staff-session'

/**
 * Verifies the manager PIN and grants permission to edit ONE model/colour.
 *
 * The PIN is checked here and nowhere else; the client never sees the hash and
 * the PIN is never logged. What comes back is an opaque grant id, not a token
 * the client can reason about, and the grant is bound to this Firebase session,
 * to this model and colour, expires in three minutes, and is spent by one
 * successful save.
 *
 * `PUT /api/staff/locations` re-checks all of that inside its transaction, so
 * this endpoint succeeding is necessary but not sufficient -- authorization is
 * verified again at the actual write.
 *
 * Throttling is keyed on the session uid and deliberately lives only on this
 * endpoint: too many wrong PINs must never stop anyone looking stock up, which
 * is the job this screen exists for.
 */

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const auth = await requireStaffRequest(request)
  if (auth instanceof NextResponse) return auth

  const ip = getClientIp(request.headers)
  const userAgent = request.headers.get('user-agent')

  const json = await request.json().catch(() => null)
  const parsed = unlockLocationSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Invalid request',
        code: STAFF_EDIT_ERROR_CODES.INVALID_REQUEST,
        issues: parsed.error.issues,
      },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    )
  }

  const { modelCode, colorCode, pin } = parsed.data

  // Distinguished from a wrong PIN on purpose: otherwise a deployment that was
  // never given a PIN looks like five wrong guesses and a lockout, and nobody
  // can tell why.
  const pinStatus = await getManagerPinStatus()
  if (pinStatus !== 'ok') {
    // Reported separately from a wrong PIN: otherwise an environment that was
    // never configured -- or was configured with the published test PIN --
    // looks like five wrong guesses and a lockout, and nobody can tell why.
    return NextResponse.json(
      {
        error:
          pinStatus === 'public_test_pin'
            ? 'Manager PIN is a published test value and must be replaced'
            : 'Manager PIN is not configured',
        code:
          pinStatus === 'public_test_pin'
            ? STAFF_EDIT_ERROR_CODES.PIN_INSECURE
            : STAFF_EDIT_ERROR_CODES.PIN_NOT_CONFIGURED,
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    )
  }

  const throttle = await checkPinThrottle(auth.uid)
  if (throttle.lockedOut) {
    await recordPinAttempt({
      uid: auth.uid,
      ip,
      userAgent,
      outcome: 'failure',
      reason: throttle.degraded ? 'THROTTLE_DEGRADED' : STAFF_EDIT_ERROR_CODES.PIN_LOCKED,
      modelCode,
      colorCode,
    })

    return NextResponse.json(
      {
        error: 'Too many incorrect PIN attempts',
        code: STAFF_EDIT_ERROR_CODES.PIN_LOCKED,
        retryAfterSeconds: throttle.retryAfterSeconds,
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(throttle.retryAfterSeconds),
          'Cache-Control': 'no-store',
        },
      }
    )
  }

  const correct = await verifyManagerPin(pin)

  await recordPinAttemptOutcome(auth.uid, correct ? 'success' : 'failure')
  await recordPinAttempt({
    uid: auth.uid,
    ip,
    userAgent,
    outcome: correct ? 'success' : 'failure',
    reason: correct ? 'OK' : 'WRONG_PIN',
    modelCode,
    colorCode,
  })

  if (!correct) {
    return NextResponse.json(
      { error: 'Incorrect manager PIN', code: STAFF_EDIT_ERROR_CODES.FORBIDDEN },
      { status: 403, headers: { 'Cache-Control': 'no-store' } }
    )
  }

  try {
    // One live grant per session. Unlocking a second colour retires the first,
    // so a manager who starts an edit and changes their mind does not leave a
    // usable permission behind on a shared iPad.
    await revokeEditGrantsForUid(auth.uid)

    const grant = await createEditGrant({
      firebaseUid: auth.uid,
      modelCode,
      colorCode,
    })

    return NextResponse.json(
      { ok: true, ...grant, modelCode, colorCode },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    Sentry.captureException(error)
    console.error('[STAFF_UNLOCK] failed to create edit grant', error)
    return NextResponse.json(
      { error: 'Could not start editing', code: STAFF_EDIT_ERROR_CODES.SAVE_FAILED },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
