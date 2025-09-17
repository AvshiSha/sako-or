'use client'

import { Fragment, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { HeartIcon } from '@heroicons/react/24/outline'
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid'
import Image from 'next/image'
import Link from 'next/link'
import { Product, ColorVariant } from '@/lib/firebase'
import { useFavorites } from '@/app/hooks/useFavorites'
import { useCart } from '@/app/hooks/useCart'

interface QuickBuyDrawerProps {
  isOpen: boolean
  onClose: () => void
  product: Product
  language?: 'en' | 'he'
}

export default function QuickBuyDrawer({ isOpen, onClose, product, language = 'en' }: QuickBuyDrawerProps) {
  const [selectedVariant, setSelectedVariant] = useState<ColorVariant | null>(null)
  const [selectedSize, setSelectedSize] = useState<string>('')
  const { isFavorite, toggleFavorite } = useFavorites()
  const { addToCart } = useCart()
  
  // Get the first active color variant for display
  const defaultVariant = product.colorVariants ? Object.values(product.colorVariants)[0] : null
  const activeVariant = selectedVariant || defaultVariant
  
  if (!activeVariant) {
    return null
  }

  // Get current price (variant price takes precedence)
  const getCurrentPrice = () => {
    if (activeVariant.salePrice) return activeVariant.salePrice
    if ('priceOverride' in activeVariant && activeVariant.priceOverride) return activeVariant.priceOverride
    return product.price
  }

  const currentPrice = getCurrentPrice()
  const productName = product.name?.[language] || product.name?.en || 'Unnamed Product'
  
  // Get primary image from the active variant
  const primaryImage = ('primaryImage' in activeVariant && activeVariant.primaryImage) || activeVariant.images?.[0]
  
  // Get available sizes for the active variant (only sizes with stock > 0)
  const availableSizes = 'stockBySize' in activeVariant 
    ? Object.entries(activeVariant.stockBySize).filter(([_, stock]) => stock > 0).map(([size, _]) => ({ size, stock: activeVariant.stockBySize[size] }))
    : []
  
  // Handle color variant selection
  const handleVariantSelect = (variant: any) => {
    setSelectedVariant(variant)
    setSelectedSize('') // Reset size selection when color changes
  }
  
  // Handle size selection
  const handleSizeSelect = (size: string) => {
    setSelectedSize(size)
  }
  
  // Handle wishlist toggle
  const handleWishlistToggle = () => {
    const sku = product.baseSku || product.sku || ''
    if (sku) {
      toggleFavorite(sku)
    }
  }
  
  // Handle add to cart
  const handleAddToCart = () => {
    const sku = product.baseSku || product.sku || ''
    if (sku && product.name) {
      // Get stock for selected size, or total stock if no size selected
      const maxStock = selectedSize 
        ? ('stockBySize' in activeVariant ? activeVariant.stockBySize[selectedSize] || 0 : 0)
        : ('stockBySize' in activeVariant ? Object.values(activeVariant.stockBySize).reduce((total, stock) => total + stock, 0) : 0)
      
      addToCart({
        sku: sku,
        name: product.name,
        price: currentPrice,
        salePrice: activeVariant.salePrice,
        currency: 'ILS',
        image: typeof primaryImage === 'string' ? primaryImage : primaryImage?.url,
        color: activeVariant.colorSlug,
        size: selectedSize || undefined,
        maxStock: maxStock
      })
      onClose()
    }
  }

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
         <Transition.Child
           as={Fragment}
           enter="ease-in-out duration-500"
           enterFrom="opacity-0"
           enterTo="opacity-100"
           leave="ease-in-out duration-500"
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
                enter="transform transition ease-in-out duration-500 sm:duration-700"
                enterFrom="translate-x-full"
                enterTo="translate-x-0"
                leave="transform transition ease-in-out duration-500 sm:duration-700"
                leaveFrom="translate-x-0"
                leaveTo="translate-x-full"
              >
                <Dialog.Panel className="pointer-events-auto w-screen max-w-md">
                  <div className="flex h-full flex-col overflow-y-scroll bg-white shadow-xl">
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                      <h2 className="text-lg font-semibold text-gray-900">{productName}</h2>
                      <div className="flex items-center gap-3">
                        {/* Heart Icon */}
                        <button
                          onClick={handleWishlistToggle}
                          className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                        >
                          {isFavorite(product.baseSku || product.sku || '') ? (
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
                        <div className="text-2xl font-bold text-gray-900">
                          ₪{currentPrice.toFixed(2)}
                        </div>
                        {activeVariant.salePrice && currentPrice === activeVariant.salePrice && (
                          <div className="text-sm text-red-600 mt-1">
                            {language === 'he' ? 'מבצע' : 'Sale'}
                          </div>
                        )}
                      </div>

                      {/* Color Selection */}
                      {product.colorVariants && Object.keys(product.colorVariants).length > 1 && (
                        <div className="mb-8">
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-medium text-gray-900">
                              {language === 'he' ? 'צבע' : 'Color'}: {activeVariant.colorSlug}
                            </h3>
                          </div>
                          <div className="flex gap-3">
                            {Object.values(product.colorVariants).map((variant) => {
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
                            <h3 className="text-sm font-medium text-gray-900">
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
                                      ? 'border-black bg-gray-200 text-black'
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

                      {/* Action Buttons */}
                      <div className="space-y-3">
                        {/* Add to Shopping Cart Button */}
                        <button
                          onClick={handleAddToCart}
                          disabled={availableSizes.length > 0 && !selectedSize}
                          className={`w-full font-medium py-3 px-4 transition-colors duration-200 ${
                            availableSizes.length > 0 && !selectedSize
                              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                              : 'bg-black text-white hover:bg-gray-800'
                          }`}
                        >
                          {language === 'he' ? 'הוסף לעגלת הקניות' : 'Add to Shopping Cart'}
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
    </Transition.Root>
  )
}
