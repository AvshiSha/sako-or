import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildStorefrontCouponBadgeIndex,
  badgeIndexToRecord,
  getCouponSkuLists,
  isCouponStorefrontActive,
  lookupProductCouponBadge,
} from '../coupon-product-badges'
import type { Coupon } from '@prisma/client'

function makeCoupon(overrides: Partial<Coupon> = {}): Coupon {
  return {
    id: 'test-id',
    code: 'TEST',
    name_en: 'Test',
    name_he: 'בדיקה',
    description_en: null,
    description_he: null,
    discountType: 'percent_specific',
    discountValue: 10,
    minCartValue: 0,
    startDate: null,
    endDate: null,
    usageLimit: null,
    usageLimitPerUser: null,
    usageCount: 0,
    stackable: false,
    autoApply: false,
    eligibleProducts: [],
    eligibleCategories: [],
    bogoBuyQuantity: 1,
    bogoGetQuantity: 1,
    bogoEligibleSkus: [],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    bogoBuySkus: [],
    bogoGetSkus: [],
    ...overrides,
  }
}

describe('getCouponSkuLists', () => {
  it('returns eligibleProducts for percent_specific', () => {
    const lists = getCouponSkuLists(
      makeCoupon({ discountType: 'percent_specific', eligibleProducts: ['SKU-A'] })
    )
    assert.deepEqual(lists, ['SKU-A'])
  })

  it('returns empty for percent_all', () => {
    const lists = getCouponSkuLists(makeCoupon({ discountType: 'percent_all' }))
    assert.deepEqual(lists, [])
  })

  it('merges all SKU fields for bogo', () => {
    const lists = getCouponSkuLists(
      makeCoupon({
        discountType: 'bogo',
        eligibleProducts: ['A'],
        bogoBuySkus: ['B'],
        bogoGetSkus: ['C'],
        bogoEligibleSkus: ['D'],
      })
    )
    assert.deepEqual(lists, ['A', 'B', 'C', 'D'])
  })
})

describe('buildStorefrontCouponBadgeIndex', () => {
  it('indexes SKU in eligibleProducts', () => {
    const index = buildStorefrontCouponBadgeIndex([
      makeCoupon({ code: 'OUT10', eligibleProducts: ['sku-123'], discountValue: 10 }),
    ])
    const badge = index.get('sku-123')
    assert.ok(badge)
    assert.equal(badge?.code, 'OUT10')
    assert.equal(badge?.label.en, '10% OFF')
  })

  it('does not index category-only coupons', () => {
    const index = buildStorefrontCouponBadgeIndex([
      makeCoupon({
        code: 'CATONLY',
        eligibleProducts: [],
        eligibleCategories: ['women/shoes'],
      }),
    ])
    assert.equal(index.size, 0)
  })

  it('indexes only listed SKUs when both SKU and category are set', () => {
    const index = buildStorefrontCouponBadgeIndex([
      makeCoupon({
        code: 'MIXED',
        eligibleProducts: ['listed-sku'],
        eligibleCategories: ['women'],
      }),
    ])
    assert.equal(index.size, 1)
    assert.ok(index.get('listed-sku'))
    assert.equal(index.get('other-sku'), undefined)
  })

  it('indexes BOGO buy/get SKUs', () => {
    const index = buildStorefrontCouponBadgeIndex([
      makeCoupon({
        discountType: 'bogo',
        code: 'BOGO1',
        bogoBuySkus: ['buy-sku'],
        bogoGetSkus: ['get-sku'],
        discountValue: 100,
      }),
    ])
    assert.ok(index.get('buy-sku'))
    assert.ok(index.get('get-sku'))
    assert.equal(index.get('buy-sku')?.label.en, 'Buy 1, get 1 free')
  })

  it('keeps higher discountValue when multiple coupons match same SKU', () => {
    const index = buildStorefrontCouponBadgeIndex([
      makeCoupon({ code: 'LOW', eligibleProducts: ['same-sku'], discountValue: 10 }),
      makeCoupon({ code: 'HIGH', eligibleProducts: ['same-sku'], discountValue: 20 }),
    ])
    assert.equal(index.get('same-sku')?.code, 'HIGH')
    assert.equal(index.get('same-sku')?.label.en, '20% OFF')
  })

  it('normalizes SKU casing', () => {
    const index = buildStorefrontCouponBadgeIndex([
      makeCoupon({ code: 'CASE', eligibleProducts: ['SKU-ABC'] }),
    ])
    assert.ok(index.get('sku-abc'))
  })
})

describe('isCouponStorefrontActive', () => {
  const now = new Date('2026-05-18T12:00:00Z')

  it('returns false for inactive coupons', () => {
    assert.equal(isCouponStorefrontActive(makeCoupon({ isActive: false }), now), false)
  })

  it('returns false for expired coupons', () => {
    assert.equal(
      isCouponStorefrontActive(
        makeCoupon({ endDate: new Date('2026-05-01T00:00:00Z') }),
        now
      ),
      false
    )
  })

  it('returns false when usage limit is exhausted', () => {
    assert.equal(
      isCouponStorefrontActive(makeCoupon({ usageLimit: 5, usageCount: 5 }), now),
      false
    )
  })

  it('returns true for active in-range coupons', () => {
    assert.equal(
      isCouponStorefrontActive(
        makeCoupon({
          startDate: new Date('2026-05-01T00:00:00Z'),
          endDate: new Date('2026-06-01T00:00:00Z'),
        }),
        now
      ),
      true
    )
  })
})

describe('lookupProductCouponBadge', () => {
  const record = badgeIndexToRecord(
    buildStorefrontCouponBadgeIndex([
      makeCoupon({ code: 'OUT10', eligibleProducts: ['base-sku'], discountValue: 10 }),
    ])
  )

  it('looks up by sku', () => {
    assert.equal(lookupProductCouponBadge(record, 'base-sku')?.code, 'OUT10')
  })

  it('falls back to baseSku', () => {
    assert.equal(lookupProductCouponBadge(record, 'variant-sku', 'base-sku')?.code, 'OUT10')
  })

  it('returns null when not eligible', () => {
    assert.equal(lookupProductCouponBadge(record, 'unknown'), null)
  })
})
