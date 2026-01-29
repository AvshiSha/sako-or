'use client'

import { Fragment, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { HeartIcon } from '@heroicons/react/24/outline'
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Product, ColorVariant, productHelpers } from '@/lib/firebase'
import { useFavorites } from '@/app/hooks/useFavorites'
import { useCart } from '@/app/hooks/useCart'
import Toast, { useToast } from '@/app/components/Toast'
import { trackAddToCart as trackAddToCartEvent } from '@/lib/dataLayer'
import { getColorName } from '@/lib/colors'
import { buildFavoriteKey } from '@/lib/favorites'

interface QuickBuyDrawerProps {
  isOpen: boolean
  onClose: () => void
  product: Product
  language?: 'en' | 'he'
  returnUrl?: string
}

export default function QuickBuyDrawer({ isOpen, onClose, product, language = 'en', returnUrl }: QuickBuyDrawerProps) {
  const [selectedVariant, setSelectedVariant] = useState<ColorVariant | null>(null)
  const [selectedSize, setSelectedSize] = useState<string>('')
  const [quantity, setQuantity] = useState(1)
  const [isAddingToCart, setIsAddingToCart] = useState(false)
  const router = useRouter()
  const { isFavorite, toggleFavorite } = useFavorites()
  const { addToCart, items } = useCart()
  const { toast, showToast, hideToast } = useToast()
  
  // Get the first active color variant for display
  const defaultVariant = product.colorVariants 
    ? Object.values(product.colorVariants).find(v => v.isActive !== false) || null
    : null
  const activeVariant = selectedVariant || defaultVariant
  
  if (!activeVariant) {
    return null
  }

  // Get current price (variant price takes precedence)
  const getCurrentPrice = () => {
    // First check for variant-specific sale price
    if (activeVariant.salePrice) return activeVariant.salePrice
    // Then check for product-level sale price
    if (product.salePrice) return product.salePrice
    // Then check for variant price override
    if ('priceOverride' in activeVariant && activeVariant.priceOverride) return activeVariant.priceOverride
    return product.price
  }

  // Get original price (without any sale price)
  const getOriginalPrice = () => {
    if ('priceOverride' in activeVariant && activeVariant.priceOverride) return activeVariant.priceOverride
    return product.price
  }

  // Check if there's any sale price (variant or product level)
  const hasSalePrice = () => {
    return activeVariant.salePrice || product.salePrice
  }

  // Get the sale price (variant takes precedence over product)
  const getSalePrice = () => {
    return activeVariant.salePrice || product.salePrice
  }

  const currentPrice = getCurrentPrice()
  const originalPrice = getOriginalPrice()
  const salePrice = getSalePrice()
  const productName = productHelpers.getField(product, 'name', language)
  
  // Get primary image from the active variant
  const primaryImage = ('primaryImage' in activeVariant && activeVariant.primaryImage) || activeVariant.images?.[0]
  
  // Get available sizes for the active variant (only sizes with stock > 0)
  const availableSizes = 'stockBySize' in activeVariant 
    ? Object.entries(activeVariant.stockBySize).filter(([_, stock]) => stock > 0).map(([size, _]) => ({ size, stock: activeVariant.stockBySize[size] }))
    : []
  
  // Check if the active variant is out of stock (no available sizes)
  const isVariantOutOfStock = availableSizes.length === 0
  
  // Handle color variant selection
  const handleVariantSelect = (variant: any) => {
    setSelectedVariant(variant)
    setSelectedSize('') // Reset size selection when color changes
  }
  
  // Handle size selection
  const handleSizeSelect = (size: string) => {
    setSelectedSize(size)
    setQuantity(1) // Reset quantity when size changes
  }
  
  // Handle wishlist toggle
  const handleWishlistToggle = () => {
    const baseSku = product.baseSku || product.sku || ''
    const colorSlug = activeVariant?.colorSlug || ''
    const favoriteKey = buildFavoriteKey(baseSku, colorSlug)
    if (favoriteKey) {
      void toggleFavorite(favoriteKey)
    }
  }
  
  // Handle add to cart
  const handleAddToCart = async () => {
    if (isAddingToCart) return
    
    const sku = product.baseSku || product.sku || ''
    if (!sku) {
      console.error('No SKU found for product')
      return
    }
    
    // Check if variant is out of stock
    if (isVariantOutOfStock) {
      const errorMessage = language === 'he' 
        ? 'פריט זה אזל מהמלאי'
        : 'This item is out of stock'
      showToast(errorMessage, 'error')
      return
    }
    
    // Check if size is required but not selected
    if (availableSizes.length > 0 && !selectedSize) {
      return
    }
    
    setIsAddingToCart(true)
    
    try {
      // Get stock for selected size, or total stock if no size selected
      const maxStock = selectedSize 
        ? ('stockBySize' in activeVariant ? activeVariant.stockBySize[selectedSize] || 0 : 0)
        : ('stockBySize' in activeVariant ? Object.values(activeVariant.stockBySize).reduce((total, stock) => total + stock, 0) : 0)
      
      const resolvedSalePrice = salePrice && salePrice > 0 ? salePrice : undefined
      const cartItem = {
        sku: sku,
        name: {
          en: productHelpers.getField(product, 'name', 'en') || product.title_en || '',
          he: productHelpers.getField(product, 'name', 'he') || product.title_he || ''
        },
        price: originalPrice,
        salePrice: resolvedSalePrice && resolvedSalePrice < originalPrice ? resolvedSalePrice : undefined,
        currency: 'ILS',
        image: typeof primaryImage === 'string' ? primaryImage : primaryImage?.url,
        color: activeVariant.colorSlug,
        size: selectedSize || undefined,
        maxStock: maxStock
      }
      
      // Track add_to_cart for GA4 data layer
      try {
        const itemName = productHelpers.getField(product, 'name', language as 'en' | 'he') || product.title_en || product.title_he || 'Unknown Product'
        const itemId = sku
        const categories = product.categories_path || [product.category || 'Unknown']
        const variant = selectedSize ? `${selectedSize}-${activeVariant.colorSlug}` : activeVariant.colorSlug
        
        trackAddToCartEvent(
          [{
            name: itemName,
            id: itemId,
            price: currentPrice,
            brand: product.brand,
            categories: categories,
            variant: variant,
            quantity: quantity
          }],
          product.currency || 'ILS'
        )
      } catch (dataLayerError) {
        console.warn('Data layer tracking error:', dataLayerError)
      }
      
      addToCart(cartItem, quantity)
      
      // Show success toast
      const successMessage = language === 'he' 
        ? `הוספת ${quantity} ${quantity === 1 ? 'פריט' : 'פריטים'} לעגלה` 
        : `Added ${quantity} ${quantity === 1 ? 'item' : 'items'} to cart`
      showToast(successMessage, 'success')
      
      // Close the drawer
      onClose()
      
      // Navigate only when returnUrl is explicitly provided (e.g. favorites page).
      // When undefined (e.g. home carousel), stay on current page.
      if (returnUrl) {
        router.push(returnUrl)
      }
    } catch (error: any) {
      console.error('Error adding to cart:', error)
      
      // Show error message to user
      let errorMessage = language === 'he' 
        ? 'שגיאה בהוספה לעגלה'
        : 'Error adding to cart'
      
      // Check if error has a specific message
      if (error?.message) {
        errorMessage = error.message
      } else if (error?.error && typeof error.error === 'string') {
        errorMessage = error.error
      }
      
      showToast(errorMessage, 'error')
    } finally {
      setIsAddingToCart(false)
    }
  }

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog 
        as="div" 
        className="relative z-[70]" 
        onClose={onClose}
      >
         <Transition.Child
           as={Fragment}
           enter="ease-in-out duration-700"
           enterFrom="opacity-0"
           enterTo="opacity-100"
           leave="ease-in-out duration-700"
           leaveFrom="opacity-100"
           leaveTo="opacity-0"
         >
         <div className="fixed inset-0 bg-black/20 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
              <Transition.Child
                as={Fragment}
                enter="transform transition ease-in-out duration-700 sm:duration-1000"
                enterFrom="translate-x-full"
                enterTo="translate-x-0"
                leave="transform transition ease-in-out duration-700 sm:duration-1000"
                leaveFrom="translate-x-0"
                leaveTo="translate-x-full"
              >
                <Dialog.Panel className="pointer-events-auto w-screen max-w-md">
                  <div className="flex h-full flex-col overflow-y-scroll bg-white shadow-xl">
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                      <h2 className="text-lg font-semibold text-gray-900">{language === 'he' ? product.title_he : product.title_en}</h2>
                      <div className="flex items-center gap-3">
                        {/* Heart Icon */}
                        <button
                          onClick={handleWishlistToggle}
                          className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                        >
                          {isFavorite(
                            (() => {
                              const baseSku = product.baseSku || product.sku || ''
                              const colorSlug = activeVariant?.colorSlug || ''
                              return buildFavoriteKey(baseSku, colorSlug)
                            })()
                          ) ? (
                            <HeartSolidIcon className="h-5 w-5 text-red-500" />
                          ) : (
                            <HeartIcon className="h-5 w-5 text-gray-600" />
                          )}
                        </button>
                        {/* Close Button */}
                        <button
                          type="button"
                          className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                          onClick={onClose}
                        >
                          <span className="sr-only">Close</span>
                          <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                        </button>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 px-6 py-6">
                      {/* Price */}
                      <div className="mb-6">
                        {hasSalePrice() && salePrice && salePrice < originalPrice ? (
                          <div>
                            <div className="text-2xl font-bold text-red-600">
                              ₪{(salePrice * quantity).toFixed(2)}
                            </div>
                            <div className="text-lg text-gray-500 line-through">
                              ₪{(originalPrice * quantity).toFixed(2)}
                            </div>
                            {quantity > 1 && (
                              <div className="text-sm text-gray-500 mt-1">
                                {language === 'he' 
                                  ? `${quantity} × ₪${salePrice.toFixed(2)} = ₪${(salePrice * quantity).toFixed(2)}`
                                  : `${quantity} × ₪${salePrice.toFixed(2)} = ₪${(salePrice * quantity).toFixed(2)}`
                                }
                              </div>
                            )}
                          </div>
                        ) : (
                          <div>
                            <div className="text-2xl font-bold text-gray-900">
                              ₪{(currentPrice * quantity).toFixed(2)}
                            </div>
                            {quantity > 1 && (
                              <div className="text-sm text-gray-500 mt-1">
                                {language === 'he' 
                                  ? `${quantity} × ₪${currentPrice.toFixed(2)} = ₪${(currentPrice * quantity).toFixed(2)}`
                                  : `${quantity} × ₪${currentPrice.toFixed(2)} = ₪${(currentPrice * quantity).toFixed(2)}`
                                }
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Color Selection */}
                      {product.colorVariants && Object.values(product.colorVariants).filter(v => v.isActive !== false).length >= 1 && (
                        <div className="mb-8">
                            <div className={`flex items-center justify-between mb-4 ${language === 'he' ? 'flex-row-reverse' : ''}`}>
                              <h3 className={`text-sm font-medium text-gray-900`}>
                              {language === 'he' ? 'צבע' : 'Color'}: {getColorName(activeVariant.colorSlug, language)}
                            </h3>
                          </div>
                          <div className="flex gap-3">
                            {Object.values(product.colorVariants)
                              .filter(variant => variant.isActive !== false)
                              .map((variant) => {
                              const variantImage = variant.primaryImage || variant.images?.[0]
                              const isSelected = variant.colorSlug === activeVariant.colorSlug
                              
                              return (
                                <button
                                  key={variant.colorSlug}
                                  onClick={() => handleVariantSelect(variant)}
                                  className="flex-shrink-0 relative group"
                                  title={variant.colorSlug}
                                >
                                  {/* Product image thumbnail */}
                                  {variantImage && (
                                    <div className={`w-12 h-12 rounded-lg overflow-hidden border-2 transition-all duration-200 ${
                                      isSelected 
                                        ? 'border-black' 
                                        : 'border-gray-200 hover:border-gray-400'
                                    }`}>
                                      <Image
                                        src={variantImage}
                                        alt={variant.colorSlug}
                                        width={48}
                                        height={48}
                                        className="w-full h-full object-cover"
                                      />
                                    </div>
                                  )}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* Size Selection */}
                      {availableSizes.length > 0 && (
                        <div className="mb-8">
                          <div className="flex items-center justify-between mb-4">
                            <h3 className={`text-sm font-medium text-gray-900 ${language === 'he' ? 'ml-auto text-right' : ''}`}>
                              {language === 'he' ? 'מידה' : 'Size'}
                            </h3>
                          </div>
                          <div className="grid grid-cols-4 gap-2">
                            {availableSizes.map((sizeObj) => {
                              const isSelected = selectedSize === sizeObj.size
                              const isOutOfStock = sizeObj.stock <= 0
                              
                              return (
                                <button
                                  key={sizeObj.size}
                                  onClick={() => handleSizeSelect(sizeObj.size)}
                                  disabled={isOutOfStock}
                                  className={`p-2 text-sm text-gray-900 border rounded-md transition-colors ${
                                    isSelected
                                      ? 'border-[#856D55] bg-[#856D55] text-white'
                                      : isOutOfStock
                                      ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                                      : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                                  }`}
                                >
                                  {sizeObj.size}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* Out of Stock Message */}
                      {isVariantOutOfStock && (
                        <div className="mb-8">
                          <div className="bg-red-50 border border-red-200 rounded-md p-4">
                            <p className={`text-sm text-red-800 ${language === 'he' ? 'text-right' : ''}`}>
                              {language === 'he' ? 'צבע זה אזל מהמלאי' : 'This color is out of stock'}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Quantity Selection based on the size the user chose*/}
                      {selectedSize && availableSizes.length > 0 && (
                        <div className="mb-8">
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-medium text-gray-900">
                              {language === 'he' ? 'כמות' : 'Quantity'}
                            </h3>
                            <span className="text-xs text-gray-500">
                              {language === 'he' 
                                ? `מקסימום ${availableSizes.find(s => s.size === selectedSize)?.stock || 0} יחידות`
                                : `Max ${availableSizes.find(s => s.size === selectedSize)?.stock || 0} units`
                              }
                            </span>
                          </div>
                          <div className="flex items-center space-x-3">
                            <button
                              onClick={() => setQuantity(Math.max(1, quantity - 1))}
                              disabled={quantity <= 1}
                              className="p-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <svg className="h-4 w-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                              </svg>
                            </button>
                            <span className="text-lg font-medium min-w-[2rem] text-center text-gray-900">{quantity}</span>
                            <button
                              onClick={() => {
                                const maxStock = availableSizes.find(s => s.size === selectedSize)?.stock || 0
                                setQuantity(Math.min(quantity + 1, maxStock))
                              }}
                              disabled={quantity >= (availableSizes.find(s => s.size === selectedSize)?.stock || 0)}
                              className="p-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <svg className="h-4 w-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="space-y-3">
                        {/* Add to Shopping Cart Button */}
                        <button
                          onClick={handleAddToCart}
                          disabled={isVariantOutOfStock || (availableSizes.length > 0 && !selectedSize) || isAddingToCart}
                          className={`w-full font-medium py-3 px-4 transition-colors duration-200 ${
                            isVariantOutOfStock || (availableSizes.length > 0 && !selectedSize) || isAddingToCart
                              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                              : 'bg-[#856D55] text-white hover:bg-[#856D55]'
                          }`}
                        >
                          {isAddingToCart ? (
                            language === 'he' ? 'מוסיף לעגלה...' : 'Adding to Cart...'
                          ) : isVariantOutOfStock ? (
                            language === 'he' ? 'אזל מהמלאי' : 'Out of Stock'
                          ) : (
                            language === 'he' 
                              ? `הוסף ${quantity} ${quantity === 1 ? 'פריט' : 'פריטים'} לעגלה`
                              : `Add ${quantity} ${quantity === 1 ? 'Item' : 'Items'} to Cart`
                          )}
                        </button>
                        
                        {/* More Details Button */}
                        <Link
                          href={`/${language}/product/${product.baseSku}/${activeVariant.colorSlug}`}
                          onClick={onClose}
                          className="w-full border border-black bg-white text-black font-medium py-3 px-4 hover:bg-gray-50 transition-colors duration-200 text-center block"
                        >
                          {language === 'he' ? 'פרטים נוספים' : 'More Details'}
                        </Link>
                      </div>
                    </div>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </div>
      </Dialog>
      
      {/* Toast Notification */}
      <Toast
        message={toast.message}
        isVisible={toast.isVisible}
        onClose={hideToast}
        duration={5000}
        type={toast.type}
      />
    </Transition.Root>
  )
}
