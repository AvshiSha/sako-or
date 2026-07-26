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

export const SEO_TITLE_RANGE: LengthRange = { min: 50, max: 60 }
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
