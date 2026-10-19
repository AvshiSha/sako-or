import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  EMPTY_PIN_THROTTLE_STATE,
  PIN_THROTTLE_MAX_FAILURES,
  PIN_THROTTLE_WINDOW_MS,
  isPinLockedOut,
  nextPinThrottleState,
  pinAttemptsRemaining,
  pinRetryAfterMs,
} from '../staff/pin-throttle'
import {
  THROTTLE_MAX_FAILURES,
  THROTTLE_WINDOW_MS,
} from '../admin-login-throttle'

const T0 = 1_760_000_000_000

/** Replays `count` consecutive failures starting at `startedAt`, 1s apart. */
function failTimes(count: number, startedAt = T0) {
  let state = EMPTY_PIN_THROTTLE_STATE
  for (let i = 0; i < count; i++) {
    state = nextPinThrottleState(state, startedAt + i * 1000, 'failure')
  }
  return state
}

describe('PIN throttle constants', () => {
  it('is tuned for a six-digit PIN, not copied from admin login', () => {
    assert.equal(PIN_THROTTLE_MAX_FAILURES, 5)
    assert.equal(PIN_THROTTLE_WINDOW_MS, 10 * 60 * 1000)
  })

  it('is independent of the admin login throttle', () => {
    // If these ever coincide it is a coincidence, not a shared setting. Pinned
    // so that retuning one cannot quietly retune the other.
    assert.notEqual(PIN_THROTTLE_MAX_FAILURES, THROTTLE_MAX_FAILURES)
    assert.notEqual(PIN_THROTTLE_WINDOW_MS, THROTTLE_WINDOW_MS)
  })
})

describe('nextPinThrottleState', () => {
  it('opens a window on the first failure', () => {
    const state = nextPinThrottleState(EMPTY_PIN_THROTTLE_STATE, T0, 'failure')
    assert.deepEqual(state, { failures: 1, windowStartedAt: T0, lastFailureAt: T0 })
  })

  it('increments inside the window without moving its start', () => {
    const state = failTimes(3)
    assert.equal(state.failures, 3)
    assert.equal(state.windowStartedAt, T0)
    assert.equal(state.lastFailureAt, T0 + 2000)
  })

  it('opens a fresh window once the old one has expired', () => {
    const old = failTimes(4)
    const later = T0 + PIN_THROTTLE_WINDOW_MS + 1
    const state = nextPinThrottleState(old, later, 'failure')
    assert.deepEqual(state, { failures: 1, windowStartedAt: later, lastFailureAt: later })
  })

  it('clears the counter outright on a correct PIN', () => {
    const state = nextPinThrottleState(failTimes(4), T0 + 5000, 'success')
    assert.deepEqual(state, EMPTY_PIN_THROTTLE_STATE)
  })

  it('tolerates a null previous state', () => {
    assert.equal(nextPinThrottleState(null, T0, 'failure').failures, 1)
    assert.deepEqual(nextPinThrottleState(undefined, T0, 'success'), EMPTY_PIN_THROTTLE_STATE)
  })
})

describe('isPinLockedOut', () => {
  it('is not locked below the ceiling', () => {
    assert.equal(isPinLockedOut(failTimes(PIN_THROTTLE_MAX_FAILURES - 1), T0 + 5000), false)
  })

  it('locks on reaching the ceiling', () => {
    assert.equal(isPinLockedOut(failTimes(PIN_THROTTLE_MAX_FAILURES), T0 + 5000), true)
  })

  it('stops being locked once the window has passed', () => {
    const state = failTimes(PIN_THROTTLE_MAX_FAILURES)
    assert.equal(isPinLockedOut(state, T0 + PIN_THROTTLE_WINDOW_MS - 1), true)
    assert.equal(isPinLockedOut(state, T0 + PIN_THROTTLE_WINDOW_MS), false)
  })

  it('is never locked with no recorded state', () => {
    assert.equal(isPinLockedOut(null, T0), false)
    assert.equal(isPinLockedOut(EMPTY_PIN_THROTTLE_STATE, T0), false)
  })
})

describe('pinRetryAfterMs', () => {
  it('counts down to the end of the window', () => {
    const state = failTimes(PIN_THROTTLE_MAX_FAILURES)
    assert.equal(pinRetryAfterMs(state, T0), PIN_THROTTLE_WINDOW_MS)
    assert.equal(pinRetryAfterMs(state, T0 + 60_000), PIN_THROTTLE_WINDOW_MS - 60_000)
  })

  it('is zero when not locked out', () => {
    assert.equal(pinRetryAfterMs(failTimes(1), T0), 0)
    assert.equal(pinRetryAfterMs(null, T0), 0)
  })
})

describe('pinAttemptsRemaining', () => {
  it('starts at the ceiling and counts down', () => {
    assert.equal(pinAttemptsRemaining(null, T0), PIN_THROTTLE_MAX_FAILURES)
    assert.equal(pinAttemptsRemaining(failTimes(1), T0 + 1000), PIN_THROTTLE_MAX_FAILURES - 1)
    assert.equal(pinAttemptsRemaining(failTimes(4), T0 + 5000), 1)
  })

  it('is zero while locked out', () => {
    assert.equal(pinAttemptsRemaining(failTimes(PIN_THROTTLE_MAX_FAILURES), T0 + 1000), 0)
  })

  it('resets once the window has expired', () => {
    const state = failTimes(3)
    assert.equal(
      pinAttemptsRemaining(state, T0 + PIN_THROTTLE_WINDOW_MS + 1),
      PIN_THROTTLE_MAX_FAILURES
    )
  })
})
