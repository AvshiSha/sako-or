import 'server-only'
import { createHash } from 'crypto'
import * as Sentry from '@sentry/nextjs'
import { adminDb } from '@/lib/firebase-admin'
import {
  EMPTY_THROTTLE_STATE,
  isLockedOut,
  nextThrottleState,
  retryAfterMs,
  type ThrottleOutcome,
  type ThrottleState,
} from '@/lib/admin-login-throttle'

/**
 * Persistence for the admin login throttle, plus the login audit trail.
 *
 * Firestore rather than a module-scope Map, because the counter has to be
 * shared across serverless instances to be worth anything. Firestore is
 * already a dependency and the Admin SDK bypasses security rules, so no new
 * infrastructure and no Prisma migration.
 *
 * Emails are hashed before they are used as document ids or written to the
 * audit log. Passwords and tokens are never recorded.
 */

const THROTTLE_COLLECTION = 'adminLoginThrottle'
const ATTEMPTS_COLLECTION = 'adminLoginAttempts'

export function hashEmail(email: string): string {
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex')
}

export type ThrottleCheck = {
  lockedOut: boolean
  retryAfterSeconds: number
}

/**
 * Current throttle verdict for an email.
 *
 * Fails OPEN on a Firestore error: a storage outage must not lock the only
 * admin out of their own dashboard. The Cloudflare rate-limit rule is the
 * other half of this control and is unaffected by our Firestore being down.
 */
export async function checkLoginThrottle(emailHash: string, now = Date.now()): Promise<ThrottleCheck> {
  try {
    const snap = await adminDb.collection(THROTTLE_COLLECTION).doc(emailHash).get()
    const state = (snap.exists ? (snap.data() as ThrottleState) : null) ?? null

    return {
      lockedOut: isLockedOut(state, now),
      retryAfterSeconds: Math.ceil(retryAfterMs(state, now) / 1000),
    }
  } catch (error) {
    Sentry.captureException(error)
    console.error('[ADMIN_LOGIN_THROTTLE] read failed, failing open', error)
    return { lockedOut: false, retryAfterSeconds: 0 }
  }
}

/** Advances the throttle counter. Never throws. */
export async function recordLoginOutcome(
  emailHash: string,
  outcome: ThrottleOutcome,
  now = Date.now()
): Promise<void> {
  const ref = adminDb.collection(THROTTLE_COLLECTION).doc(emailHash)
  try {
    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      const prev = (snap.exists ? (snap.data() as ThrottleState) : null) ?? EMPTY_THROTTLE_STATE
      tx.set(ref, nextThrottleState(prev, now, outcome))
    })
  } catch (error) {
    Sentry.captureException(error)
    console.error('[ADMIN_LOGIN_THROTTLE] write failed', error)
  }
}

export type LoginAuditEntry = {
  emailHash: string
  ip: string | null
  userAgent: string | null
  outcome: ThrottleOutcome
  /** Machine code from ADMIN_LOGIN_ERROR_CODES, or 'OK'. */
  reason: string
}

/**
 * Writes the login audit trail.
 *
 * The login page has claimed "All login attempts are logged" since it was
 * written; until this existed, nothing did.
 */
export async function recordLoginAttempt(entry: LoginAuditEntry): Promise<void> {
  try {
    await adminDb.collection(ATTEMPTS_COLLECTION).add({ ...entry, at: new Date() })
  } catch (error) {
    Sentry.captureException(error)
    console.error('[ADMIN_LOGIN_AUDIT] write failed', error)
  }
}
