import type { Coupon } from '@prisma/client'

export interface CouponLabel {
  en: string
  he: string
}

export const currencySymbols: Record<string, string> = {
  ILS: '₪',
  USD: '$',
  EUR: '€',
}

export function getCouponLabel(
  coupon: Pick<Coupon, 'discountType' | 'discountValue' | 'bogoBuyQuantity' | 'bogoGetQuantity'>,
  currency: string = 'ILS'
): CouponLabel {
  const symbol = currencySymbols[currency] ?? currencySymbols.ILS

  switch (coupon.discountType) {
    case 'percent_all':
    case 'percent_specific': {
      const percentage = coupon.discountValue ?? 0
      return {
        en: `${percentage}% OFF`,
        he: `${percentage}% OFF`,
      }
    }
    case 'fixed': {
      const amount = coupon.discountValue ?? 0
      return {
        en: `${symbol}${amount} off`,
        he: `${symbol}${amount} OFF`,
      }
    }
    case 'bogo': {
      const buy = coupon.bogoBuyQuantity ?? 1
      const get = coupon.bogoGetQuantity ?? 1
      const discountPercent = Math.min(Math.max(coupon.discountValue ?? 100, 0), 100)
      return {
        en:
          discountPercent >= 100
            ? `Buy ${buy}, get ${get} free`
            : `Buy ${buy}, get ${get} at ${discountPercent}% off`,
        he:
          discountPercent >= 100
            ? `קנה ${buy}, קבל ${get} חינם`
            : `קנה ${buy}, קבל ${get} בהנחה של ${discountPercent}%`,
      }
    }
    default:
      return {
        en: 'Coupon applied',
        he: 'קופון הופעל',
      }
  }
}
