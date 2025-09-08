'use client'

import { useState, useEffect, useCallback } from 'react'

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
  loading: boolean
}

export function useCart(): CartHook {
  const [items, setItems] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)

  // Load cart from localStorage on mount
  useEffect(() => {
    try {
      const storedCart = localStorage.getItem('cart')
      if (storedCart) {
        setItems(JSON.parse(storedCart))
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
        localStorage.setItem('cart', JSON.stringify(items))
      } catch (error) {
        console.error('Error saving cart:', error)
      }
    }
  }, [items, loading])

  const addToCart = useCallback((newItem: Omit<CartItem, 'quantity'>) => {
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
        return [...prevItems, { ...newItem, quantity: 1 }]
      }
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

  return {
    items,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    getTotalPrice,
    getTotalItems,
    getItemQuantity,
    loading
  }
}
