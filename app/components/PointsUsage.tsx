'use client'

import { useState, useEffect } from 'react'
import Accordion from './Accordion'

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
    label: 'Use points',
    placeholder: 'Enter points to use',
    apply: 'Apply',
    remove: 'Remove',
    discount: 'Points discount',
    available: 'Available points',
    noPoints: "You don't have points available to use yet.",
    invalid: 'Invalid amount. Please enter a number between 0 and your available balance.',
    applied: 'Points applied successfully.',
    cap15Percent: (max: string) => `You can use up to 15% of your cart in points (max ₪${max}).`,
    noPointsOnCart: "You can't use points on this cart."
  },
  he: {
    label: 'שימוש בנקודות',
    placeholder: 'הכנס נקודות לשימוש',
    apply: 'החל',
    remove: 'הסר',
    discount: 'הנחת נקודות',
    available: 'נקודות זמינות',
    noPoints: 'אין לך נקודות זמינות לשימוש עדיין.',
    invalid: 'סכום לא תקין. אנא הכנס מספר בין 0 למאזן הזמין שלך.',
    applied: 'הנקודות הוחלו בהצלחה.',
    cap15Percent: (max: string) => `ניתן להשתמש בעד 15% מערך העגלה בנקודות (מקסימום ₪${max}).`,
    noPointsOnCart: 'לא ניתן להשתמש בנקודות בעגלה זו.'
  }
} as const

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
  const isRTL = language === 'he'
  const strings = pointsContent[language]
  const effectiveMax = maxUsablePoints

  const handlePointsChange = (value: string) => {
    setPointsInput(value)
    setError(null)

    const numValue = parseFloat(value)
    
    if (value === '' || value === '0') {
      // Clear points
      setAppliedPoints(0)
      onPointsChange(0)
      return
    }

    if (isNaN(numValue) || numValue < 0) {
      setError(strings.invalid)
      return
    }

    if (numValue > effectiveMax) {
      setError(strings.invalid)
      return
    }

    // Valid input - round to 2 decimal places
    const roundedValue = Math.round(numValue * 100) / 100
    setAppliedPoints(roundedValue)
    onPointsChange(roundedValue)
    setError(null)
  }

  const handleApply = () => {
    const numValue = parseFloat(pointsInput)
    
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

  // Calculate discount amount (1 point = 1 ILS)
  const discountAmount = appliedPoints

  return (
    <Accordion title={strings.label}>
      <div className="pb-4" dir={isRTL ? 'rtl' : 'ltr'}>
        {disabled ? (
          <p className="text-sm text-gray-500">
            {language === 'he' ? 'טוען...' : 'Loading...'}
          </p>
        ) : pointsBalance > 0 && effectiveMax > 0 ? (
          <>
            <div className="mb-2 text-sm text-gray-600">
              {strings.available}: <span className="font-medium">{pointsBalance.toFixed(2)}</span>
            </div>
            {isCappedBy15Percent && (
              <p className="mb-2 text-sm text-gray-600">
                {strings.cap15Percent(maxPointsBy15Percent.toFixed(2))}
              </p>
            )}
            <div className={`flex ${isRTL ? 'flex-row-reverse space-x-reverse' : 'flex-row'} items-center gap-2`}>
                <input
                type="number"
                step="0.01"
                min="0"
                max={effectiveMax}
                value={pointsInput}
                onChange={(e) => handlePointsChange(e.target.value)}
                placeholder={strings.placeholder}
                className={`flex-1 rounded-md border text-gray-900 py-2 px-2 shadow-sm focus:outline-none focus:ring-0.5 focus:ring-[#856D55]/90 ${isRTL ? 'text-right' : 'text-left'}`}
                disabled={disabled || pointsBalance <= 0 || effectiveMax <= 0}
                style={{ 
                  borderColor: error ? 'rgba(220, 38, 38, 0.5)' : 'rgba(133, 109, 85, 0.2)',
                  borderRadius: '2px'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = error ? 'rgba(220, 38, 38, 0.7)' : 'rgba(133, 109, 85, 0.7)'
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = error ? 'rgba(220, 38, 38, 0.5)' : 'rgba(133, 109, 85, 0.2)'
                }}
              />
              <button
                onClick={handleApply}
                disabled={disabled || pointsBalance <= 0 || effectiveMax <= 0 || !pointsInput.trim() || parseFloat(pointsInput) <= 0}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-[#856D55]/90 hover:bg-[#856D55] disabled:opacity-70"
              >
                {strings.apply}
              </button>
            </div>
            {error && (
              <p className="mt-2 text-sm text-red-600">
                {error}
              </p>
            )}
            {appliedPoints > 0 && (
              <div className="mt-3">
                <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700">
                  <span>
                    {strings.discount}: -₪{discountAmount.toFixed(2)} ({appliedPoints.toFixed(2)} {language === 'he' ? 'נקודות' : 'points'})
                  </span>
                  <button
                    onClick={handleRemove}
                    className={`${isRTL ? 'mr-2' : 'ml-2'} text-green-600 hover:text-green-800`}
                    aria-label={strings.remove}
                  >
                    ×
                  </button>
                </div>
              </div>
            )}
          </>
        ) : pointsBalance > 0 && effectiveMax <= 0 ? (
          <p className="text-sm text-gray-500">
            {strings.noPointsOnCart}
          </p>
        ) : (
          <p className="text-sm text-gray-500">
            {strings.noPoints}
          </p>
        )}
      </div>
    </Accordion>
  )
}
