import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  isValidEmailAddress,
  normalizeEmailAddress,
  toSendableEmailAddress,
} from '../email-address'

describe('isValidEmailAddress', () => {
  it('rejects the address that broke order ORDER-1795682631457', () => {
    // A dot immediately before the @ - the old regex accepted this and Resend
    // then refused the whole send with a 422, so nobody was emailed at all.
    assert.equal(isValidEmailAddress('meira_sabag.@walla.com'), false)
  })

  it('accepts the corrected form of that address', () => {
    assert.equal(isValidEmailAddress('meira_sabag@walla.com'), true)
  })

  it('still rejects the doubled-dot typo the old check caught', () => {
    assert.equal(isValidEmailAddress('user@gmail..com'), false)
    assert.equal(isValidEmailAddress('us..er@gmail.com'), false)
  })

  it('rejects dots in the other invalid positions', () => {
    assert.equal(isValidEmailAddress('.user@gmail.com'), false)
    assert.equal(isValidEmailAddress('user@.gmail.com'), false)
    assert.equal(isValidEmailAddress('user@gmail.com.'), false)
  })

  it('rejects structurally broken addresses', () => {
    for (const bad of [
      '',
      '   ',
      'plainstring',
      '@gmail.com',
      'user@',
      'user@gmail',
      'user name@gmail.com',
      'user@gmail .com',
      'a@b@gmail.com',
      'user@-gmail.com',
      'user@gmail-.com',
      'user@gmail.c',
      'user@gmail.c0m',
    ]) {
      assert.equal(isValidEmailAddress(bad), false, `expected ${JSON.stringify(bad)} to be invalid`)
    }
  })

  it('rejects non-strings rather than throwing', () => {
    assert.equal(isValidEmailAddress(undefined), false)
    assert.equal(isValidEmailAddress(null), false)
    assert.equal(isValidEmailAddress(42), false)
  })

  it('accepts the addresses real customers use', () => {
    for (const good of [
      'meira_sabag@walla.com',
      'info@sako-or.com',
      'moshe@sako-or.com',
      'first.last@gmail.com',
      'first+tag@gmail.com',
      "o'brien@example.co.il",
      'user@mail.co.uk',
      'UPPER@EXAMPLE.COM',
      'דוד@example.com',
      'user@xn--4dbrk0ce.com',
    ]) {
      assert.equal(isValidEmailAddress(good), true, `expected ${JSON.stringify(good)} to be valid`)
    }
  })

  it('treats a surrounding-whitespace address as valid (it is trimmed)', () => {
    assert.equal(isValidEmailAddress('  user@gmail.com  '), true)
  })
})

describe('normalizeEmailAddress', () => {
  it('repairs a dot touching the @ on either side', () => {
    assert.equal(normalizeEmailAddress('meira_sabag.@walla.com'), 'meira_sabag@walla.com')
    assert.equal(normalizeEmailAddress('user@.walla.com'), 'user@walla.com')
  })

  it('collapses doubled dots', () => {
    assert.equal(normalizeEmailAddress('user@gmail..com'), 'user@gmail.com')
  })

  it('strips bidi marks pasted in from RTL fields', () => {
    assert.equal(normalizeEmailAddress('‏user@gmail.com‎'), 'user@gmail.com')
  })

  it('trims surrounding whitespace', () => {
    assert.equal(normalizeEmailAddress('  user@gmail.com \n'), 'user@gmail.com')
  })

  it('leaves a valid address untouched', () => {
    assert.equal(normalizeEmailAddress('first.last@sub.example.co.il'), 'first.last@sub.example.co.il')
  })

  it('returns an empty string for non-strings', () => {
    assert.equal(normalizeEmailAddress(undefined), '')
    assert.equal(normalizeEmailAddress(null), '')
  })
})

describe('toSendableEmailAddress', () => {
  it('rescues the order ORDER-1795682631457 address', () => {
    assert.equal(toSendableEmailAddress('meira_sabag.@walla.com'), 'meira_sabag@walla.com')
  })

  it('returns null when nothing sendable can be recovered', () => {
    assert.equal(toSendableEmailAddress('not-an-email'), null)
    assert.equal(toSendableEmailAddress(''), null)
  })
})
