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
