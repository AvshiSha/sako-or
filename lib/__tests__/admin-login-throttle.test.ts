import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  EMPTY_THROTTLE_STATE,
  isLockedOut,
  nextThrottleState,
  retryAfterMs,
  THROTTLE_MAX_FAILURES,
  THROTTLE_WINDOW_MS,
} from '../admin-login-throttle'

const T0 = 1_700_000_000_000

/** Applies n consecutive failures starting at `from`, one per second. */
function failTimes(n: number, from = T0) {
  let state = EMPTY_THROTTLE_STATE
  for (let i = 0; i < n; i++) {
    state = nextThrottleState(state, from + i * 1000, 'failure')
  }
  return state
}

describe('nextThrottleState', () => {
  it('opens a window on the first failure', () => {
    const state = nextThrottleState(EMPTY_THROTTLE_STATE, T0, 'failure')
    assert.equal(state.failures, 1)
    assert.equal(state.windowStartedAt, T0)
    assert.equal(state.lastFailureAt, T0)
  })

  it('increments within the window without moving the window start', () => {
    const state = failTimes(3)
    assert.equal(state.failures, 3)
    assert.equal(state.windowStartedAt, T0)
    assert.equal(state.lastFailureAt, T0 + 2000)
  })

  it('opens a fresh window once the old one has expired', () => {
    const old = failTimes(5)
    const later = T0 + THROTTLE_WINDOW_MS + 1
    const state = nextThrottleState(old, later, 'failure')
    assert.equal(state.failures, 1)
    assert.equal(state.windowStartedAt, later)
  })

  it('clears the counter on success', () => {
    const state = nextThrottleState(failTimes(7), T0 + 5000, 'success')
    assert.deepEqual(state, EMPTY_THROTTLE_STATE)
  })

  it('treats a null previous state as no history', () => {
    const state = nextThrottleState(null, T0, 'failure')
    assert.equal(state.failures, 1)
  })
})

describe('isLockedOut', () => {
  it('does not lock out below the threshold', () => {
    assert.equal(isLockedOut(failTimes(THROTTLE_MAX_FAILURES - 1), T0 + 1000), false)
  })

  it('locks out at the threshold', () => {
    assert.equal(isLockedOut(failTimes(THROTTLE_MAX_FAILURES), T0 + 1000), true)
  })

  it('stops locking out once the window has passed', () => {
    const state = failTimes(THROTTLE_MAX_FAILURES)
    assert.equal(isLockedOut(state, T0 + THROTTLE_WINDOW_MS + 1), false)
  })

  it('handles null and empty state', () => {
    assert.equal(isLockedOut(null, T0), false)
    assert.equal(isLockedOut(EMPTY_THROTTLE_STATE, T0), false)
  })

  it('a success in the middle of a run clears the lockout', () => {
    let state = failTimes(THROTTLE_MAX_FAILURES - 1)
    state = nextThrottleState(state, T0 + 10_000, 'success')
    state = nextThrottleState(state, T0 + 11_000, 'failure')
    assert.equal(isLockedOut(state, T0 + 12_000), false)
    assert.equal(state.failures, 1)
  })
})

describe('retryAfterMs', () => {
  it('is zero when not locked out', () => {
    assert.equal(retryAfterMs(failTimes(1), T0 + 1000), 0)
    assert.equal(retryAfterMs(null, T0), 0)
  })

  it('counts down from the window start, not the last failure', () => {
    const state = failTimes(THROTTLE_MAX_FAILURES)
    const now = T0 + 60_000
    assert.equal(retryAfterMs(state, now), THROTTLE_WINDOW_MS - 60_000)
  })
})
