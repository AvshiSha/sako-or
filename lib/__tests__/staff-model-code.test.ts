import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  formatModelCode,
  isCanonicalModelCode,
  isCompleteModelCode,
  parseModelCode,
} from '../staff/model-code'

describe('parseModelCode', () => {
  it('accepts the dashed form and returns it unchanged', () => {
    const result = parseModelCode('4925-0301')
    assert.deepEqual(result, { ok: true, canonical: '4925-0301', digits: '49250301' })
  })

  it('accepts eight bare digits and inserts the dash', () => {
    const result = parseModelCode('49250301')
    assert.deepEqual(result, { ok: true, canonical: '4925-0301', digits: '49250301' })
  })

  it('tolerates surrounding whitespace', () => {
    assert.equal(parseModelCode('  4925-0301\n').ok, true)
    assert.equal(parseModelCode('\t49250301 ').ok, true)
  })

  it('tolerates a space where the dash would be', () => {
    // Someone reading a number aloud gets typed this way.
    const result = parseModelCode('4925 0301')
    assert.equal(result.ok && result.canonical, '4925-0301')
  })

  describe('leading zeros', () => {
    // The identifier is a string. Parsing it as a number would make 0012-0034
    // and 12-34 the same model, and they are not.
    it('preserves leading zeros in the dashed form', () => {
      const result = parseModelCode('0012-0034')
      assert.deepEqual(result, { ok: true, canonical: '0012-0034', digits: '00120034' })
    })

    it('preserves leading zeros in the bare form', () => {
      const result = parseModelCode('00120034')
      assert.equal(result.ok && result.canonical, '0012-0034')
    })

    it('keeps an all-zero model code', () => {
      const result = parseModelCode('00000000')
      assert.equal(result.ok && result.canonical, '0000-0000')
      assert.equal(result.ok && result.digits, '00000000')
    })

    it('does not treat a short number with zeros as complete', () => {
      // '0012034' is seven digits; padding it would invent a model.
      assert.deepEqual(parseModelCode('0012034'), { ok: false, reason: 'TOO_SHORT' })
    })
  })

  describe('rejections', () => {
    it('reports an empty input', () => {
      assert.deepEqual(parseModelCode(''), { ok: false, reason: 'EMPTY' })
      assert.deepEqual(parseModelCode('   '), { ok: false, reason: 'EMPTY' })
      assert.deepEqual(parseModelCode(null), { ok: false, reason: 'EMPTY' })
      assert.deepEqual(parseModelCode(undefined), { ok: false, reason: 'EMPTY' })
    })

    it('reports separators with no digits as empty, not as non-digit', () => {
      assert.deepEqual(parseModelCode('-'), { ok: false, reason: 'EMPTY' })
    })

    it('rejects seven digits', () => {
      assert.deepEqual(parseModelCode('4925030'), { ok: false, reason: 'TOO_SHORT' })
      assert.deepEqual(parseModelCode('492-5030'), { ok: false, reason: 'TOO_SHORT' })
    })

    it('rejects nine digits', () => {
      assert.deepEqual(parseModelCode('492503011'), { ok: false, reason: 'TOO_LONG' })
      assert.deepEqual(parseModelCode('4925-03011'), { ok: false, reason: 'TOO_LONG' })
    })

    it('rejects letters and punctuation rather than stripping them', () => {
      assert.deepEqual(parseModelCode('4925-030a'), { ok: false, reason: 'NON_DIGIT' })
      assert.deepEqual(parseModelCode('4925/0301'), { ok: false, reason: 'NON_DIGIT' })
      assert.deepEqual(parseModelCode('4925.0301'), { ok: false, reason: 'NON_DIGIT' })
    })

    it('rejects a full Verifone ProductCode, which is not a model number', () => {
      // 4925-03010135 is model + colour + size. Accepting it would look like it
      // worked while querying something subtly different.
      assert.deepEqual(parseModelCode('4925-03010135'), { ok: false, reason: 'TOO_LONG' })
    })
  })
})

describe('formatModelCode', () => {
  it('inserts the dash after four digits', () => {
    assert.equal(formatModelCode('49250301'), '4925-0301')
  })

  it('returns anything that is not eight digits untouched', () => {
    assert.equal(formatModelCode('4925'), '4925')
    assert.equal(formatModelCode('4925-0301'), '4925-0301')
    assert.equal(formatModelCode(''), '')
  })
})

describe('isCompleteModelCode', () => {
  it('is true only for a complete, valid number', () => {
    assert.equal(isCompleteModelCode('4925-0301'), true)
    assert.equal(isCompleteModelCode('49250301'), true)
    // Every intermediate state while typing is false.
    for (const partial of ['4', '49', '492', '4925', '4925-', '4925-0', '4925-030']) {
      assert.equal(isCompleteModelCode(partial), false, `expected ${partial} incomplete`)
    }
  })
})

describe('isCanonicalModelCode', () => {
  it('only accepts the exact dashed shape', () => {
    assert.equal(isCanonicalModelCode('4925-0301'), true)
    assert.equal(isCanonicalModelCode('49250301'), false)
    assert.equal(isCanonicalModelCode('4925-030'), false)
  })
})
