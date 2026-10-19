/**
 * Manager-PIN attempt throttle -- pure state machine.
 *
 * Deliberately NOT a reuse of `lib/admin-login-throttle.ts`. That module's
 * window and failure ceiling are module constants baked into its own
 * `isLockedOut`/`nextThrottleState`, and `lib/__tests__/admin-login-throttle.test.ts`
 * asserts them; importing it here would couple PIN tuning to admin login, so
 * changing one would change the other. The shape is copied, the numbers are not.
 *
 * The numbers differ on purpose. A PIN is six digits, so the search space is
 * about a million and the throttle -- not the bcrypt hash -- is the real
 * control. Hence 5 failures in 10 minutes rather than the login route's 8 in 15.
 *
 * One consequence to be honest about: the warehouse iPad is a single shared
 * account, so a lockout stops location editing for everyone, not for one
 * person. That is why the lockout copy in `./messages.ts` names the escape
 * hatch -- an admin can still edit through the admin screen with no PIN -- and
 * why stock lookup is deliberately outside this throttle entirely.
 */

export const PIN_THROTTLE_WINDOW_MS = 10 * 60 * 1000
export const PIN_THROTTLE_MAX_FAILURES = 5

export type PinThrottleState = {
  /** Failures inside the current window. */
  failures: number
  /** Epoch ms of the first failure in the current window. */
  windowStartedAt: number
  /** Epoch ms of the most recent failure. */
  lastFailureAt: number
}

export type PinAttemptOutcome = 'success' | 'failure'

export const EMPTY_PIN_THROTTLE_STATE: PinThrottleState = {
  failures: 0,
  windowStartedAt: 0,
  lastFailureAt: 0,
}

/** True once the window holds at least `PIN_THROTTLE_MAX_FAILURES` failures. */
export function isPinLockedOut(
  state: PinThrottleState | null | undefined,
  now: number
): boolean {
  if (!state || state.failures < PIN_THROTTLE_MAX_FAILURES) return false
  // An expired window is not a lockout, however many failures it recorded.
  return now - state.windowStartedAt < PIN_THROTTLE_WINDOW_MS
}

/** Milliseconds until a locked-out key may try again. Zero when not locked. */
export function pinRetryAfterMs(
  state: PinThrottleState | null | undefined,
  now: number
): number {
  if (!isPinLockedOut(state, now)) return 0
  return Math.max(0, state!.windowStartedAt + PIN_THROTTLE_WINDOW_MS - now)
}

/** Attempts left before lockout, for the UI to warn on the last one. */
export function pinAttemptsRemaining(
  state: PinThrottleState | null | undefined,
  now: number
): number {
  if (isPinLockedOut(state, now)) return 0
  if (!state || state.failures === 0) return PIN_THROTTLE_MAX_FAILURES
  if (now - state.windowStartedAt >= PIN_THROTTLE_WINDOW_MS) {
    return PIN_THROTTLE_MAX_FAILURES
  }
  return Math.max(0, PIN_THROTTLE_MAX_FAILURES - state.failures)
}

/**
 * Next state after an attempt.
 *
 * A success clears the counter outright. A failure either opens a new window
 * (when there was none, or the previous one has expired) or increments the
 * current one.
 */
export function nextPinThrottleState(
  prev: PinThrottleState | null | undefined,
  now: number,
  outcome: PinAttemptOutcome
): PinThrottleState {
  if (outcome === 'success') return { ...EMPTY_PIN_THROTTLE_STATE }

  const windowExpired =
    !prev || prev.failures === 0 || now - prev.windowStartedAt >= PIN_THROTTLE_WINDOW_MS

  if (windowExpired) {
    return { failures: 1, windowStartedAt: now, lastFailureAt: now }
  }

  return {
    failures: prev!.failures + 1,
    windowStartedAt: prev!.windowStartedAt,
    lastFailureAt: now,
  }
}
