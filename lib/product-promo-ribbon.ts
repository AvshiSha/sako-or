import type { ProductCouponBadge } from '@/lib/coupon-product-badges'

export type ProductPromoRibbonSize = 'card' | 'page'

export function getProductPromoRibbonParts(
  promoBadge: ProductCouponBadge | null
): { couponCode: string | null } {
  return {
    couponCode: promoBadge?.code ?? null,
  }
}

export function getProductPromoRibbonAriaLabel(
  language: 'en' | 'he',
  couponCode: string | null
): string {
  if (!couponCode) return ''
  return language === 'he' ? `קוד קופון ${couponCode}` : `Coupon code ${couponCode}`
}
