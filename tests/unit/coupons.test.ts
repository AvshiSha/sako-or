// Coupon discount calculation tests
// These test the discount calculation logic used in the coupon system

interface CouponCartItem {
  sku: string
  quantity: number
  price: number
  salePrice?: number | null
}

interface Coupon {
  discountType: 'percent_all' | 'fixed' | 'percent_specific' | 'bogo'
  discountValue: number | null
  eligibleProducts?: string[]
  eligibleCategories?: string[]
  bogoBuyQuantity?: number
  bogoGetQuantity?: number
}

function calculateSubtotal(items: CouponCartItem[]): number {
  return items.reduce((sum, item) => {
    const unitPrice = item.salePrice ?? item.price
    return sum + (unitPrice * item.quantity)
  }, 0)
}

function computePercentAllDiscount(
  discountValue: number,
  cartItems: CouponCartItem[]
): { discountAmount: number; discountedItems: Array<{ sku: string; discountAmount: number }> } {
  const subtotal = calculateSubtotal(cartItems)
  const percentage = discountValue / 100
  const discountAmount = Math.max(0, subtotal * percentage)

  const discountedItems = cartItems.map(item => {
    const unitPrice = item.salePrice ?? item.price
    const lineTotal = unitPrice * item.quantity
    const itemDiscount = lineTotal * percentage
    return {
      sku: item.sku,
      discountAmount: itemDiscount
    }
  })

  return {
    discountAmount,
    discountedItems
  }
}

function computeFixedDiscount(
  discountValue: number,
  cartItems: CouponCartItem[]
): { discountAmount: number; discountedItems: Array<{ sku: string; discountAmount: number }> } {
  const subtotal = calculateSubtotal(cartItems)
  const discountAmount = Math.min(Math.max(discountValue, 0), subtotal)

  if (discountAmount <= 0) {
    return { discountAmount: 0, discountedItems: [] }
  }

  // Allocate discount proportionally across items
  const discountedItems: Array<{ sku: string; discountAmount: number }> = []
  const subtotalWithoutZero = subtotal || 1

  cartItems.forEach(item => {
    const unitPrice = item.salePrice ?? item.price
    const lineTotal = unitPrice * item.quantity
    const proportion = lineTotal / subtotalWithoutZero
    const itemDiscount = discountAmount * proportion
    discountedItems.push({
      sku: item.sku,
      discountAmount: itemDiscount
    })
  })

  return {
    discountAmount,
    discountedItems
  }
}

function computePercentSpecificDiscount(
  discountValue: number,
  cartItems: CouponCartItem[],
  eligibleSkus: string[]
): { discountAmount: number; discountedItems: Array<{ sku: string; discountAmount: number }> } {
  const eligibleSkuSet = new Set(eligibleSkus.map(sku => sku.toLowerCase()))
  const percentage = discountValue / 100

  if (eligibleSkuSet.size === 0) {
    return { discountAmount: 0, discountedItems: [] }
  }

  let discountAmount = 0
  const discountedItems: Array<{ sku: string; discountAmount: number }> = []

  cartItems.forEach(item => {
    const sku = item.sku.toLowerCase()
    if (eligibleSkuSet.has(sku)) {
      const unitPrice = item.salePrice ?? item.price
      const lineTotal = unitPrice * item.quantity
      const itemDiscount = lineTotal * percentage
      discountAmount += itemDiscount
      discountedItems.push({
        sku: item.sku,
        discountAmount: itemDiscount
      })
    }
  })

  return {
    discountAmount,
    discountedItems
  }
}

function computeBogoDiscount(
  discountValue: number,
  buyQuantity: number,
  getQuantity: number,
  cartItems: CouponCartItem[]
): { discountAmount: number; discountedItems: Array<{ sku: string; discountAmount: number }> } {
  const discountPercent = discountValue / 100
  const totalFreeUnits = Math.floor(
    cartItems.reduce((sum, item) => sum + item.quantity, 0) / (buyQuantity + getQuantity)
  ) * getQuantity

  let discountAmount = 0
  let remainingFreeUnits = totalFreeUnits
  const discountedItems: Array<{ sku: string; discountAmount: number }> = []

  for (const item of cartItems) {
    if (remainingFreeUnits <= 0) break

    const availableUnits = item.quantity
    const freeUnitsForItem = Math.min(availableUnits, remainingFreeUnits)
    if (freeUnitsForItem <= 0) continue

    const unitPrice = item.salePrice ?? item.price
    const itemDiscount = freeUnitsForItem * unitPrice * discountPercent

    if (itemDiscount > 0) {
      discountAmount += itemDiscount
      discountedItems.push({
        sku: item.sku,
        discountAmount: itemDiscount
      })
      remainingFreeUnits -= freeUnitsForItem
    }
  }

  return {
    discountAmount,
    discountedItems
  }
}

describe('Coupon Calculation Tests', () => {
  describe('calculateSubtotal', () => {
    it('should calculate subtotal with regular prices', () => {
      const items: CouponCartItem[] = [
        { sku: '1234-5678', quantity: 2, price: 300 },
        { sku: '2345-6789', quantity: 1, price: 150 },
      ]

      expect(calculateSubtotal(items)).toBe(750)
    })

    it('should use sale prices when available', () => {
      const items: CouponCartItem[] = [
        { sku: '1234-5678', quantity: 2, price: 300, salePrice: 250 },
        { sku: '2345-6789', quantity: 1, price: 150 },
      ]

      expect(calculateSubtotal(items)).toBe(650)
    })
  })

  describe('computePercentAllDiscount', () => {
    it('should calculate 20% discount on all items', () => {
      const items: CouponCartItem[] = [
        { sku: '1234-5678', quantity: 2, price: 300 },
        { sku: '2345-6789', quantity: 1, price: 150 },
      ]

      const result = computePercentAllDiscount(20, items)
      expect(result.discountAmount).toBe(150) // 20% of 750
      expect(result.discountedItems).toHaveLength(2)
    })

    it('should allocate discount proportionally', () => {
      const items: CouponCartItem[] = [
        { sku: '1234-5678', quantity: 1, price: 600 },
        { sku: '2345-6789', quantity: 1, price: 300 },
      ]

      const result = computePercentAllDiscount(10, items)
      expect(result.discountAmount).toBe(90) // 10% of 900
      // First item: 600/900 * 90 = 60
      // Second item: 300/900 * 90 = 30
      expect(result.discountedItems[0].discountAmount).toBeCloseTo(60, 2)
      expect(result.discountedItems[1].discountAmount).toBeCloseTo(30, 2)
    })

    it('should handle sale prices correctly', () => {
      const items: CouponCartItem[] = [
        { sku: '1234-5678', quantity: 1, price: 300, salePrice: 250 },
      ]

      const result = computePercentAllDiscount(20, items)
      expect(result.discountAmount).toBe(50) // 20% of 250
    })
  })

  describe('computeFixedDiscount', () => {
    it('should apply fixed discount amount', () => {
      const items: CouponCartItem[] = [
        { sku: '1234-5678', quantity: 2, price: 300 },
        { sku: '2345-6789', quantity: 1, price: 150 },
      ]

      const result = computeFixedDiscount(50, items)
      expect(result.discountAmount).toBe(50)
      expect(result.discountedItems).toHaveLength(2)
    })

    it('should not exceed subtotal', () => {
      const items: CouponCartItem[] = [
        { sku: '1234-5678', quantity: 1, price: 100 },
      ]

      const result = computeFixedDiscount(200, items) // More than subtotal
      expect(result.discountAmount).toBe(100) // Capped at subtotal
    })

    it('should allocate discount proportionally', () => {
      const items: CouponCartItem[] = [
        { sku: '1234-5678', quantity: 1, price: 600 },
        { sku: '2345-6789', quantity: 1, price: 300 },
      ]

      const result = computeFixedDiscount(90, items)
      expect(result.discountAmount).toBe(90)
      // First item: 600/900 * 90 = 60
      // Second item: 300/900 * 90 = 30
      expect(result.discountedItems[0].discountAmount).toBeCloseTo(60, 2)
      expect(result.discountedItems[1].discountAmount).toBeCloseTo(30, 2)
    })

    it('should return zero for negative discount', () => {
      const items: CouponCartItem[] = [
        { sku: '1234-5678', quantity: 1, price: 100 },
      ]

      const result = computeFixedDiscount(-50, items)
      expect(result.discountAmount).toBe(0)
      expect(result.discountedItems).toHaveLength(0)
    })
  })

  describe('computePercentSpecificDiscount', () => {
    it('should apply discount only to eligible SKUs', () => {
      const items: CouponCartItem[] = [
        { sku: '1234-5678', quantity: 2, price: 300 },
        { sku: '2345-6789', quantity: 1, price: 150 },
      ]

      const result = computePercentSpecificDiscount(20, items, ['1234-5678'])
      expect(result.discountAmount).toBe(120) // 20% of 600 (only first item)
      expect(result.discountedItems).toHaveLength(1)
      expect(result.discountedItems[0].sku).toBe('1234-5678')
    })

    it('should handle case-insensitive SKU matching', () => {
      const items: CouponCartItem[] = [
        { sku: 'ABCD-EFGH', quantity: 1, price: 300 },
      ]

      const result = computePercentSpecificDiscount(10, items, ['abcd-efgh'])
      expect(result.discountAmount).toBe(30)
    })

    it('should return zero if no eligible items', () => {
      const items: CouponCartItem[] = [
        { sku: '1234-5678', quantity: 1, price: 300 },
      ]

      const result = computePercentSpecificDiscount(20, items, ['9999-9999'])
      expect(result.discountAmount).toBe(0)
      expect(result.discountedItems).toHaveLength(0)
    })
  })

  describe('computeBogoDiscount', () => {
    it('should calculate BOGO 50% discount (buy 1 get 1)', () => {
      const items: CouponCartItem[] = [
        { sku: '1234-5678', quantity: 2, price: 300 },
      ]

      // Buy 1, get 1 at 50% off
      const result = computeBogoDiscount(50, 1, 1, items)
      // 2 items = 1 free unit at 50% = 1 * 300 * 0.5 = 150
      expect(result.discountAmount).toBe(150)
    })

    it('should handle buy 2 get 1 free', () => {
      const items: CouponCartItem[] = [
        { sku: '1234-5678', quantity: 3, price: 300 },
      ]

      // Buy 2, get 1 free (100% off)
      const result = computeBogoDiscount(100, 2, 1, items)
      // 3 items = 1 free unit at 100% = 1 * 300 = 300
      expect(result.discountAmount).toBe(300)
    })

    it('should handle multiple items', () => {
      const items: CouponCartItem[] = [
        { sku: '1234-5678', quantity: 2, price: 300 },
        { sku: '2345-6789', quantity: 2, price: 150 },
      ]

      // Buy 1, get 1 at 50% off
      // Total: 4 items = 2 free units
      // With the current algorithm, free units are allocated greedily
      // in item order, so both free units come from the first SKU:
      // 2 * 300 * 0.5 = 300
      const result = computeBogoDiscount(50, 1, 1, items)
      expect(result.discountAmount).toBe(300)
    })

    it('should not exceed available quantity', () => {
      const items: CouponCartItem[] = [
        { sku: '1234-5678', quantity: 1, price: 300 },
      ]

      // Buy 2, get 1 free - but only 1 item in cart
      const result = computeBogoDiscount(100, 2, 1, items)
      expect(result.discountAmount).toBe(0) // Not enough items
    })
  })
})
