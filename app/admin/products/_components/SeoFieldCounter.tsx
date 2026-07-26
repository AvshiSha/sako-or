'use client'

import { getLengthStatus, type LengthRange } from '@/lib/seo-length'

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
}

/**
 * Live character counter with a recommendation, not a hard limit — saving is
 * always allowed regardless of the status shown here.
 */
export default function SeoFieldCounter({ value, range, isDuplicate }: SeoFieldCounterProps) {
  const status = getLengthStatus(value, range)
  const length = value.trim().length

  return (
    <p className={`mt-1 text-xs ${STATUS_STYLES[status]}`}>
      {length} characters — recommended {range.min}-{range.max} ({STATUS_LABEL[status]})
      {isDuplicate && <span className="text-amber-600"> · Duplicate of another field</span>}
    </p>
  )
}
