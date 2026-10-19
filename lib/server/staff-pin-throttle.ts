import 'server-only'
import { createHash } from 'crypto'
import * as Sentry from '@sentry/nextjs'
import { adminDb } from '@/lib/firebase-admin'
import {
  EMPTY_PIN_THROTTLE_STATE,
  isPinLockedOut,
  nextPinThrottleState,
  pinRetryAfterMs,
  type PinAttemptOutcome,
  type PinThrottleState,
} from '@/lib/staff/pin-throttle'

/**
 * Persistence for the manager-PIN attempt throttle, plus its audit trail.
 *
 * Firestore rather than module scope, for the same reason as
 * `lib/server/admin-login-throttle.ts`: a counter that lives in one serverless
 * instance is not a control at all. Firestore is already a dependency and the
 * Admin SDK bypasses security rules, so this needs no new infrastructure and no
 * Prisma migration.
 *
 * Keyed by a hash of the Firebase uid. On the shared iPad that is one key for
 * the whole warehouse, which is a real limitation and the reason the lockout
 * copy in `lib/staff/messages.ts` points at the admin screen as a way through.
 *
 * ## Fails CLOSED, unlike the admin login throttle
 *
 * `checkLoginThrottle` fails open on a Firestore error, correctly: a storage
 * outage must not lock the only admin out of their own dashboard. The trade
 * here is the opposite way round. If this read fails we cannot tell a first
 * attempt from a fifth, and the thing being protected is a six-digit secret
 * that guards write access. Denying an edit during an outage costs a delay and
 * leaves stock lookup -- the actual job -- completely unaffected, because
 * lookup never touches this module.
 */

const THROTTLE_COLLECTION = 'staffPinThrottle'
const ATTEMPTS_COLLECTION = 'staffPinAttempts'

function hashUid(uid: string): string {
  return createHash('sha256').update(uid).digest('hex')
}

export type PinThrottleCheck = {
  lockedOut: boolean
  retryAfterSeconds: number
  /** True when the verdict is a storage failure rather than a real count. */
  degraded: boolean
}

export async function checkPinThrottle(
  uid: string,
  now = Date.now()
): Promise<PinThrottleCheck> {
  try {
    const snap = await adminDb.collection(THROTTLE_COLLECTION).doc(hashUid(uid)).get()
    const state = (snap.exists ? (snap.data() as PinThrottleState) : null) ?? null

    return {
      lockedOut: isPinLockedOut(state, now),
      retryAfterSeconds: Math.ceil(pinRetryAfterMs(state, now) / 1000),
      degraded: false,
    }
  } catch (error) {
    Sentry.captureException(error)
    console.error('[STAFF_PIN_THROTTLE] read failed, failing closed', error)
    return { lockedOut: true, retryAfterSeconds: 60, degraded: true }
  }
}

/** Advances the attempt counter. Never throws. */
export async function recordPinAttemptOutcome(
  uid: string,
  outcome: PinAttemptOutcome,
  now = Date.now()
): Promise<void> {
  const ref = adminDb.collection(THROTTLE_COLLECTION).doc(hashUid(uid))
  try {
    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      const prev = (snap.exists ? (snap.data() as PinThrottleState) : null) ?? EMPTY_PIN_THROTTLE_STATE
      tx.set(ref, nextPinThrottleState(prev, now, outcome))
    })
  } catch (error) {
    Sentry.captureException(error)
    console.error('[STAFF_PIN_THROTTLE] write failed', error)
  }
}

export type PinAuditEntry = {
  uidHash: string
  ip: string | null
  userAgent: string | null
  outcome: PinAttemptOutcome
  /** Machine code, or 'OK'. */
  reason: string
  modelCode: string
  colorCode: string
}

/**
 * Records a PIN attempt.
 *
 * The PIN itself is never written, hashed or otherwise. The uid is hashed to
 * match the throttle document id, and the model/colour are kept because "who
 * tried to unlock what" is the question this log exists to answer.
 */
export async function recordPinAttempt(
  entry: Omit<PinAuditEntry, 'uidHash'> & { uid: string }
): Promise<void> {
  const { uid, ...rest } = entry
  try {
    await adminDb
      .collection(ATTEMPTS_COLLECTION)
      .add({ ...rest, uidHash: hashUid(uid), at: new Date() })
  } catch (error) {
    Sentry.captureException(error)
    console.error('[STAFF_PIN_AUDIT] write failed', error)
  }
}
