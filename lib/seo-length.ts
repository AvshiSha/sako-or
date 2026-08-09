/**
 * Pure helpers for the admin SEO field character counters. These express
 * recommendations only — nothing here blocks saving a product, per the task
 * requirement that SEO length limits stay advisory, not hard validation.
 */

export type LengthStatus = 'empty' | 'too_short' | 'good' | 'too_long'

export interface LengthRange {
  min: number
  max: number
}

/**
 * buildMetadata() appends this to every title that does not already contain
 * it, so the string an admin types is never the string that ships.
 */
export const TITLE_BRAND_SUFFIX = ' | SAKO-OR'

/**
 * Length of a title as it will actually render, suffix included.
 *
 * The counter used to measure the raw field, so a title showing green at 60
 * characters shipped at 70 - past the ~65 mark where Google truncates it in
 * the SERP and starts rewriting titles itself.
 */
export function getRenderedTitleLength(value: string | null | undefined): number {
  const trimmed = (value ?? '').trim()
  if (!trimmed) return 0
  return trimmed.includes(TITLE_BRAND_SUFFIX.trim())
    ? trimmed.length
    : trimmed.length + TITLE_BRAND_SUFFIX.length
}

/** Target for the RENDERED title (suffix included), not the raw input. */
export const SEO_TITLE_RANGE: LengthRange = { min: 45, max: 60 }
export const META_DESCRIPTION_RANGE: LengthRange = { min: 140, max: 160 }
/** Product titles have no hard SEO range, just an upper warning threshold. */
export const PRODUCT_TITLE_WARN_LENGTH = 70
/** Slugs have no hard range, just an upper warning threshold. */
export const SLUG_WARN_LENGTH = 60

export function getLengthStatus(value: string | null | undefined, range: LengthRange): LengthStatus {
  const length = (value ?? '').trim().length
  if (length === 0) return 'empty'
  if (length < range.min) return 'too_short'
  if (length > range.max) return 'too_long'
  return 'good'
}

export function isOverWarnLength(value: string | null | undefined, warnLength: number): boolean {
  return (value ?? '').trim().length > warnLength
}

/** Case-insensitive, whitespace-normalized duplicate check across a set of values. */
export function findDuplicateValue(value: string, otherValues: (string | null | undefined)[]): boolean {
  const normalized = value.trim().toLowerCase()
  if (!normalized) return false
  return otherValues.some((other) => (other ?? '').trim().toLowerCase() === normalized)
}
