'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { Product, ColorVariant } from '@/lib/firebase'
import { HeartIcon } from '@heroicons/react/24/outline'
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid'

interface ProductCardProps {
  product: Product
  language?: 'en' | 'he'
}

export default function ProductCard({ product, language = 'en' }: ProductCardProps) {
  const [selectedVariant, setSelectedVariant] = useState<ColorVariant | null>(null)
  const [isWishlisted, setIsWishlisted] = useState(false)
  
  // Get the first active color variant for display
  const defaultVariant = product.colorVariants?.find(v => v.isActive) || product.colorVariants?.[0]
  const activeVariant = selectedVariant || defaultVariant
  
  if (!activeVariant) {
    return null
  }

  // Get current price (variant price takes precedence)
  const getCurrentPrice = () => {
    const now = new Date()
    const isSaleActive = activeVariant.salePrice && 
      (!activeVariant.saleStartDate || now >= activeVariant.saleStartDate) &&
      (!activeVariant.saleEndDate || now <= activeVariant.saleEndDate)
    
    if (isSaleActive) return activeVariant.salePrice!
    if (activeVariant.price) return activeVariant.price
    return product.price
  }

  const currentPrice = getCurrentPrice()
  const productName = product.name?.[language] || product.name?.en || 'Unnamed Product'
  
  // Get primary image from the active variant
  const primaryImage = activeVariant.images?.find(img => img.isPrimary) || activeVariant.images?.[0]
  
  // Get available sizes for the active variant (only sizes with stock > 0)
  const availableSizes = activeVariant.sizes?.filter(size => size.stock > 0) || []
  
  // Handle color variant selection - just change the display
  const handleVariantSelect = (variant: ColorVariant) => {
    setSelectedVariant(variant)
  }
  
  // Handle wishlist toggle
  const handleWishlistToggle = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsWishlisted(!isWishlisted)
    // TODO: Implement actual wishlist functionality
  }
  
  // Handle quick buy
  const handleQuickBuy = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    // TODO: Implement quick buy functionality
    console.log('Quick buy:', product.baseSku, activeVariant.colorSlug)
  }

  return (
    <div className="group relative bg-gray-100">
      {/* Main Product Image Section - Clickable to go to selected variant */}
      <Link 
        href={`/${language}/product/${product.baseSku}/${activeVariant.colorSlug}`}
        className="relative aspect-square overflow-hidden bg-gray-50 block"
      >
        {primaryImage ? (
          <Image
            src={primaryImage.url}
            alt={primaryImage.alt || `${productName} - ${activeVariant.colorName}`}
            width={500}
            height={500}
            priority={true}
            className="object-cover object-center transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-200">
            <span className="text-gray-400 text-sm">No Image</span>
          </div>
        )}
        
        {/* Wishlist Button */}
        <button
          onClick={handleWishlistToggle}
          className="absolute top-2 right-2 bg-white/80 hover:bg-white rounded-full p-1.5 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
        >
          {isWishlisted ? (
            <HeartSolidIcon className="h-4 w-4 text-red-500" />
          ) : (
            <HeartIcon className="h-4 w-4 text-gray-600" />
          )}
        </button>
        
        {/* Sale Badge */}
        {activeVariant.salePrice && currentPrice === activeVariant.salePrice && (
          <div className="absolute top-2 left-2 bg-red-500 text-white text-xs font-medium px-2 py-1 rounded">
            {language === 'he' ? 'מבצע' : 'Sale'}
          </div>
        )}
        
        {/* Quick Buy Button - Overlay at bottom of image */}
        <div className="absolute bottom-0 left-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-2">
          <button
            onClick={handleQuickBuy}
            className="w-full border border-black bg-white text-black font-medium py-2 px-4 hover:bg-black hover:text-white transition-colors duration-200"
          >
            {language === 'he' ? 'קניה מהירה' : 'Quick buy'}
          </button>
        </div>
      </Link>
      
      {/* Product Information Section */}
      <div className="mt-0 bg-gray-100 p-3 pb-1">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">{productName}</h3>
          {product.isNew && (
            <span className="bg-black text-white text-xs font-medium px-2 py-0.5 uppercase">
              {language === 'he' ? 'חדש' : 'NEW'}
            </span>
          )}
        </div>
        
        <div className="text-sm font-medium text-gray-900">
          ₪{currentPrice.toFixed(2)}
        </div>
      </div>
      
      {/* Color Variants Section */}
      {product.colorVariants && product.colorVariants.length > 1 && (
        <div className="mt-0 bg-gray-100 p-3 pt-1">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {product.colorVariants.map((variant) => {
              const variantImage = variant.images?.find(img => img.isPrimary) || variant.images?.[0]
              const isSelected = variant.id === activeVariant.id
              
              return (
                <button
                  key={variant.id}
                  onClick={() => handleVariantSelect(variant)}
                  className="flex-shrink-0 relative group"
                  title={variant.colorName}
                >
                  {/* Product image */}
                  {variantImage && (
                    <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-transparent">
                      <Image
                        src={variantImage.url}
                        alt={variant.colorName}
                        width={32}
                        height={32}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  
                  {/* Selection line indicator */}
                  <div 
                    className={`absolute -bottom-1 left-0 w-8 h-0.5 transition-all duration-200 ${
                      isSelected 
                        ? 'bg-black' 
                        : 'bg-transparent group-hover:bg-gray-400'
                    }`}
                  />
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
} 