'use client'

/**
 * The order summary aside, drawn identically on the cart (438:3991) and on both
 * checkout frames (438:2725 / 438:2836): a brown free-shipping band, the coupon
 * field, the points block, the totals rules and the dark CTA.
 *
 * Presentational only — every figure comes from useCartPricing, so the cart and
 * the screen that charges the card cannot disagree about what the order costs.
 * `children` renders between the points block and the totals, which is where the
 * cart puts its delivery-method control.
 */

import { useState, type ReactNode } from 'react'

import PointsUsage from '@/app/components/PointsUsage'
import type { CartPricing } from '@/app/hooks/useCartPricing'

/** 438:2793 — white field, pure-black hairline, centred uppercase value. */
const FIELD_CLASS =
  'min-w-0 flex-1 border border-sako-black bg-surface-primary px-[10px] text-center font-ploni text-[16px] uppercase text-sako-black outline-none placeholder:text-sako-gray-500 placeholder:normal-case focus:border-sako-ink-900 disabled:bg-sako-gray-300'

/** 438:2792 "CTA Button" — 54px, ink fill, paper label. No border in the Update file. */
const APPLY_CLASS =
  'shrink-0 bg-btn-primary-bg px-[18px] font-ploni text-[16px] font-bold leading-none text-btn-primary-text transition-colors hover:bg-sako-ink-800 disabled:bg-sako-gray-500'

const RULE_CLASS = 'h-px w-full shrink-0 bg-sako-ink-900/20'

const SUMMARY_ROW_CLASS =
  'flex w-full items-start gap-[10px] font-ploni text-[16px] font-bold text-sako-ink-800'

const CAPTION_CLASS = 'font-ploni text-[9px] tracking-[0.72px]'

const strings = {
  en: {
    title: 'Order Summary',
    couponLabel: 'I have a coupon code',
    couponPlaceholder: 'Coupon code',
    apply: 'Apply',
    applying: 'Checking…',
    remove: 'Remove',
    discount: 'Discount',
    subtotal: 'Subtotal',
    delivery: 'Shipping',
    notCalculated: 'Not calculated',
    free: 'Free',
    total: 'Order total',
    vatNote: 'Prices include VAT',
    ctaPending: 'Opening checkout',
    pointsDiscount: 'Points discount',
    bogo: 'BOGO deal',
    bogoLeftover: 'Deal applies to pairs only. Add 1 more eligible item to activate another pair.',
    bogoConflict: 'Coupons can’t be combined with the automatic pairs deal.',
    freeDeliveryProgress: (remaining: string) => `₪${remaining} away from free shipping`,
    freeDeliveryReached: 'You’ve earned free shipping'
  },
  he: {
    title: 'סיכום הזמנה',
    couponLabel: 'יש לי קוד קופון',
    couponPlaceholder: 'קוד קופון',
    apply: 'החל',
    applying: 'בודק…',
    remove: 'הסר',
    discount: 'הנחה',
    subtotal: 'סך ביניים',
    delivery: 'משלוח',
    notCalculated: 'לא חושב',
    free: 'חינם',
    total: 'סך כל ההזמנה',
    vatNote: 'המחירים כוללים מע״מ',
    ctaPending: 'פותח את עמוד התשלום',
    pointsDiscount: 'הנחת נקודות',
    bogo: 'מבצע זוגות',
    bogoLeftover: 'המבצע חל על זוגות בלבד. הוסיפי עוד פריט זכאי כדי להפעיל זוג נוסף.',
    bogoConflict: 'לא ניתן לשלב קופונים עם מבצע הזוגות.',
    freeDeliveryProgress: (remaining: string) => `נותרו לך ₪${remaining} לקבלת משלוח חינם`,
    freeDeliveryReached: 'קיבלת משלוח חינם'
  }
} as const

export interface OrderSummaryPanelProps {
  pricing: CartPricing
  language: 'he' | 'en'
  shippingMethod: 'delivery' | 'pickup'
  /** Signed in — there is nothing to redeem otherwise, and the frame has no signed-out state. */
  showPoints?: boolean
  ctaLabel: string
  onCta: () => void
  ctaDisabled?: boolean
  /**
   * The CTA is working - revalidating stock, or holding the navigation it started.
   * Deliberately separate from ctaDisabled: disabled greys the button out, which
   * reads as unavailable, and this one is busy. The caller is responsible for
   * refusing re-entry; this only draws it.
   */
  ctaPending?: boolean
  /** Rendered under the totals, above the CTA. */
  notice?: string | null
  /** Rendered between the points block and the totals. */
  children?: ReactNode
  className?: string
}

export default function OrderSummaryPanel({
  pricing,
  language,
  shippingMethod,
  showPoints = false,
  ctaLabel,
  onCta,
  ctaDisabled = false,
  ctaPending = false,
  notice,
  children,
  className = ''
}: OrderSummaryPanelProps) {
  const [couponInput, setCouponInput] = useState('')
  const isRTL = language === 'he'
  const t = strings[language]

  const {
    couponLoading,
    couponStatus,
    appliedCoupons,
    applyCouponCode,
    removeCoupon,
    pointsBalance,
    setPointsToUse,
    pointsLoading,
    usablePoints,
    isCappedBy15Percent,
    maxPointsBy15Percent,
    isBogoActive,
    bogoDiscountAmount,
    bogoHasLeftover,
    subtotal,
    pointsDiscount,
    deliveryFee,
    finalTotal,
    remainingForFreeDelivery
  } = pricing

  const formatMoney = (value: number) =>
    `₪${value.toLocaleString(isRTL ? 'he-IL' : 'en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`

  const handleApplyCoupon = () => {
    applyCouponCode(couponInput)
    setCouponInput('')
  }

  return (
    <aside className={`bg-sako-gray-400 ${className}`}>
      {/* 438:2783 — a solid brown band. It reports progress in copy, not as a
          fill; the frame draws no track behind it. */}
      {shippingMethod === 'delivery' && (
        <div className="border-b border-sako-ink-900">
          <div className="flex min-h-[48px] items-center justify-center bg-sako-brown-500 px-[16px] py-[10px]">
            <p className="text-center font-ploni text-[14px] font-semibold leading-[1.22] text-text-inverse">
              {remainingForFreeDelivery > 0
                ? t.freeDeliveryProgress(
                    remainingForFreeDelivery.toLocaleString(isRTL ? 'he-IL' : 'en-US', {
                      maximumFractionDigits: 0
                    })
                  )
                : t.freeDeliveryReached}
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-[20px] px-[16px] pt-[30px] pb-[30px] lg:px-[30px]">
        <h2 className="font-ploni text-[40px] font-black leading-[40px] text-start text-text-primary lg:text-[60px] lg:leading-[50px]">
          {t.title}
        </h2>

        {/* Coupon — 438:2788 */}
        <div className="flex flex-col gap-[10px]">
          <label
            htmlFor="summary-coupon"
            className="font-ploni text-[16px] font-bold leading-none text-start text-sako-ink-800"
          >
            {t.couponLabel}
          </label>

          {isBogoActive && (
            <p className="font-ploni text-[12px] text-start text-sako-gray-800">{t.bogoConflict}</p>
          )}

          <div className="flex h-[54px] items-stretch">
            <input
              id="summary-coupon"
              type="text"
              value={couponInput}
              onChange={(event) => setCouponInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  handleApplyCoupon()
                }
              }}
              placeholder={t.couponPlaceholder}
              disabled={couponLoading || isBogoActive}
              className={FIELD_CLASS}
            />
            <button
              type="button"
              onClick={handleApplyCoupon}
              disabled={couponLoading || !couponInput.trim() || isBogoActive}
              className={APPLY_CLASS}
            >
              {couponLoading ? t.applying : t.apply}
            </button>
          </div>

          {couponStatus && (
            <p
              className={`font-ploni text-[12px] text-start ${
                couponStatus.type === 'error' ? 'text-accent-error' : 'text-sako-ink-800'
              }`}
              role={couponStatus.type === 'error' ? 'alert' : undefined}
            >
              {couponStatus.message}
            </p>
          )}

          {appliedCoupons.length > 0 && (
            <ul className="flex flex-wrap gap-[8px]">
              {appliedCoupons.map(coupon => (
                <li
                  key={coupon.coupon.code}
                  className="inline-flex items-center gap-[8px] border border-sako-ink-900 px-[10px] py-[5px] font-ploni text-[12px] text-sako-ink-900"
                >
                  {coupon.coupon.code}
                  <button
                    type="button"
                    onClick={() => removeCoupon(coupon.coupon.code)}
                    aria-label={`${t.remove} ${coupon.coupon.code}`}
                    className="text-[14px] leading-none transition-opacity hover:opacity-60"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Points — 438:2796 */}
        {showPoints && (
          <>
            <div className={RULE_CLASS} />
            <PointsUsage
              pointsBalance={pointsBalance}
              maxUsablePoints={usablePoints}
              isCappedBy15Percent={isCappedBy15Percent}
              maxPointsBy15Percent={maxPointsBy15Percent}
              onPointsChange={setPointsToUse}
              language={language}
              disabled={pointsLoading}
            />
          </>
        )}

        {children && (
          <>
            <div className={RULE_CLASS} />
            {children}
          </>
        )}

        <div className={RULE_CLASS} />

        {/* Totals — label on the inline start, figure on the end (438:4044) */}
        <div className={SUMMARY_ROW_CLASS}>
          <span className="min-w-0 flex-1 text-start">{t.subtotal}</span>
          <span className="shrink-0 tabular-nums">{formatMoney(subtotal)}</span>
        </div>

        <div className={SUMMARY_ROW_CLASS}>
          <span className="min-w-0 flex-1 text-start">{t.delivery}</span>
          <span className="shrink-0 tabular-nums">
            {shippingMethod === 'pickup'
              ? t.free
              : deliveryFee > 0
                ? formatMoney(deliveryFee)
                : subtotal > 0
                  ? t.free
                  : t.notCalculated}
          </span>
        </div>

        {isBogoActive && (
          <div className={SUMMARY_ROW_CLASS}>
            <span className="min-w-0 flex-1 text-start">{t.bogo}</span>
            <span className="shrink-0 tabular-nums">-{formatMoney(bogoDiscountAmount)}</span>
          </div>
        )}

        {!isBogoActive &&
          appliedCoupons.map(coupon => (
            <div key={coupon.coupon.code} className={SUMMARY_ROW_CLASS}>
              <span className="min-w-0 flex-1 text-start">
                {t.discount} <span className="text-sako-gray-600">({coupon.coupon.code})</span>
              </span>
              <span className="shrink-0 tabular-nums">-{formatMoney(coupon.discountAmount)}</span>
            </div>
          ))}

        {pointsDiscount > 0 && (
          <div className={SUMMARY_ROW_CLASS}>
            <span className="min-w-0 flex-1 text-start">{t.pointsDiscount}</span>
            <span className="shrink-0 tabular-nums">-{formatMoney(pointsDiscount)}</span>
          </div>
        )}

        {isBogoActive && bogoHasLeftover && (
          <p className="font-ploni text-[12px] text-start text-sako-gray-800">{t.bogoLeftover}</p>
        )}

        <div className={RULE_CLASS} />

        <div className={SUMMARY_ROW_CLASS}>
          <span className="min-w-0 flex-1 text-start">{t.total}</span>
          <span className="shrink-0 tabular-nums">{formatMoney(finalTotal)}</span>
        </div>

        <div className={RULE_CLASS} />

        {notice && (
          <p className="font-ploni text-[12px] text-start text-accent-error" role="alert">
            {notice}
          </p>
        )}

        {/* 438:2813 — 58px ink bar, label on the inline start, the frame's arrow
            glyph pushed to the far end. */}
        <button
          type="button"
          onClick={onCta}
          disabled={ctaDisabled}
          // aria-disabled rather than disabled while pending: a disabled button
          // drops out of the tab order and loses focus mid-flow, and the caller
          // already refuses re-entry.
          aria-disabled={ctaDisabled || ctaPending || undefined}
          aria-busy={ctaPending || undefined}
          className="relative overflow-hidden flex h-[58px] w-full items-center justify-between border border-btn-primary-bg bg-btn-primary-bg px-[19px] transition-colors hover:bg-sako-ink-800 disabled:border-sako-gray-500 disabled:bg-sako-gray-500"
        >
          {ctaPending && (
            <>
              <span
                className="sako-cta-pending-sheen pointer-events-none absolute inset-0"
                aria-hidden="true"
              />
              <span className="sr-only" role="status">
                {t.ctaPending}
              </span>
            </>
          )}
          <span className="font-ploni text-[13px] font-bold text-text-inverse">{ctaLabel}</span>
          <span
            aria-hidden="true"
            className="flex size-[22px] rotate-90 items-center justify-center font-ploni text-[20px] font-black leading-none text-text-inverse"
          >
            ↙
          </span>
        </button>

        <p className={`${CAPTION_CLASS} text-start text-sako-gray-800`}>{t.vatNote}</p>
      </div>
    </aside>
  )
}
