import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { decideWrite, isNoOpWrite } from '../staff/location-write'

describe('decideWrite', () => {
  it('creates when there is no row and the client did not claim one', () => {
    assert.deepEqual(decideWrite(null, null), { kind: 'create' })
  })

  it('updates when the client holds the current version', () => {
    assert.deepEqual(decideWrite(4, { version: 4 }), { kind: 'update', version: 4 })
  })

  describe('conflicts, rather than silently overwriting a newer location', () => {
    it('refuses when the client holds an older version', () => {
      assert.deepEqual(decideWrite(3, { version: 4 }), {
        kind: 'conflict',
        reason: 'VERSION_MISMATCH',
      })
    })

    it('refuses a version from the future, which means stale or forged input', () => {
      assert.deepEqual(decideWrite(9, { version: 4 }), {
        kind: 'conflict',
        reason: 'VERSION_MISMATCH',
      })
    })

    it('refuses to create over a row the client never saw', () => {
      // The client rendered "no location assigned" while someone else assigned
      // one. Creating here would overwrite an assignment nobody reviewed.
      assert.deepEqual(decideWrite(null, { version: 1 }), {
        kind: 'conflict',
        reason: 'EXPECTED_ABSENT_BUT_EXISTS',
      })
    })

    it('refuses to update a row that has since disappeared', () => {
      assert.deepEqual(decideWrite(2, null), {
        kind: 'conflict',
        reason: 'EXPECTED_EXISTING_BUT_ABSENT',
      })
    })
  })

  it('treats version 0 as a real version, not as absent', () => {
    // A falsy-but-present version is the classic way this kind of check breaks.
    assert.deepEqual(decideWrite(0, { version: 0 }), { kind: 'update', version: 0 })
    assert.deepEqual(decideWrite(0, { version: 1 }), {
      kind: 'conflict',
      reason: 'VERSION_MISMATCH',
    })
  })
})

describe('isNoOpWrite', () => {
  it('spots a save that changes nothing', () => {
    assert.equal(
      isNoOpWrite({ room: 2, route: 1, drawer: 18, onFloor: false }, { room: 2, route: 1, drawer: 18, onFloor: false }),
      true
    )
  })

  it('treats any changed component as a change', () => {
    const current = { room: 2, route: 1, drawer: 18, onFloor: false }
    assert.equal(isNoOpWrite(current, { room: 3, route: 1, drawer: 18, onFloor: false }), false)
    assert.equal(isNoOpWrite(current, { room: 2, route: 2, drawer: 18, onFloor: false }), false)
    assert.equal(isNoOpWrite(current, { room: 2, route: 1, drawer: 19, onFloor: false }), false)
  })

  it('is never a no-op when there is no current row', () => {
    assert.equal(isNoOpWrite(null, { room: 1, route: 1, drawer: 1, onFloor: false }), false)
  })
})
