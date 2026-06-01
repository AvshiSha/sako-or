'use client'

import type { ProductCouponBadge } from '@/lib/coupon-product-badges'
import {
  getProductPromoRibbonAriaLabel,
  getProductPromoRibbonParts,
  type ProductPromoRibbonSize,
} from '@/lib/product-promo-ribbon'
import { cn } from '@/lib/utils'

const RIBBON_FONT = { fontFamily: 'Assistant, sans-serif' } as const

const sizeStyles: Record<
  ProductPromoRibbonSize,
  { root: string; bogo: string; code: string; divider: string }
> = {
  card: {
    root: 'text-[10px] leading-tight',
    bogo: 'px-2 py-1',
    code: 'px-2 py-1',
    divider: 'my-1',
  },
  page: {
    root: 'text-xs leading-snug',
    bogo: 'px-2.5 py-1.5',
    code: 'px-2.5 py-1.5',
    divider: 'my-1.5',
  },
}

export function ProductPromoRibbon({
  language,
  showBogoSecondPair,
  promoBadge,
  size = 'card',
  className,
}: {
  language: 'en' | 'he'
  showBogoSecondPair: boolean
  promoBadge: ProductCouponBadge | null
  size?: ProductPromoRibbonSize
  className?: string
}) {
  const { bogoLabel, couponCode } = getProductPromoRibbonParts(language, {
    showBogoSecondPair,
    promoBadge,
    size,
  })

  if (!bogoLabel && !couponCode) return null

  const styles = sizeStyles[size]
  const ariaLabel = getProductPromoRibbonAriaLabel(language, bogoLabel, couponCode)
  const codeOnly = !bogoLabel && couponCode
  const bogoOnly = bogoLabel && !couponCode

  return (
    <div
      role="status"
      aria-label={ariaLabel}
      dir={language === 'he' ? 'rtl' : 'ltr'}
      style={RIBBON_FONT}
      className={cn(
        'inline-flex w-fit max-w-full items-stretch overflow-hidden rounded-full border border-[#856D55]/20 bg-white/95 shadow-[0_2px_10px_rgba(0,0,0,0.08)] backdrop-blur-md pointer-events-none',
        styles.root,
        className
      )}
    >
      {bogoLabel && (
        <span
          className={cn(
            'inline-flex shrink-0 items-center font-semibold text-white',
            bogoOnly ? 'rounded-full' : 'rounded-s-full',
            styles.bogo,
            'bg-[#856D55]'
          )}
        >
          {bogoLabel}
        </span>
      )}

      {bogoLabel && couponCode && (
        <span
          aria-hidden
          className={cn('w-px shrink-0 self-stretch bg-[#856D55]/25', styles.divider)}
        />
      )}

      {couponCode && (
        <span
          className={cn(
            'inline-flex shrink-0 items-center whitespace-nowrap font-semibold tracking-wide text-[#5C4A3A]',
            codeOnly ? 'rounded-full' : 'rounded-e-full',
            styles.code
          )}
        >
          {couponCode}
        </span>
      )}
    </div>
  )
}
