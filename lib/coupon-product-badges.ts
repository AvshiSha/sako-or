import type { Coupon } from '@prisma/client'
import { getCouponLabel, type CouponLabel } from './coupon-labels'

export type { CouponLabel }

export interface ProductCouponBadge {
  code: string
  label: CouponLabel
  discountValue: number
}

export type ProductCouponBadgeIndex = Record<string, ProductCouponBadge>

type CouponLike = Pick<
  Coupon,
  | 'code'
  | 'discountType'
  | 'discountValue'
  | 'eligibleProducts'
  | 'bogoBuySkus'
  | 'bogoGetSkus'
  | 'bogoEligibleSkus'
  | 'bogoBuyQuantity'
  | 'bogoGetQuantity'
  | 'isActive'
  | 'startDate'
  | 'endDate'
  | 'usageLimit'
  | 'usageCount'
>

function normalizeSku(sku: string): string {
  return sku.trim().toLowerCase()
}

export function getCouponSkuLists(
  coupon: Pick<Coupon, 'discountType' | 'eligibleProducts' | 'bogoBuySkus' | 'bogoGetSkus' | 'bogoEligibleSkus'>
): string[] {
  switch (coupon.discountType) {
    case 'percent_specific':
      return coupon.eligibleProducts ?? []
    case 'bogo': {
      const lists = [
        ...(coupon.eligibleProducts ?? []),
        ...(coupon.bogoBuySkus ?? []),
        ...(coupon.bogoGetSkus ?? []),
        ...(coupon.bogoEligibleSkus ?? []),
      ]
      return lists
    }
    case 'percent_all':
    case 'fixed':
    default:
      return []
  }
}

export function isCouponStorefrontActive(
  coupon: Pick<Coupon, 'isActive' | 'startDate' | 'endDate' | 'usageLimit' | 'usageCount'>,
  now: Date = new Date()
): boolean {
  if (!coupon.isActive) return false
  if (coupon.startDate && coupon.startDate > now) return false
  if (coupon.endDate && coupon.endDate < now) return false
  if (
    coupon.usageLimit !== null &&
    coupon.usageLimit !== undefined &&
    coupon.usageCount >= coupon.usageLimit
  ) {
    return false
  }
  return true
}

export function getCouponBadgeLabel(
  coupon: Pick<Coupon, 'discountType' | 'discountValue' | 'bogoBuyQuantity' | 'bogoGetQuantity'>
): CouponLabel {
  return getCouponLabel(coupon)
}

function shouldReplaceBadge(existing: ProductCouponBadge, candidate: ProductCouponBadge): boolean {
  return candidate.discountValue > existing.discountValue
}

export function buildStorefrontCouponBadgeIndex(coupons: CouponLike[]): Map<string, ProductCouponBadge> {
  const index = new Map<string, ProductCouponBadge>()

  for (const coupon of coupons) {
    const skuLists = getCouponSkuLists(coupon)
    if (skuLists.length === 0) continue

    const label = getCouponBadgeLabel(coupon)
    const discountValue = coupon.discountValue ?? 0
    const badge: ProductCouponBadge = {
      code: coupon.code,
      label,
      discountValue,
    }

    const seenSkus = new Set<string>()
    for (const rawSku of skuLists) {
      const normalized = normalizeSku(rawSku)
      if (!normalized || seenSkus.has(normalized)) continue
      seenSkus.add(normalized)

      const existing = index.get(normalized)
      if (!existing || shouldReplaceBadge(existing, badge)) {
        index.set(normalized, badge)
      }
    }
  }

  return index
}

export function badgeIndexToRecord(index: Map<string, ProductCouponBadge>): ProductCouponBadgeIndex {
  return Object.fromEntries(index.entries())
}

export function lookupProductCouponBadge(
  index: ProductCouponBadgeIndex,
  sku: string | undefined | null,
  baseSku?: string | undefined | null
): ProductCouponBadge | null {
  const candidates = [sku, baseSku].filter(Boolean) as string[]
  for (const candidate of candidates) {
    const badge = index[normalizeSku(candidate)]
    if (badge) return badge
  }
  return null
}
