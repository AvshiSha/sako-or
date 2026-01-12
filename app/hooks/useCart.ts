'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { flushSync } from 'react-dom'
import { useAuth } from '@/app/contexts/AuthContext'
import { buildCartKey } from '@/lib/cart'
import { productService } from '@/lib/firebase'

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
  const { user } = useAuth()
  const loadedFromNeonRef = useRef(false)

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
      if (storedCart && storedCart.trim()) {
        const parsedItems: CartItem[] = JSON.parse(storedCart)
        if (Array.isArray(parsedItems)) {
          const normalized = parsedItems.map(item => normalizeCartItem(item))
          setItems(normalized)
        } else {
          console.warn('Cart data is not an array, clearing...')
          localStorage.removeItem('cart')
        }
      }
    } catch (error) {
      console.error('Error loading cart, clearing corrupted data:', error)
      try {
        localStorage.removeItem('cart')
      } catch (clearError) {
        console.error('Failed to clear corrupted cart data:', clearError)
      }
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

        if (itemsToPersist.length === 0) {
          localStorage.removeItem('cart')
        } else {
          localStorage.setItem('cart', JSON.stringify(itemsToPersist))
        }
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

  // Load cart from Neon for signed-in users (Favorites-style hydration)
  useEffect(() => {
    let cancelled = false

    async function loadCartFromNeon() {
      if (!user) {
        loadedFromNeonRef.current = false
        return
      }

      // Only load once per sign-in session
      if (loadedFromNeonRef.current) return
      loadedFromNeonRef.current = true

      try {
        const token = await user.getIdToken()
        if (!token) return

        const response = await fetch('/api/cart', {
          headers: { Authorization: `Bearer ${token}` }
        })

        // 404 means user profile doesn't exist yet - that's OK
        if (response.status === 404) {
          console.log('[useCart] Profile not found yet (404) - keeping local cart')
          return
        }

        if (!response.ok) {
          console.warn('[useCart] Failed to load cart from Neon:', response.status)
          return
        }

        const data = await response.json()
        const cartRows = data.cartItems || []

        if (cartRows.length === 0) {
          if (!cancelled) {
            setItems([])
          }
          return
        }

        // Hydrate cart items from Firestore (same strategy as Favorites)
        const productCache = new Map<string, any>()
        const hydratedItems: CartItem[] = []

        for (const row of cartRows) {
          if (cancelled) return

          const { baseSku, colorSlug, sizeSlug, quantity, unitPrice } = row

          let product = productCache.get(baseSku)
          if (!product) {
            try {
              product = await productService.getProductByBaseSku(baseSku)
              if (!product) {
                product = await productService.getProductBySku(baseSku)
              }
            } catch (error) {
              console.error(`[useCart] Error fetching product ${baseSku}:`, error)
              product = null
            }
            productCache.set(baseSku, product)
          }

          if (!product || !product.isEnabled) continue

          // Get the specific color variant
          const variant = colorSlug && product.colorVariants?.[colorSlug]
          const stockBySize = variant?.stockBySize || {}
          const maxStock = sizeSlug ? (stockBySize[sizeSlug] || 0) : 
            Object.values(stockBySize).reduce((sum: number, stock: any) => sum + (stock || 0), 0)

          // Compute effective price from unitPrice snapshot
          const currentPrice = variant?.priceOverride || product.price
          const currentSalePrice = variant?.salePrice || product.salePrice
          const effectivePrice = unitPrice ? Number(unitPrice) : (currentSalePrice || currentPrice)
          
          // Determine if we should show as sale (unitPrice < currentPrice)
          const showAsSale = unitPrice && currentPrice && Number(unitPrice) < currentPrice

          hydratedItems.push({
            sku: baseSku,
            name: {
              en: product.title_en || '',
              he: product.title_he || ''
            },
            price: currentPrice,
            salePrice: showAsSale ? effectivePrice : (currentSalePrice || undefined),
            currency: product.currency || 'ILS',
            image: variant?.primaryImage || variant?.images?.[0] || '',
            size: sizeSlug || undefined,
            color: colorSlug || undefined,
            quantity: quantity,
            maxStock: maxStock
          })
        }

        if (!cancelled) {
          setItems(hydratedItems)
        }
      } catch (error) {
        console.error('[useCart] Error loading cart from Neon:', error)
      }
    }

    void loadCartFromNeon()

    return () => {
      cancelled = true
    }
  }, [user?.uid, normalizeCartItem])

  // Helper to sync cart item to Neon (fire-and-forget)
  const syncCartItemToNeon = useCallback(async (
    baseSku: string,
    colorSlug: string | undefined,
    sizeSlug: string | undefined,
    quantityDelta?: number,
    quantitySet?: number,
    unitPrice?: number
  ) => {
    if (!user) return

    try {
      const token = await user.getIdToken()
      if (!token) return

      const body: any = {
        baseSku,
        colorSlug: colorSlug || null,
        sizeSlug: sizeSlug || null
      }

      if (quantityDelta !== undefined) body.quantityDelta = quantityDelta
      if (quantitySet !== undefined) body.quantitySet = quantitySet
      if (unitPrice !== undefined) body.unitPrice = unitPrice

      // Fire-and-forget
      fetch('/api/cart/item', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(body)
      }).catch(err => {
        console.warn('[useCart] Failed to sync cart item to Neon (non-blocking):', err)
      })
    } catch (error) {
      console.warn('[useCart] Failed to get token for cart sync:', error)
    }
  }, [user])

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

    // Sync to Neon if signed in
    const unitPrice = newItem.salePrice ?? newItem.price
    void syncCartItemToNeon(newItem.sku, newItem.color, newItem.size, 1, undefined, unitPrice)
  }, [syncCartItemToNeon])

  const removeFromCart = useCallback((sku: string, size?: string, color?: string) => {
    setItems(prevItems => 
      prevItems.filter(item => 
        !(item.sku === sku && item.size === size && item.color === color)
      )
    )

    // Sync to Neon if signed in
    void syncCartItemToNeon(sku, color, size, undefined, 0, undefined)
  }, [syncCartItemToNeon])

  const updateQuantity = useCallback((sku: string, quantity: number, size?: string, color?: string) => {
    if (quantity <= 0) {
      removeFromCart(sku, size, color)
      return
    }

    let unitPrice: number | undefined
    setItems(prevItems => 
      prevItems.map(item => {
        if (item.sku === sku && item.size === size && item.color === color) {
          // Don't exceed max stock
          const newQuantity = Math.min(quantity, item.maxStock)
          unitPrice = item.salePrice ?? item.price
          return { ...item, quantity: newQuantity }
        }
        return item
      })
    )

    // Sync to Neon if signed in
    void syncCartItemToNeon(sku, color, size, undefined, quantity, unitPrice)
  }, [removeFromCart, syncCartItemToNeon])

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
