import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  MAX_PIN_LENGTH,
  MIN_PIN_LENGTH,
  checkPinShape,
  comparePin,
  hashPin,
} from '../staff/pin-hash'

/**
 * A throwaway PIN and its bcrypt hash, committed on purpose.
 *
 * This is NOT the production PIN and must never become one. The real value
 * lives only in `STAFF_MANAGER_PIN_HASH` in the deployment environment; see
 * docs/staff-stock-lookup.md. Committing a known pair is what lets the
 * comparison be tested at all, since bcrypt output is salted and so cannot be
 * asserted against a literal.
 */
const TEST_PIN = '246813'
const TEST_HASH = '$2a$12$4GshQgAeswwQ7ELuQ9EmMuw9/SIdSla.N4TqW7MPG0jLUXSSKpWpi'

describe('checkPinShape', () => {
  it('accepts a PIN of a permitted length', () => {
    assert.equal(checkPinShape('246813'), null)
    assert.equal(checkPinShape('0'.repeat(MIN_PIN_LENGTH)), null)
    assert.equal(checkPinShape('1'.repeat(MAX_PIN_LENGTH)), null)
  })

  it('rejects an empty PIN', () => {
    assert.equal(checkPinShape(''), 'EMPTY')
    assert.equal(checkPinShape('   '), 'EMPTY')
    assert.equal(checkPinShape(null), 'EMPTY')
    assert.equal(checkPinShape(undefined), 'EMPTY')
  })

  it('rejects anything that is not all digits, without stripping', () => {
    // Trimming a padded PIN would accept something the user did not type.
    assert.equal(checkPinShape('24681a'), 'NON_DIGIT')
    assert.equal(checkPinShape('246 813'), 'NON_DIGIT')
    assert.equal(checkPinShape(' 246813'), 'NON_DIGIT')
    assert.equal(checkPinShape('246813 '), 'NON_DIGIT')
  })

  it('enforces the length bounds', () => {
    assert.equal(checkPinShape('1'.repeat(MIN_PIN_LENGTH - 1)), 'TOO_SHORT')
    assert.equal(checkPinShape('1'.repeat(MAX_PIN_LENGTH + 1)), 'TOO_LONG')
  })

  it('keeps a leading zero significant', () => {
    assert.equal(checkPinShape('012345'), null)
  })
})

describe('comparePin', () => {
  it('accepts the correct PIN', async () => {
    assert.equal(await comparePin(TEST_PIN, TEST_HASH), true)
  })

  it('rejects a wrong PIN of the same length', async () => {
    assert.equal(await comparePin('246814', TEST_HASH), false)
    assert.equal(await comparePin('999999', TEST_HASH), false)
  })

  it('rejects a PIN that differs only by a leading zero', async () => {
    assert.equal(await comparePin('046813', TEST_HASH), false)
  })

  describe('denies rather than throwing when misconfigured', () => {
    // A deployment with no PIN configured must refuse edits, not crash, and
    // certainly not allow them.
    it('rejects when no hash is configured', async () => {
      assert.equal(await comparePin(TEST_PIN, undefined), false)
      assert.equal(await comparePin(TEST_PIN, null), false)
      assert.equal(await comparePin(TEST_PIN, ''), false)
      assert.equal(await comparePin(TEST_PIN, '   '), false)
    })

    it('rejects when the stored hash is malformed', async () => {
      assert.equal(await comparePin(TEST_PIN, 'not-a-bcrypt-hash'), false)
      assert.equal(await comparePin(TEST_PIN, '$2a$12$too-short'), false)
    })

    it('rejects a badly shaped PIN without consulting the hash', async () => {
      assert.equal(await comparePin('', TEST_HASH), false)
      assert.equal(await comparePin('abc', TEST_HASH), false)
      assert.equal(await comparePin('12', TEST_HASH), false)
    })
  })
})

describe('hashPin', () => {
  it('produces a hash its own comparison accepts', async () => {
    const hash = await hashPin('135790')
    assert.equal(await comparePin('135790', hash), true)
    assert.equal(await comparePin('135791', hash), false)
  })

  it('salts, so the same PIN hashes differently every time', async () => {
    const [a, b] = await Promise.all([hashPin('135790'), hashPin('135790')])
    assert.notEqual(a, b)
  })

  it('refuses to create a PIN the entry field would then reject', async () => {
    await assert.rejects(() => hashPin('12'), /TOO_SHORT/)
    await assert.rejects(() => hashPin('abcdef'), /NON_DIGIT/)
    await assert.rejects(() => hashPin(''), /EMPTY/)
  })
})
