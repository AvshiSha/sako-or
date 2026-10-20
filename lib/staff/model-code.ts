/**
 * The model number staff type on the warehouse screen.
 *
 * Canonical form is the DASHED nine-character string, `XXXX-XXXX`. That is not
 * a new convention: it is already what `product.sku` holds in both Neon and
 * Firestore, what `lib/verifone.ts` sends as the SOAP `ItemCode`, what the
 * first nine characters of a Verifone `ProductCode` are, and what
 * `validateSkuFormat` in `lib/sale-prices.ts` accepts. Picking anything else
 * would mean converting at every join.
 *
 * The identifier is a STRING throughout, never a number. `0012-0034` and
 * `12-34` are different models, and parsing to an integer would lose the
 * leading zeros that distinguish them.
 *
 * Pure on purpose: no `server-only`, no imports. The input field, the API route
 * and the unit tests all need the same rules, and `npm test` only reaches
 * `lib/**`.
 */

/** Digits in a model number, excluding the separator. */
export const MODEL_CODE_DIGITS = 8

/** Where the dash sits in the canonical form. */
const DASH_INDEX = 4

export type ModelCodeReason =
  /** Nothing entered yet. */
  | 'EMPTY'
  /** Something other than digits, whitespace or the separator. */
  | 'NON_DIGIT'
  /** Fewer than eight digits -- still being typed. */
  | 'TOO_SHORT'
  /** More than eight digits. */
  | 'TOO_LONG'

export type ParsedModelCode =
  | {
      ok: true
      /** `XXXX-XXXX` -- use this for lookups, database keys and joins. */
      canonical: string
      /** The same eight digits with no separator, for display or comparison. */
      digits: string
    }
  | { ok: false; reason: ModelCodeReason }

/**
 * Accepts `XXXXXXXX` or `XXXX-XXXX`, with surrounding whitespace, and returns
 * the canonical form.
 *
 * Internal whitespace and separators are stripped before counting, so a number
 * read aloud and typed as `4925 0301` is accepted. Anything that is not a digit
 * after that is rejected rather than silently dropped -- a lookup for the wrong
 * model is worse than a validation message.
 */
export function parseModelCode(input: string | null | undefined): ParsedModelCode {
  if (input === null || input === undefined) return { ok: false, reason: 'EMPTY' }

  const trimmed = String(input).trim()
  if (!trimmed) return { ok: false, reason: 'EMPTY' }

  // Separators people actually type: the canonical dash, a space, an en dash.
  const withoutSeparators = trimmed.replace(/[\s\-–]/g, '')
  if (!withoutSeparators) return { ok: false, reason: 'EMPTY' }

  if (!/^\d+$/.test(withoutSeparators)) return { ok: false, reason: 'NON_DIGIT' }

  if (withoutSeparators.length < MODEL_CODE_DIGITS) return { ok: false, reason: 'TOO_SHORT' }
  if (withoutSeparators.length > MODEL_CODE_DIGITS) return { ok: false, reason: 'TOO_LONG' }

  return {
    ok: true,
    canonical: formatModelCode(withoutSeparators),
    digits: withoutSeparators,
  }
}

/**
 * `12345678` -> `1234-5678`. Expects eight digits; returns the input unchanged
 * if it gets anything else, so a caller can format defensively.
 */
export function formatModelCode(digits: string): string {
  if (!/^\d{8}$/.test(digits)) return digits
  return `${digits.slice(0, DASH_INDEX)}-${digits.slice(DASH_INDEX)}`
}

/**
 * True once the input holds a complete, valid model number.
 *
 * Searching is explicit -- the screen looks a model up only when the employee
 * presses the Search button -- so this is a predicate for callers that want to
 * know whether the field is ready, not a trigger for anything.
 */
export function isCompleteModelCode(input: string | null | undefined): boolean {
  return parseModelCode(input).ok
}

/**
 * True when the input is already canonical. Used to decide whether the field
 * should rewrite what the user typed, which must not happen mid-entry.
 */
export function isCanonicalModelCode(value: string): boolean {
  return /^\d{4}-\d{4}$/.test(value)
}

/** Index in `value` immediately after its `n`th digit. */
function caretAfterDigits(value: string, n: number): number {
  if (n <= 0) return 0

  let seen = 0
  for (let i = 0; i < value.length; i++) {
    if (value[i] >= '0' && value[i] <= '9') {
      seen++
      if (seen === n) return i + 1
    }
  }

  return value.length
}

export type FormattedModelInput = {
  /** What the field should display. */
  value: string
  /** Where the caret belongs in that value. */
  caret: number
}

/**
 * Formats what someone typed or pasted into the model-number field, and works
 * out where the caret should end up.
 *
 * Employees type eight digits; the separator is inserted for them. The rules:
 *
 *  - everything that is not a digit is dropped, so pasting `5127-6825`,
 *    `5127 6825` or `5127–6825` all give the same thing and a second hyphen
 *    can never appear;
 *  - at most eight digits are kept, so a long paste is truncated rather than
 *    silently producing a wrong model;
 *  - leading zeros survive, because the identifier is a string and `0012-0034`
 *    is not `12-34`;
 *  - the result is the canonical `XXXX-XXXX` the Verifone integration already
 *    expects, so the displayed value IS the value sent upstream.
 *
 * ## The caret
 *
 * Reformatting replaces the whole value, which would otherwise throw the caret
 * to the end on every keystroke -- the classic bug in auto-formatting fields,
 * and the reason editing a digit in the middle becomes impossible.
 *
 * So position is tracked in DIGITS, not characters: count the digits before the
 * caret in what the user typed, then put the caret after that many digits in
 * the formatted result. That is stable across an inserted or removed separator,
 * which is what makes typing, pasting, selecting and editing mid-number behave
 * the way people expect.
 *
 * @param raw what the field currently holds, before formatting
 * @param caret the caret position within `raw`
 */
export function formatModelInput(raw: string, caret: number): FormattedModelInput {
  const text = raw ?? ''
  const safeCaret = Math.max(0, Math.min(Number.isFinite(caret) ? caret : text.length, text.length))

  const digitsBefore = (text.slice(0, safeCaret).match(/\d/g) ?? []).length
  const digits = (text.match(/\d/g) ?? []).join('').slice(0, MODEL_CODE_DIGITS)

  const value =
    digits.length > DASH_INDEX
      ? `${digits.slice(0, DASH_INDEX)}-${digits.slice(DASH_INDEX)}`
      : digits

  // A paste longer than eight digits leaves more digits before the caret than
  // survive the truncation.
  const clamped = Math.min(digitsBefore, digits.length)

  return { value, caret: caretAfterDigits(value, clamped) }
}

/** Longest string the field can hold: eight digits plus the separator. */
export const MODEL_INPUT_MAX_LENGTH = MODEL_CODE_DIGITS + 1

/**
 * Backspace and Delete pressed next to the separator.
 *
 * Left alone, both appear to do nothing: the browser removes the hyphen, the
 * formatter puts it straight back, and the caret lands where it started. People
 * read that as a stuck key and press harder.
 *
 * So the keystroke is redirected to the digit on the far side of the
 * separator, which is what was meant. Returns null when the key is not next to
 * a separator, in which case the browser should handle it normally.
 *
 * @returns the raw text and caret to format, as if the browser had done it
 */
export function deleteAroundSeparator(
  value: string,
  caret: number,
  key: 'Backspace' | 'Delete'
): { raw: string; caret: number } | null {
  if (key === 'Backspace') {
    // Caret sits just after the separator: remove the digit before it.
    if (caret >= 2 && value[caret - 1] === '-') {
      return { raw: value.slice(0, caret - 2) + value.slice(caret - 1), caret: caret - 2 }
    }
    return null
  }

  // Delete, with the caret just before the separator: remove the digit after it.
  if (value[caret] === '-') {
    return { raw: value.slice(0, caret) + value.slice(caret + 2), caret }
  }

  return null
}
