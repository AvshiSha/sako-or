import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  MODEL_INPUT_MAX_LENGTH,
  deleteAroundSeparator,
  formatModelInput,
  parseModelCode,
} from '../staff/model-code'

/**
 * Auto-formatting for the model-number field.
 *
 * The caret is the whole difficulty here. A field that reformats on every
 * keystroke replaces its entire value, and if the caret is not restored by
 * DIGIT position it jumps to the end -- at which point editing a digit in the
 * middle of a number is impossible. Most of these tests are about that.
 *
 * Notation below: `|` marks the caret in the comments.
 */

/** Convenience: format `raw` with the caret written as `|`. */
function at(rawWithCaret: string) {
  const caret = rawWithCaret.indexOf('|')
  const raw = rawWithCaret.replace('|', '')
  return formatModelInput(raw, caret === -1 ? raw.length : caret)
}

/** Renders a result back into the `|` notation, for readable assertions. */
function show(result: { value: string; caret: number }) {
  return result.value.slice(0, result.caret) + '|' + result.value.slice(result.caret)
}

describe('formatModelInput', () => {
  it('inserts the separator after the fourth digit', () => {
    assert.equal(formatModelInput('51276825', 8).value, '5127-6825')
  })

  it('does not add a separator before there is a fifth digit', () => {
    assert.equal(formatModelInput('5', 1).value, '5')
    assert.equal(formatModelInput('512', 3).value, '512')
    assert.equal(formatModelInput('5127', 4).value, '5127')
    // The fifth digit is what brings it in.
    assert.equal(formatModelInput('51276', 5).value, '5127-6')
  })

  it('accepts an already-formatted number without duplicating the separator', () => {
    assert.equal(formatModelInput('5127-6825', 9).value, '5127-6825')
    // Even if the separator is in the wrong place or repeated.
    assert.equal(formatModelInput('51-27-6825', 10).value, '5127-6825')
    assert.equal(formatModelInput('5127--6825', 10).value, '5127-6825')
    assert.equal(formatModelInput('-5127-6825-', 11).value, '5127-6825')
  })

  it('normalises other separators people paste', () => {
    for (const pasted of ['5127 6825', '5127–6825', '5127.6825', '5127/6825']) {
      assert.equal(formatModelInput(pasted, pasted.length).value, '5127-6825', pasted)
    }
  })

  it('preserves leading zeros', () => {
    assert.equal(formatModelInput('00120034', 8).value, '0012-0034')
    assert.equal(formatModelInput('0012-0034', 9).value, '0012-0034')
    assert.equal(formatModelInput('00000000', 8).value, '0000-0000')
    // And a short one keeps them while being typed.
    assert.equal(formatModelInput('000', 3).value, '000')
  })

  it('caps at eight digits however many are pasted', () => {
    assert.equal(formatModelInput('512768259999', 12).value, '5127-6825')
    assert.equal(formatModelInput('5127-6825-0135', 14).value, '5127-6825')
    // The full Verifone ProductCode pasted in: truncated to the model.
    assert.equal(formatModelInput('4925-03010135', 13).value, '4925-0301')
  })

  it('produces exactly what the Verifone integration expects', () => {
    const formatted = formatModelInput('51276825', 8).value
    const parsed = parseModelCode(formatted)
    assert.equal(parsed.ok && parsed.canonical, '5127-6825')
    // The displayed value IS the canonical value, so nothing is converted later.
    assert.equal(parsed.ok && parsed.canonical, formatted)
  })

  it('drops letters rather than keeping them', () => {
    assert.equal(formatModelInput('51a27b6825', 10).value, '5127-6825')
    assert.equal(formatModelInput('abc', 3).value, '')
  })

  it('handles an empty field', () => {
    assert.deepEqual(formatModelInput('', 0), { value: '', caret: 0 })
  })

  it('tolerates a caret outside the string', () => {
    assert.equal(formatModelInput('5127', -5).caret, 0)
    assert.equal(formatModelInput('5127', 99).caret, 4)
  })

  describe('the caret stays where the typist expects', () => {
    it('follows a digit typed at the end', () => {
      // 1234| + "5" -> 12345| -> 1234-5|
      assert.equal(show(at('12345|')), '1234-5|')
      assert.equal(show(at('51276825|')), '5127-6825|')
    })

    it('skips over the separator as it appears', () => {
      // Typing the 5th digit must not leave the caret before the new hyphen.
      const result = at('51276|')
      assert.equal(result.value, '5127-6')
      assert.equal(result.caret, 6)
    })

    it('does not jump to the end when editing mid-number', () => {
      // "5127-6825" with the caret after the 2nd digit, typing "9":
      // raw "51927-6825" caret 3 -> digits 519276825 -> capped 51927682
      const result = formatModelInput('51927-6825', 3)
      assert.equal(result.value, '5192-7682')
      // Caret after the 3rd digit, i.e. right after the typed 9.
      assert.equal(result.caret, 3)
      assert.equal(show(result), '519|2-7682')
    })

    it('sits before the separator when four digits precede it', () => {
      assert.equal(show(formatModelInput('5127-6825', 4)), '5127|-6825')
    })

    it('clamps to the end of a truncated paste', () => {
      const result = formatModelInput('512768259999', 12)
      assert.equal(result.value, '5127-6825')
      assert.equal(result.caret, 9)
    })

    it('stays at the start when the field is cleared', () => {
      assert.deepEqual(formatModelInput('', 0), { value: '', caret: 0 })
    })
  })

  it('is idempotent, so re-formatting its own output changes nothing', () => {
    const once = formatModelInput('51276825', 8)
    const twice = formatModelInput(once.value, once.caret)
    assert.deepEqual(twice, once)
  })
})

describe('MODEL_INPUT_MAX_LENGTH', () => {
  it('allows eight digits plus the separator', () => {
    assert.equal(MODEL_INPUT_MAX_LENGTH, 9)
    assert.equal('5127-6825'.length, MODEL_INPUT_MAX_LENGTH)
  })
})

describe('deleteAroundSeparator', () => {
  describe('Backspace just after the separator', () => {
    it('removes the digit before it, not the separator', () => {
      // "5127-|6825" + Backspace should delete the 7, not stall on the hyphen.
      const redirect = deleteAroundSeparator('5127-6825', 5, 'Backspace')
      assert.ok(redirect)
      const result = formatModelInput(redirect!.raw, redirect!.caret)
      assert.equal(result.value, '5126-825')
      assert.equal(show(result), '512|6-825')
    })

    it('works when only one digit follows the separator', () => {
      const redirect = deleteAroundSeparator('5127-6', 5, 'Backspace')
      assert.ok(redirect)
      const result = formatModelInput(redirect!.raw, redirect!.caret)
      assert.equal(result.value, '5126')
    })
  })

  describe('Delete just before the separator', () => {
    it('removes the digit after it', () => {
      // "5127|-6825" + Delete should delete the 6.
      const redirect = deleteAroundSeparator('5127-6825', 4, 'Delete')
      assert.ok(redirect)
      const result = formatModelInput(redirect!.raw, redirect!.caret)
      assert.equal(result.value, '5127-825')
      assert.equal(show(result), '5127|-825')
    })
  })

  describe('everywhere else the browser handles it', () => {
    it('returns null for an ordinary Backspace', () => {
      assert.equal(deleteAroundSeparator('5127-6825', 9, 'Backspace'), null)
      assert.equal(deleteAroundSeparator('5127-6825', 3, 'Backspace'), null)
      assert.equal(deleteAroundSeparator('', 0, 'Backspace'), null)
      assert.equal(deleteAroundSeparator('5127', 0, 'Backspace'), null)
    })

    it('returns null for an ordinary Delete', () => {
      assert.equal(deleteAroundSeparator('5127-6825', 0, 'Delete'), null)
      assert.equal(deleteAroundSeparator('5127-6825', 9, 'Delete'), null)
      assert.equal(deleteAroundSeparator('5127-6825', 6, 'Delete'), null)
    })
  })
})
