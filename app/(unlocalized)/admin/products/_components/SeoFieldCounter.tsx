'use client'

import { getLengthStatus, getRenderedTitleLength, TITLE_BRAND_SUFFIX, type LengthRange } from '@/lib/seo-length'

const STATUS_STYLES: Record<string, string> = {
  empty: 'text-gray-400',
  too_short: 'text-amber-600',
  good: 'text-green-600',
  too_long: 'text-red-600',
}

const STATUS_LABEL: Record<string, string> = {
  empty: 'Empty',
  too_short: 'Too short',
  good: 'Good length',
  too_long: 'Too long',
}

interface SeoFieldCounterProps {
  value: string
  range: LengthRange
  /** Set when this value duplicates another field's value (e.g. same title reused everywhere). */
  isDuplicate?: boolean
  /**
   * Set on title fields. Counts the " | SAKO-OR" that buildMetadata appends,
   * so the number shown is the length Google will actually see rather than
   * the length of the box you are typing into.
   */
  countsBrandSuffix?: boolean
}

/**
 * Live character counter with a recommendation, not a hard limit — saving is
 * always allowed regardless of the status shown here.
 */
export default function SeoFieldCounter({ value, range, isDuplicate, countsBrandSuffix }: SeoFieldCounterProps) {
  const length = countsBrandSuffix ? getRenderedTitleLength(value) : value.trim().length
  const status = countsBrandSuffix
    ? getLengthStatus('x'.repeat(length), range)
    : getLengthStatus(value, range)

  return (
    <p className={`mt-1 text-xs ${STATUS_STYLES[status]}`}>
      {length} characters
      {countsBrandSuffix && <span className="text-gray-400"> (incl. &quot;{TITLE_BRAND_SUFFIX.trim()}&quot;)</span>}
      {' '}— recommended {range.min}-{range.max} ({STATUS_LABEL[status]})
      {isDuplicate && <span className="text-amber-600"> · Duplicate of another field</span>}
    </p>
  )
}
