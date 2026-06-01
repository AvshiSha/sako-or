import type { ProductCouponBadge } from '@/lib/coupon-product-badges'
import { getBogoSecondPairPromoLabel } from '@/lib/bogo-second-pair-promo'

export type ProductPromoRibbonSize = 'card' | 'page'

export function getProductPromoRibbonParts(
  language: 'en' | 'he',
  options: {
    showBogoSecondPair: boolean
    promoBadge: ProductCouponBadge | null
    size?: ProductPromoRibbonSize
  }
): { bogoLabel: string | null; couponCode: string | null } {
  const compact = options.size !== 'page'
  return {
    bogoLabel: options.showBogoSecondPair
      ? getBogoSecondPairPromoLabel(language, { compact })
      : null,
    couponCode: options.promoBadge?.code ?? null,
  }
}

export function getProductPromoRibbonAriaLabel(
  language: 'en' | 'he',
  bogoLabel: string | null,
  couponCode: string | null
): string {
  const parts: string[] = []
  if (bogoLabel) {
    parts.push(
      language === 'he'
        ? `מבצע: ${bogoLabel}`
        : `Promotion: ${bogoLabel}`
    )
  }
  if (couponCode) {
    parts.push(
      language === 'he' ? `קוד קופון ${couponCode}` : `Coupon code ${couponCode}`
    )
  }
  return parts.join(language === 'he' ? '، ' : ', ')
}
