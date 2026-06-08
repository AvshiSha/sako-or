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
  { root: string; code: string }
> = {
  card: {
    root: 'text-[10px] leading-tight',
    code: 'px-2 py-1',
  },
  page: {
    root: 'text-xs leading-snug',
    code: 'px-2.5 py-1.5',
  },
}

export function ProductPromoRibbon({
  language,
  promoBadge,
  size = 'card',
  className,
}: {
  language: 'en' | 'he'
  promoBadge: ProductCouponBadge | null
  size?: ProductPromoRibbonSize
  className?: string
}) {
  const { couponCode } = getProductPromoRibbonParts(promoBadge)

  if (!couponCode) return null

  const styles = sizeStyles[size]
  const ariaLabel = getProductPromoRibbonAriaLabel(language, couponCode)

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
      <span
        className={cn(
          'inline-flex shrink-0 items-center whitespace-nowrap rounded-full font-semibold tracking-wide text-[#5C4A3A]',
          styles.code
        )}
      >
        {couponCode}
      </span>
    </div>
  )
}
