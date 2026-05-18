'use client'

import React, { createContext, useContext, useMemo } from 'react'
import {
  lookupProductCouponBadge,
  type ProductCouponBadge,
  type ProductCouponBadgeIndex,
} from '@/lib/coupon-product-badges'

interface CouponBadgeContextType {
  index: ProductCouponBadgeIndex
}

const CouponBadgeContext = createContext<CouponBadgeContextType | undefined>(undefined)

export function CouponBadgeProvider({
  children,
  initialIndex,
}: {
  children: React.ReactNode
  initialIndex: ProductCouponBadgeIndex
}) {
  const value = useMemo(() => ({ index: initialIndex }), [initialIndex])

  return (
    <CouponBadgeContext.Provider value={value}>
      {children}
    </CouponBadgeContext.Provider>
  )
}

export function useProductCouponBadge(
  sku: string | undefined | null,
  baseSku?: string | undefined | null
): ProductCouponBadge | null {
  const context = useContext(CouponBadgeContext)
  if (context === undefined) {
    return null
  }
  return lookupProductCouponBadge(context.index, sku, baseSku)
}
