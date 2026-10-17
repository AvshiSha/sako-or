/**
 * Admin login throttle — pure state machine.
 *
 * Why this exists even though rate limiting is enforced at Cloudflare:
 * Cloudflare rules only fire for traffic that reaches Cloudflare. Vercel also
 * answers on its own deployment hostnames, and those leak — Sentry tags, DNS
 * history, certificate transparency logs. The edge rules are the ceiling; this
 * is the floor.
 *
 * Contrast `lib/chatbase/rate-limit.ts`, which keeps counters in module scope
 * and says of itself "never as a security control" — correctly, because on
 * Vercel that state is per-instance and dies on a cold start. The persistence
 * half of this limiter (`lib/server/admin-login-throttle.ts`) writes to
 * Firestore instead, which is shared across instances. This file holds only
 * the arithmetic so it can be unit tested.
 */

export const THROTTLE_WINDOW_MS = 15 * 60 * 1000
export const THROTTLE_MAX_FAILURES = 8

export type ThrottleState = {
  /** Consecutive failures inside the current window. */
  failures: number
  /** Epoch ms of the first failure in the current window. */
  windowStartedAt: number
  /** Epoch ms of the most recent failure. */
  lastFailureAt: number
}

export type ThrottleOutcome = 'success' | 'failure'

export const EMPTY_THROTTLE_STATE: ThrottleState = {
  failures: 0,
  windowStartedAt: 0,
  lastFailureAt: 0,
}

/** True once the window holds at least THROTTLE_MAX_FAILURES failures. */
export function isLockedOut(state: ThrottleState | null | undefined, now: number): boolean {
  if (!state || state.failures < THROTTLE_MAX_FAILURES) return false
  // An expired window is not a lockout, however many failures it recorded.
  return now - state.windowStartedAt < THROTTLE_WINDOW_MS
}

/** Milliseconds until a locked-out key is allowed to try again. 0 when not locked. */
export function retryAfterMs(state: ThrottleState | null | undefined, now: number): number {
  if (!isLockedOut(state, now)) return 0
  return Math.max(0, state!.windowStartedAt + THROTTLE_WINDOW_MS - now)
}

/**
 * Next state after an attempt.
 *
 * A success clears the counter outright. A failure either opens a new window
 * (if there was none, or the previous one has expired) or increments the
 * current one.
 */
export function nextThrottleState(
  prev: ThrottleState | null | undefined,
  now: number,
  outcome: ThrottleOutcome
): ThrottleState {
  if (outcome === 'success') return { ...EMPTY_THROTTLE_STATE }

  const windowExpired = !prev || prev.failures === 0 || now - prev.windowStartedAt >= THROTTLE_WINDOW_MS

  if (windowExpired) {
    return { failures: 1, windowStartedAt: now, lastFailureAt: now }
  }

  return {
    failures: prev!.failures + 1,
    windowStartedAt: prev!.windowStartedAt,
    lastFailureAt: now,
  }
}
