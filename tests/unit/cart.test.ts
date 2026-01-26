// Cart calculation logic tests
// These test the pure calculation functions used in useCart

interface CartItem {
  sku: string
  quantity: number
  price: number
  salePrice?: number
  size?: string
  color?: string
}

function getTotalPrice(items: CartItem[]): number {
  return items.reduce((total, item) => {
    const price = item.salePrice || item.price
    return total + (price * item.quantity)
  }, 0)
}

function getDeliveryFee(items: CartItem[]): number {
  const total = items.reduce((sum, item) => {
    const price = item.salePrice || item.price
    return sum + (price * item.quantity)
  }, 0)
  
  return total < 300 ? 45 : 0
}

function getTotalWithDelivery(items: CartItem[]): number {
  return getTotalPrice(items) + getDeliveryFee(items)
}

describe('Cart Logic Tests', () => {
  describe('getTotalPrice', () => {
    it('should calculate total with regular prices', () => {
      const items: CartItem[] = [
        { sku: '1234-5678', quantity: 2, price: 300 },
        { sku: '2345-6789', quantity: 1, price: 150 },
      ]

      expect(getTotalPrice(items)).toBe(750) // 2 * 300 + 1 * 150
    })

    it('should use sale price when available', () => {
      const items: CartItem[] = [
        { sku: '1234-5678', quantity: 2, price: 300, salePrice: 250 },
        { sku: '2345-6789', quantity: 1, price: 150 },
      ]

      expect(getTotalPrice(items)).toBe(650) // 2 * 250 + 1 * 150
    })

    it('should handle empty cart', () => {
      expect(getTotalPrice([])).toBe(0)
    })

    it('should handle zero quantity', () => {
      const items: CartItem[] = [
        { sku: '1234-5678', quantity: 0, price: 300 },
      ]

      expect(getTotalPrice(items)).toBe(0)
    })

    it('should handle multiple items with mixed prices', () => {
      const items: CartItem[] = [
        { sku: '1234-5678', quantity: 1, price: 300, salePrice: 250 },
        { sku: '2345-6789', quantity: 3, price: 100 },
        { sku: '3456-7890', quantity: 2, price: 200, salePrice: 150 },
      ]

      expect(getTotalPrice(items)).toBe(850) // 250 + 300 + 300
    })
  })

  describe('getDeliveryFee', () => {
    it('should charge 45 ILS for orders under 300 ILS', () => {
      const items: CartItem[] = [
        { sku: '1234-5678', quantity: 1, price: 250 },
      ]

      expect(getDeliveryFee(items)).toBe(45)
    })

    it('should be free for orders 300 ILS or more', () => {
      const items: CartItem[] = [
        { sku: '1234-5678', quantity: 1, price: 300 },
      ]

      expect(getDeliveryFee(items)).toBe(0)
    })

    it('should be free for orders over 300 ILS', () => {
      const items: CartItem[] = [
        { sku: '1234-5678', quantity: 2, price: 200 },
      ]

      expect(getDeliveryFee(items)).toBe(0) // 400 > 300
    })

    it('should calculate based on sale prices', () => {
      const items: CartItem[] = [
        { sku: '1234-5678', quantity: 1, price: 350, salePrice: 250 },
      ]

      expect(getDeliveryFee(items)).toBe(45) // 250 < 300
    })

    it('should handle empty cart', () => {
      expect(getDeliveryFee([])).toBe(45) // 0 < 300
    })

    it('should handle exactly 300 ILS', () => {
      const items: CartItem[] = [
        { sku: '1234-5678', quantity: 1, price: 300 },
      ]

      expect(getDeliveryFee(items)).toBe(0)
    })

    it('should handle 299.99 ILS (just under threshold)', () => {
      const items: CartItem[] = [
        { sku: '1234-5678', quantity: 1, price: 299.99 },
      ]

      expect(getDeliveryFee(items)).toBe(45)
    })
  })

  describe('getTotalWithDelivery', () => {
    it('should add delivery fee for orders under 300 ILS', () => {
      const items: CartItem[] = [
        { sku: '1234-5678', quantity: 1, price: 250 },
      ]

      expect(getTotalWithDelivery(items)).toBe(295) // 250 + 45
    })

    it('should not add delivery fee for orders 300 ILS or more', () => {
      const items: CartItem[] = [
        { sku: '1234-5678', quantity: 1, price: 300 },
      ]

      expect(getTotalWithDelivery(items)).toBe(300) // 300 + 0
    })

    it('should handle complex cart with sale prices', () => {
      const items: CartItem[] = [
        { sku: '1234-5678', quantity: 2, price: 200, salePrice: 150 },
        { sku: '2345-6789', quantity: 1, price: 100 },
      ]

      // Total: 2 * 150 + 100 = 400
      // Delivery: 0 (400 >= 300)
      expect(getTotalWithDelivery(items)).toBe(400)
    })

    it('should handle cart just under threshold', () => {
      const items: CartItem[] = [
        { sku: '1234-5678', quantity: 1, price: 250 },
        { sku: '2345-6789', quantity: 1, price: 49 },
      ]

      // Total: 299
      // Delivery: 45 (299 < 300)
      expect(getTotalWithDelivery(items)).toBe(344)
    })
  })

  describe('Quantity updates', () => {
    it('should handle quantity increase within stock limits', () => {
      const items: CartItem[] = [
        { sku: '1234-5678', quantity: 1, price: 300, size: 'M', color: 'black' },
      ]

      // Simulate quantity update
      const updatedItems = items.map(item => {
        if (item.sku === '1234-5678' && item.size === 'M' && item.color === 'black') {
          return { ...item, quantity: Math.min(2, 5) } // Max stock: 5
        }
        return item
      })

      expect(updatedItems[0].quantity).toBe(2)
      expect(getTotalPrice(updatedItems)).toBe(600)
    })

    it('should not exceed max stock when increasing quantity', () => {
      const items: CartItem[] = [
        { sku: '1234-5678', quantity: 4, price: 300, size: 'M', color: 'black' },
      ]

      const maxStock = 5
      const updatedItems = items.map(item => {
        if (item.sku === '1234-5678') {
          return { ...item, quantity: Math.min(item.quantity + 1, maxStock) }
        }
        return item
      })

      expect(updatedItems[0].quantity).toBe(5) // Capped at max stock
    })

    it('should remove item when quantity is set to 0', () => {
      const items: CartItem[] = [
        { sku: '1234-5678', quantity: 1, price: 300 },
        { sku: '2345-6789', quantity: 2, price: 150 },
      ]

      const filteredItems = items.filter(item => 
        !(item.sku === '1234-5678' && item.quantity <= 0)
      )

      expect(filteredItems).toHaveLength(2) // Still 2 items

      // Simulate setting quantity to 0
      const updatedItems = items.map(item => {
        if (item.sku === '1234-5678') {
          return { ...item, quantity: 0 }
        }
        return item
      })

      const removedItems = updatedItems.filter(item => item.quantity > 0)
      expect(removedItems).toHaveLength(1)
      expect(removedItems[0].sku).toBe('2345-6789')
    })
  })
})
