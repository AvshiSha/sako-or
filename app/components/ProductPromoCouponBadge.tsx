'use client'

import type { ProductCouponBadge } from '@/lib/coupon-product-badges'

const BADGE_FONT_STYLE = { fontFamily: 'Assistant, sans-serif' } as const

export function ProductPromoCouponBadge({
  badge,
  language,
}: {
  badge: ProductCouponBadge
  language: 'en' | 'he'
}) {
  const text =
    language === 'he' ? `קוד קופון: ${badge.code}` : `Code: ${badge.code}`

  return (
    <div
      dir={language === 'he' ? 'rtl' : 'ltr'}
      className="inline-flex w-fit max-w-full items-center rounded-full border border-[#856D55]/45 bg-white/95 px-2.5 py-1 min-h-[22px] pointer-events-none"
      style={BADGE_FONT_STYLE}
    >
      <span className="min-w-0 truncate whitespace-nowrap text-[9px] font-medium leading-none tracking-wide text-[#5C4A3A]">
        {text}
      </span>
    </div>
  )
}
