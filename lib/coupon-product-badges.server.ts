import 'server-only'

import type { CouponDiscountType } from '@prisma/client'
import { prisma } from './prisma'
import {
  badgeIndexToRecord,
  buildStorefrontCouponBadgeIndex,
  getCouponSkuLists,
  isCouponStorefrontActive,
  type ProductCouponBadgeIndex,
} from './coupon-product-badges'

const EMPTY_COUPON_BADGE_INDEX: ProductCouponBadgeIndex = {}

export async function getStorefrontCouponBadgeIndex(): Promise<ProductCouponBadgeIndex> {
  try {
    const now = new Date()

    const coupons = await prisma.coupon.findMany({
      where: {
        isActive: true,
        discountType: {
          in: ['percent_specific', 'bogo'] as CouponDiscountType[],
        },
      },
      select: {
        code: true,
        discountType: true,
        discountValue: true,
        eligibleProducts: true,
        bogoBuySkus: true,
        bogoGetSkus: true,
        bogoEligibleSkus: true,
        bogoBuyQuantity: true,
        bogoGetQuantity: true,
        isActive: true,
        startDate: true,
        endDate: true,
        usageLimit: true,
        usageCount: true,
      },
    })

    const activeCoupons = coupons.filter((coupon) => {
      if (!isCouponStorefrontActive(coupon, now)) return false
      return getCouponSkuLists(coupon).length > 0
    })

    return badgeIndexToRecord(buildStorefrontCouponBadgeIndex(activeCoupons))
  } catch (error) {
    console.error('[getStorefrontCouponBadgeIndex] Failed to load coupon badges:', error)
    return EMPTY_COUPON_BADGE_INDEX
  }
}
