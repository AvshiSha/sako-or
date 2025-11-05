'use client'

import { useState, useEffect, useCallback } from 'react'
import { flushSync } from 'react-dom'
import { FulfillmentMethod, CartFulfillmentState } from '../types/fulfillment'

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
  fulfillment: FulfillmentMethod
  setFulfillment: (method: FulfillmentMethod) => void
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
  const [fulfillment, setFulfillmentState] = useState<FulfillmentMethod>('delivery')
  const [loading, setLoading] = useState(true)

  // Load cart and fulfillment from localStorage on mount
  useEffect(() => {
    try {
      const storedCart = localStorage.getItem('cart')
      if (storedCart) {
        setItems(JSON.parse(storedCart))
      }
      
      const storedFulfillment = localStorage.getItem('cartFulfillment') as FulfillmentMethod | null
      if (storedFulfillment === 'delivery' || storedFulfillment === 'pickup') {
        setFulfillmentState(storedFulfillment)
      }
    } catch (error) {
      console.error('Error loading cart:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  // Save cart and fulfillment to localStorage whenever they change
  useEffect(() => {
    if (!loading) {
      try {
        localStorage.setItem('cart', JSON.stringify(items))
        localStorage.setItem('cartFulfillment', fulfillment)
        // Dispatch custom event to notify other components
        window.dispatchEvent(new CustomEvent('cartUpdated', { detail: items }))
      } catch (error) {
        console.error('Error saving cart:', error)
      }
    }
  }, [items, fulfillment, loading])

  // Listen for cart updates from other components
  useEffect(() => {
    const handleCartUpdate = (event: CustomEvent) => {
      setItems(event.detail)
    }

    window.addEventListener('cartUpdated', handleCartUpdate as EventListener)
    
    return () => {
      window.removeEventListener('cartUpdated', handleCartUpdate as EventListener)
    }
  }, [])

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

  const setFulfillment = useCallback((method: FulfillmentMethod) => {
    console.log('[useCart] setFulfillment called with method:', method);
    console.log('[useCart] Current fulfillment state before update:', fulfillment);
    // Use flushSync to ensure synchronous state update
    flushSync(() => {
      setFulfillmentState(method)
    })
    // Dispatch custom event to notify components of fulfillment change
    window.dispatchEvent(new CustomEvent('fulfillmentUpdated', { detail: method }))
    console.log('[useCart] setFulfillmentState called with:', method, 'and event dispatched');
  }, [fulfillment])

  const getDeliveryFee = useCallback(() => {
    const fee = fulfillment === 'pickup' ? 0 : (getTotalPrice() < 300 ? 45 : 0);
    console.log('[useCart] getDeliveryFee called - fulfillment:', fulfillment, 'total:', getTotalPrice(), 'fee:', fee);
    return fee;
  }, [fulfillment, getTotalPrice])

  const getTotalWithDelivery = useCallback(() => {
    return getTotalPrice() + getDeliveryFee()
  }, [getTotalPrice, getDeliveryFee])

  return {
    items,
    fulfillment,
    setFulfillment,
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
