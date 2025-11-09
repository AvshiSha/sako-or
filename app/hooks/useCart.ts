'use client'

import { useState, useEffect, useCallback } from 'react'
import { flushSync } from 'react-dom'

export interface CartItem {
  sku: string
  name: {
    en: string
    he: string
  }
  price: number
  salePrice?: number
  currency?: string
  image?: string
  size?: string
  color?: string
  quantity: number
  maxStock: number
}

export interface CartHook {
  items: CartItem[]
  addToCart: (item: Omit<CartItem, 'quantity'>) => void
  removeFromCart: (sku: string, size?: string, color?: string) => void
  updateQuantity: (sku: string, quantity: number, size?: string, color?: string) => void
  clearCart: () => void
  getTotalPrice: () => number
  getTotalItems: () => number
  getItemQuantity: (sku: string, size?: string, color?: string) => number
  getDeliveryFee: () => number
  getTotalWithDelivery: () => number
  loading: boolean
}

export function useCart(): CartHook {
  const [items, setItems] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)

  const normalizeCartItem = useCallback((item: CartItem): CartItem => {
    if (!item?.sku) return item

    let normalizedSku = item.sku

    if (item.size) {
      const sizeSuffix = `-${item.size}`
      if (normalizedSku.endsWith(sizeSuffix)) {
        normalizedSku = normalizedSku.slice(0, -sizeSuffix.length)
      }
    }

    if (item.color) {
      const colorSuffix = `-${item.color}`
      if (normalizedSku.endsWith(colorSuffix)) {
        normalizedSku = normalizedSku.slice(0, -colorSuffix.length)
      }
    }

    if (normalizedSku === item.sku) {
      return item
    }

    return {
      ...item,
      sku: normalizedSku
    }
  }, [])

  const areItemArraysEqual = useCallback((a: CartItem[], b: CartItem[]) => {
    if (a === b) return true
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
      const itemA = a[i]
      const itemB = b[i]
      if (
        itemA !== itemB &&
        (
          itemA.sku !== itemB.sku ||
          itemA.size !== itemB.size ||
          itemA.color !== itemB.color ||
          itemA.quantity !== itemB.quantity ||
          itemA.price !== itemB.price ||
          itemA.salePrice !== itemB.salePrice ||
          itemA.maxStock !== itemB.maxStock
        )
      ) {
        return false
      }
    }
    return true
  }, [])

  // Load cart from localStorage on mount
  useEffect(() => {
    try {
      const storedCart = localStorage.getItem('cart')
      if (storedCart) {
        const parsedItems: CartItem[] = JSON.parse(storedCart)
        const normalized = parsedItems.map(item => normalizeCartItem(item))
        setItems(normalized)
      }
    } catch (error) {
      console.error('Error loading cart:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  // Save cart to localStorage whenever items change
  useEffect(() => {
    if (!loading) {
      try {
        const normalizedItems = items.map(item => normalizeCartItem(item))
        const itemsToPersist = areItemArraysEqual(normalizedItems, items) ? items : normalizedItems

        localStorage.setItem('cart', JSON.stringify(itemsToPersist))
        // Dispatch custom event to notify other components
        window.dispatchEvent(new CustomEvent('cartUpdated', { detail: itemsToPersist }))
      } catch (error) {
        console.error('Error saving cart:', error)
      }
    }
  }, [items, loading, normalizeCartItem, areItemArraysEqual])

  // Listen for cart updates from other components
  useEffect(() => {
    const handleCartUpdate = (event: CustomEvent) => {
      const updatedItems: CartItem[] = Array.isArray(event.detail) ? event.detail : []
      const normalizedItems = updatedItems.map(item => normalizeCartItem(item))

      setItems(prev => {
        if (areItemArraysEqual(prev, normalizedItems)) {
          return prev
        }
        return normalizedItems
      })
    }

    window.addEventListener('cartUpdated', handleCartUpdate as EventListener)
    
    return () => {
      window.removeEventListener('cartUpdated', handleCartUpdate as EventListener)
    }
  }, [areItemArraysEqual, normalizeCartItem])

  const addToCart = useCallback((newItem: Omit<CartItem, 'quantity'>) => {
    flushSync(() => {
      setItems(prevItems => {
        const existingItemIndex = prevItems.findIndex(item => 
          item.sku === newItem.sku && 
          item.size === newItem.size && 
          item.color === newItem.color
        )

        if (existingItemIndex >= 0) {
          // Item exists, update quantity
          const updatedItems = [...prevItems]
          const existingItem = updatedItems[existingItemIndex]
          const newQuantity = existingItem.quantity + 1
          
          // Don't exceed max stock
          if (newQuantity <= existingItem.maxStock) {
            updatedItems[existingItemIndex] = {
              ...existingItem,
              quantity: newQuantity
            }
          }
          return updatedItems
        } else {
          // New item, add with quantity 1
          const newItems = [...prevItems, { ...newItem, quantity: 1 }]
          return newItems
        }
      })
    })
  }, [])

  const removeFromCart = useCallback((sku: string, size?: string, color?: string) => {
    setItems(prevItems => 
      prevItems.filter(item => 
        !(item.sku === sku && item.size === size && item.color === color)
      )
    )
  }, [])

  const updateQuantity = useCallback((sku: string, quantity: number, size?: string, color?: string) => {
    if (quantity <= 0) {
      removeFromCart(sku, size, color)
      return
    }

    setItems(prevItems => 
      prevItems.map(item => {
        if (item.sku === sku && item.size === size && item.color === color) {
          // Don't exceed max stock
          const newQuantity = Math.min(quantity, item.maxStock)
          return { ...item, quantity: newQuantity }
        }
        return item
      })
    )
  }, [removeFromCart])

  const clearCart = useCallback(() => {
    setItems([])
  }, [])

  const getTotalPrice = useCallback(() => {
    return items.reduce((total, item) => {
      const price = item.salePrice || item.price
      return total + (price * item.quantity)
    }, 0)
  }, [items])

  const getTotalItems = useCallback(() => {
    return items.reduce((total, item) => total + item.quantity, 0)
  }, [items])

  const getItemQuantity = useCallback((sku: string, size?: string, color?: string) => {
    const item = items.find(item => 
      item.sku === sku && item.size === size && item.color === color
    )
    return item ? item.quantity : 0
  }, [items])

  const getDeliveryFee = useCallback(() => {
    // Free shipping for test product SKU 0000-0002 (and any variants like 0000-0002-color-size)
    const hasTestProduct = items.some(item => {
      const sku = item.sku?.trim() || ''
      return sku === '0000-0002' || sku.startsWith('0000-0002-')
    })
    if (hasTestProduct) {
      return 0
    }
    
    // Calculate total directly to avoid dependency chain issues
    const total = items.reduce((sum, item) => {
      const price = item.salePrice || item.price
      return sum + (price * item.quantity)
    }, 0)
    
    return total < 300 ? 45 : 0
  }, [items])

  const getTotalWithDelivery = useCallback(() => {
    return getTotalPrice() + getDeliveryFee()
  }, [getTotalPrice, getDeliveryFee])

  return {
    items,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    getTotalPrice,
    getTotalItems,
    getItemQuantity,
    getDeliveryFee,
    getTotalWithDelivery,
    loading
  }
}
