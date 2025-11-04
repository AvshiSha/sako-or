'use client'

import { useState, useEffect } from 'react'
import { X, Plus, Minus, ShoppingBag } from 'lucide-react'
import Image from 'next/image'
import { useCart } from '../hooks/useCart'
import { useToast } from './Toast'
import { trackAddToCart as trackAddToCartEvent } from '@/lib/dataLayer'

interface Product {
  sku?: string
  name?: { en: string; he: string }
  price: number
  salePrice?: number
  currency?: string
  images?: Array<{ 
    url: string; 
    alt?: string | { en: string; he: string } 
  }>
  sizes?: string[]
  colors?: string[]
  stockBySize?: Record<string, number>
  stock?: number
  variants?: Array<{
    size?: string
    color?: string
    stock: number
  }>
  categories_path?: string[]
  category?: string
  brand?: string
}

interface AddToCartModalProps {
  isOpen: boolean
  onClose: () => void
  product: Product | null
  lng: string
}

export default function AddToCartModal({ isOpen, onClose, product, lng }: AddToCartModalProps) {
  const [selectedSize, setSelectedSize] = useState<string>('')
  const [selectedColor, setSelectedColor] = useState<string>('')
  const [quantity, setQuantity] = useState(1)
  const [isAddingToCart, setIsAddingToCart] = useState(false)
  
  const { addToCart } = useCart()
  const { showToast } = useToast()

  // Reset form when modal opens/closes or product changes
  useEffect(() => {
    if (isOpen && product) {
      setSelectedSize('')
      setSelectedColor('')
      setQuantity(1)
    }
  }, [isOpen, product])

  // Get available sizes and colors (safe to call even if product is null)
  const availableSizes = product?.sizes || []
  const availableColors = product?.colors || []

  // Get current stock for selected size (safe to call even if product is null)
  const getCurrentStock = () => {
    if (!product) return 0
    if (product.stockBySize && selectedSize && product.stockBySize[selectedSize] !== undefined) {
      return product.stockBySize[selectedSize]
    }
    if (product.variants) {
      const variant = product.variants.find(v =>
        (!selectedSize || v.size === selectedSize) && (!selectedColor || v.color === selectedColor)
      )
      return variant ? variant.stock : 0
    }
    return product.stock || 0
  }

  const currentStock = getCurrentStock()
  const isOutOfStock = currentStock <= 0

  // Adjust quantity if it exceeds stock
  useEffect(() => {
    if (quantity > currentStock && currentStock > 0) {
      setQuantity(currentStock)
    }
  }, [currentStock, quantity])

  const handleAddToCart = async () => {
    if (isOutOfStock || isAddingToCart || !product?.sku || !product?.name) return
    
    setIsAddingToCart(true)

    try {
      // Track add_to_cart for GA4 data layer
      try {
        const itemName = product!.name?.[lng as 'en' | 'he'] || 'Unknown Product'
        const itemId = product!.sku || 'unknown'
        const price = product!.salePrice || product!.price
        const categories = product!.categories_path || (product!.category ? [product!.category] : ['Unknown'])
        const variant = [selectedSize, selectedColor].filter(Boolean).join('-') || undefined
        
        trackAddToCartEvent(
          [{
            name: itemName,
            id: itemId,
            price: price,
            brand: product!.brand,
            categories: categories,
            variant: variant,
            quantity: quantity
          }],
          product!.currency || 'ILS'
        )
      } catch (dataLayerError) {
        console.warn('Data layer tracking error:', dataLayerError)
      }

      // Add multiple items if quantity > 1
      for (let i = 0; i < quantity; i++) {
        addToCart({
          sku: product!.sku,
          name: product!.name,
          price: product!.price,
          salePrice: product!.salePrice,
          currency: product!.currency,
          image: product!.images?.[0]?.url,
          size: selectedSize || undefined,
          color: selectedColor || undefined,
          maxStock: currentStock
        })
      }

      const successMessage = lng === 'he'
        ? `הוספת ${quantity} ${quantity === 1 ? 'פריט' : 'פריטים'} לעגלה`
        : `Added ${quantity} ${quantity === 1 ? 'item' : 'items'} to cart`
      
      showToast(successMessage, 'success')
      onClose()
    } catch (error) {
      console.error('Error adding to cart:', error)
      const errorMessage = lng === 'he' ? 'שגיאה בהוספה לעגלה' : 'Error adding to cart'
      showToast(errorMessage, 'error')
    } finally {
      setTimeout(() => {
        setIsAddingToCart(false)
      }, 1000)
    }
  }

  const translations = {
    en: {
      addToCart: 'Add to Cart',
      size: 'Size',
      color: 'Color',
      quantity: 'Quantity',
      outOfStock: 'Out of Stock',
      selectSize: 'Select Size',
      selectColor: 'Select Color',
      addingToCart: 'Adding to Cart...',
      close: 'Close'
    },
    he: {
      addToCart: 'הוסף לעגלה',
      size: 'מידה',
      color: 'צבע',
      quantity: 'כמות',
      outOfStock: 'אזל מהמלאי',
      selectSize: 'בחר מידה',
      selectColor: 'בחר צבע',
      addingToCart: 'מוסיף לעגלה...',
      close: 'סגור'
    }
  }

  const t = translations[lng as 'en' | 'he']

  return (
    <>
      {isOpen && product && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            {t.addToCart}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Product Info */}
          <div className="flex space-x-4">
            {product.images?.[0] && (
              <Image
                src={product.images[0].url}
                alt={
                  typeof product.images[0].alt === 'string' 
                    ? product.images[0].alt 
                    : product.images[0].alt?.[lng as 'en' | 'he'] || product.name?.[lng as 'en' | 'he'] || 'Product'
                }
                width={80}
                height={80}
                className="w-20 h-20 object-cover rounded-md"
              />
            )}
            <div className="flex-1">
              <h3 className="font-medium text-gray-900">
                {product.name?.[lng as 'en' | 'he'] || 'Product'}
              </h3>
              <div className="mt-1 flex items-center space-x-2">
                <span className="text-lg font-bold text-gray-900">
                  ₪{(product.salePrice || product.price).toFixed(2)}
                </span>
                {product.salePrice && product.salePrice < product.price && (
                  <span className="text-sm text-gray-500 line-through">
                    ₪{product.price.toFixed(2)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Size Selection */}
          {availableSizes.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t.size}
              </label>
              <div className="grid grid-cols-4 gap-2">
                {availableSizes.map((size) => {
                  const sizeStock = product.stockBySize?.[size] || 0
                  const isSizeOutOfStock = sizeStock <= 0
                  
                  return (
                    <button
                      key={size}
                      onClick={() => setSelectedSize(size)}
                      disabled={isSizeOutOfStock}
                      className={`p-2 text-sm border text-gray-700 border-gray-600 rounded-md transition-colors hover:border-gray-700 hover:bg-gray-100 ${
                        selectedSize === size
                          ? 'border-indigo-500 bg-indigo-50 text-black-700'
                          : isSizeOutOfStock
                          ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      {size}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Color Selection */}
          {availableColors.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t.color}
              </label>
              <div className="grid grid-cols-4 gap-2">
                {availableColors.map((color) => (
                  <button
                    key={color}
                    onClick={() => setSelectedColor(color)}
                    className={`p-2 text-sm text-gray-700 border-gray-600 border rounded-md transition-colors hover:border-gray-700 hover:bg-gray-100 ${
                      selectedColor === color
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    {color}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quantity Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t.quantity}
            </label>
            <div className="flex items-center space-x-3">
              <div className="flex items-center border border-gray-300 rounded-md border-gray-600">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="p-2 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={quantity <= 1}
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="px-3 py-2 text-gray-700 text-sm font-medium min-w-[3rem] text-center">
                  {quantity}
                </span>
                <button
                  onClick={() => setQuantity(Math.min(10, quantity + 1))}
                  className="p-2 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={quantity >= Math.min(10, currentStock)}
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <span className="text-sm text-gray-500">
                {currentStock > 0 ? `${currentStock} ${lng === 'he' ? 'זמין' : 'available'}` : t.outOfStock}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex space-x-3 p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="flex-1 py-2 px-4 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
          >
            {t.close}
          </button>
          <button
            onClick={handleAddToCart}
            disabled={isOutOfStock || isAddingToCart || (availableSizes.length > 0 && !selectedSize)}
            className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors flex items-center justify-center ${
              isOutOfStock || isAddingToCart || (availableSizes.length > 0 && !selectedSize)
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-indigo-600 text-white hover:bg-indigo-700'
            }`}
          >
            {isAddingToCart ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                {t.addingToCart}
              </>
            ) : (
              <>
                <ShoppingBag className="h-4 w-4 mr-2" />
                {t.addToCart}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
      )}
    </>
  )
}
