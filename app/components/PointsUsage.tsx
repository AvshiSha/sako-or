'use client'

import { useState, useEffect } from 'react'

/**
 * Points redemption control, cart frame 46:16455 (nodes 258:12402-258:12414).
 *
 * The old control was an accordion wrapping a rounded brown-on-white form. The
 * frame draws it as a permanently open block identical in shape to the coupon
 * field directly above it: a label, a white field with a black hairline and a
 * filled ink button, then one line of helper copy. Keeping the two fields
 * literally the same component shape is the point - they sit 20px apart and any
 * difference between them reads as a mistake.
 *
 * The field is a plain text box in the design (no spinner), so the number input
 * is kept for the keyboard it summons on mobile but its spinners are hidden.
 */

interface PointsUsageProps {
  pointsBalance: number
  /** Max points the user is allowed to apply for this cart (min(balance, 15% of cart)). */
  maxUsablePoints: number
  /** True when user has more points than 15% of cart, so we show the cap explanation. */
  isCappedBy15Percent?: boolean
  /** 15% of cart amount, for display in the cap message. */
  maxPointsBy15Percent?: number
  onPointsChange: (points: number) => void
  language: 'he' | 'en'
  disabled?: boolean
}

const pointsContent = {
  en: {
    label: 'Redeem points',
    apply: 'Apply',
    remove: 'Remove',
    discount: 'Points discount',
    available: (balance: string) => `${balance} points to redeem. `,
    cap: (max: string) => `Maximum redeemable - ${max}`,
    noPoints: "You don't have points available to use yet.",
    invalid: 'Enter a number between 0 and the maximum shown above.',
    loading: 'Loading…',
    noPointsOnCart: "You can't use points on this cart."
  },
  he: {
    label: 'מימוש נקודות',
    apply: 'החל',
    remove: 'הסר',
    discount: 'הנחת נקודות',
    available: (balance: string) => `${balance} נקודות למימוש. `,
    cap: (max: string) => `כמות נקודות מקסימלית - ${max}`,
    noPoints: 'אין לך נקודות זמינות לשימוש עדיין.',
    invalid: 'יש להזין מספר בין 0 לכמות המקסימלית שמופיעה למעלה.',
    loading: 'טוען…',
    noPointsOnCart: 'לא ניתן להשתמש בנקודות בעגלה זו.'
  }
} as const

/** Shared with the coupon field in CartClient — same frame, same box. */
const FIELD_CLASS =
  'min-w-0 flex-1 border border-sako-black bg-surface-primary px-[10px] py-[17px] text-center font-ploni text-[16px] tabular-nums text-sako-black outline-none placeholder:text-sako-gray-500 focus:border-sako-ink-900 disabled:bg-sako-gray-300 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'

const APPLY_CLASS =
  'shrink-0 border border-btn-primary-bg bg-btn-primary-bg px-[18px] py-[14px] font-ploni text-[16px] font-bold leading-none text-btn-primary-text transition-colors hover:bg-sako-ink-800 disabled:border-sako-gray-500 disabled:bg-sako-gray-500'

const HELPER_CLASS = 'font-ploni text-[16px] text-start text-sako-ink-800'

export default function PointsUsage({
  pointsBalance,
  maxUsablePoints,
  isCappedBy15Percent = false,
  maxPointsBy15Percent = 0,
  onPointsChange,
  language,
  disabled = false
}: PointsUsageProps) {
  const [pointsInput, setPointsInput] = useState('')
  const [appliedPoints, setAppliedPoints] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const strings = pointsContent[language]
  const effectiveMax = maxUsablePoints

  const handleApply = () => {
    const numValue = parseFloat(pointsInput)

    if (pointsInput.trim() === '' || numValue === 0) {
      setAppliedPoints(0)
      onPointsChange(0)
      setError(null)
      return
    }

    if (isNaN(numValue) || numValue < 0 || numValue > effectiveMax) {
      setError(strings.invalid)
      return
    }

    // Round to 2 decimal places
    const roundedValue = Math.round(numValue * 100) / 100
    setAppliedPoints(roundedValue)
    onPointsChange(roundedValue)
    setError(null)
  }

  const handleRemove = () => {
    setPointsInput('')
    setAppliedPoints(0)
    onPointsChange(0)
    setError(null)
  }

  // When cap drops (e.g. cart/coupons changed), clamp local state to maxUsablePoints
  useEffect(() => {
    if (appliedPoints > maxUsablePoints) {
      const clamped = maxUsablePoints
      setAppliedPoints(clamped)
      setPointsInput(clamped.toFixed(2))
      onPointsChange(clamped)
      setError(null)
    }
  }, [maxUsablePoints, appliedPoints, onPointsChange])

  const formatPoints = (value: number) =>
    value.toLocaleString(language === 'he' ? 'he-IL' : 'en-US', {
      maximumFractionDigits: 2
    })

  return (
    <div className="flex flex-col gap-[10px]">
      <p className="font-ploni text-[16px] font-bold leading-none text-start text-sako-ink-800">
        {strings.label}
      </p>

      {disabled ? (
        <p className={HELPER_CLASS}>{strings.loading}</p>
      ) : pointsBalance > 0 && effectiveMax > 0 ? (
        <>
          <div className="flex items-stretch">
            <input
              type="number"
              step="0.01"
              min="0"
              max={effectiveMax}
              value={pointsInput}
              onChange={(event) => {
                setPointsInput(event.target.value)
                setError(null)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  handleApply()
                }
              }}
              aria-label={strings.label}
              aria-invalid={error ? true : undefined}
              placeholder="0"
              className={FIELD_CLASS}
            />
            <button type="button" onClick={handleApply} className={APPLY_CLASS}>
              {strings.apply}
            </button>
          </div>

          {/* One line, two weights — the frame splits the balance from the ceiling
              (Bold) inside a single paragraph. The frame sets the first span in
              Ploni Medium; we ship 400/600/700/900, so it takes Regular rather than
              a browser-synthesized 500. */}
          <p className={HELPER_CLASS}>
            <span className="font-normal">{strings.available(formatPoints(pointsBalance))}</span>
            <span className="font-bold">
              {strings.cap(formatPoints(isCappedBy15Percent ? maxPointsBy15Percent : effectiveMax))}
            </span>
          </p>

          {error && (
            <p className="font-ploni text-[12px] text-accent-error text-start" role="alert">
              {error}
            </p>
          )}

          {appliedPoints > 0 && (
            <p className={`${HELPER_CLASS} flex items-center gap-[8px]`}>
              <span>
                {strings.discount}: -₪{appliedPoints.toFixed(2)}
              </span>
              <button
                type="button"
                onClick={handleRemove}
                className="font-ploni text-[9px] tracking-[0.72px] text-sako-ink-900 underline transition-opacity hover:opacity-60"
              >
                {strings.remove}
              </button>
            </p>
          )}
        </>
      ) : (
        <p className={HELPER_CLASS}>
          {pointsBalance > 0 ? strings.noPointsOnCart : strings.noPoints}
        </p>
      )}
    </div>
  )
}
