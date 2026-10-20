import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import bcrypt from 'bcryptjs'

import {
  MAX_PIN_LENGTH,
  MIN_PIN_LENGTH,
  PUBLIC_TEST_PINS,
  checkPinShape,
  comparePin,
  hashIsPublicTestPin,
  hashPin,
  isPublicTestPin,
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

describe('published PINs cannot protect anything', () => {
  /**
   * The repository is public, so any PIN written into it is known. These tests
   * pin the three enforcement points described in `lib/staff/pin-hash.ts`.
   *
   * The server-side guard in `lib/server/staff-pin.ts` cannot be reached from
   * here -- it imports `server-only`, which throws under plain tsx -- so its
   * behaviour is covered by the route, which answers 503 PIN_INSECURE.
   */
  it('lists the fixture PIN used by this very file', () => {
    // The load-bearing invariant: change TEST_PIN above and this fails until
    // the new value is added to the blocklist too.
    assert.ok(
      PUBLIC_TEST_PINS.includes(TEST_PIN),
      'the PIN committed in this test file must be on the blocklist'
    )
  })

  it('recognises a published PIN', () => {
    assert.equal(isPublicTestPin(TEST_PIN), true)
    assert.equal(isPublicTestPin('730194'), false)
    assert.equal(isPublicTestPin(null), false)
    assert.equal(isPublicTestPin(undefined), false)
  })

  it('refuses to hash one, so setup cannot create the bad configuration', async () => {
    await assert.rejects(() => hashPin(TEST_PIN), /PUBLIC_TEST_PIN/)
  })

  it('still hashes an ordinary PIN', async () => {
    const hash = await hashPin('730194')
    assert.equal(await comparePin('730194', hash), true)
  })

  describe('hashIsPublicTestPin', () => {
    it('catches the committed hash', async () => {
      assert.equal(await hashIsPublicTestPin(TEST_HASH), true)
    })

    it('catches a hash of a published PIN made anywhere else', async () => {
      // Different salt and a different cost factor. This is why the guard
      // compares against the PIN values rather than the committed hash string:
      // pasting in a hash from another machine must not slip past it.
      const foreign = await bcrypt.hash(TEST_PIN, 10)
      assert.notEqual(foreign, TEST_HASH)
      assert.equal(await hashIsPublicTestPin(foreign), true)
    })

    it('passes a genuine PIN', async () => {
      assert.equal(await hashIsPublicTestPin(await hashPin('730194')), false)
    })

    it('is false, not thrown, for a missing or malformed hash', async () => {
      assert.equal(await hashIsPublicTestPin(undefined), false)
      assert.equal(await hashIsPublicTestPin(''), false)
      assert.equal(await hashIsPublicTestPin('not-a-bcrypt-hash'), false)
    })
  })
})
