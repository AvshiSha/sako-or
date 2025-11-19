'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { Product, ColorVariant, productHelpers } from '@/lib/firebase'
import { HeartIcon, ShoppingCartIcon } from '@heroicons/react/24/outline'
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid'
import { useFavorites } from '@/app/hooks/useFavorites'
import QuickBuyDrawer from './QuickBuyDrawer'
import { trackSelectItem } from '@/lib/dataLayer'
import { getColorName } from '@/lib/colors'

interface ProductCardProps {
  product: Product
  language?: 'en' | 'he'
  returnUrl?: string
}

export default function ProductCard({ product, language = 'en', returnUrl }: ProductCardProps) {
  const [selectedVariant, setSelectedVariant] = useState<ColorVariant | null>(null)
  const [isQuickBuyOpen, setIsQuickBuyOpen] = useState(false)
  const { isFavorite, toggleFavorite } = useFavorites()
  
  // Get the first active color variant for display
  const defaultVariant = product.colorVariants ? Object.values(product.colorVariants).find(variant => variant.isActive !== false) : null
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
  const productName = language === 'he' ? (product.title_he || product.title_en) : (product.title_en || product.title_he) || 'Unnamed Product'
  
  // Get primary image from the active variant
  const primaryImage = ('primaryImage' in activeVariant && activeVariant.primaryImage) || activeVariant.images?.[0]
  
  // Get available sizes for the active variant (only sizes with stock > 0)
  // const availableSizes = 'stockBySize' in activeVariant ? Object.entries(activeVariant.stockBySize).filter(([_, stock]) => stock > 0).map(([size, _]) => size) : []
  
  // Handle color variant selection - just change the display
  const handleVariantSelect = (variant: any) => {
    setSelectedVariant(variant)
  }
  
  // Handle wishlist toggle
  const handleWishlistToggle = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    // Use the base SKU for favorites (consistent across all color variants)
    const sku = product.sku || ''
    if (sku) {
      toggleFavorite(sku)
    }
  }
  
  // Handle quick buy
  const handleQuickBuy = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsQuickBuyOpen(true)
  }

  return (
    <div className="group relative bg-gray-100">
      {/* Main Product Image Section - Clickable to go to selected variant */}
      <Link 
        href={`/${language}/product/${product.sku}/${activeVariant.colorSlug}`}
        className="relative aspect-square overflow-hidden bg-gray-50 block"
        onClick={() => {
          // Track select_item when product is clicked
          try {
            const productName = productHelpers.getField(product, 'name', language as 'en' | 'he') || product.title_en || product.title_he || 'Unknown Product';
            const itemId = `${product.sku}-${activeVariant.colorSlug}`;
            const price = currentPrice;
            const categories = product.categories_path || [product.category || 'Unknown'];
            const listName = 'Product List'; // Could be enhanced to pass actual list name
            const listId = 'product_list'; // Could be enhanced to pass actual list ID
            
            trackSelectItem(
              productName,
              itemId,
              price,
              {
                brand: product.brand,
                categories: categories,
                variant: activeVariant.colorSlug,
                listName: listName,
                listId: listId,
                index: undefined, // Index would need to be passed as prop
                currency: product.currency || 'ILS'
              }
            );
          } catch (dataLayerError) {
            console.warn('Data layer tracking error:', dataLayerError);
          }
        }}
      >
        {primaryImage ? (
          <Image
            src={typeof primaryImage === 'string' ? primaryImage : primaryImage?.url || ''}
            alt={`${productName} - ${activeVariant.colorSlug}`}
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
        
                    {/* Mobile Icons - Heart and Quick Buy */}
                    <div className="absolute top-2 right-2 flex flex-col gap-1 md:hidden">
                      {/* Wishlist Button */}
                      <button
                        onClick={handleWishlistToggle}
                        className="bg-white/80 hover:bg-white rounded-full p-1.5 shadow-sm transition-colors"
                      >
                        {isFavorite(product.sku || '') ? (
                          <HeartSolidIcon className="h-4 w-4 text-red-500" />
                        ) : (
                          <HeartIcon className="h-4 w-4 text-gray-600" />
                        )}
                      </button>
                      
                      {/* Quick Buy Icon */}
                      <button
                        onClick={handleQuickBuy}
                        className="bg-white/80 hover:bg-white rounded-full p-1.5 shadow-sm transition-colors"
                      >
                        <ShoppingCartIcon className="h-4 w-4 text-gray-600" />
                      </button>
                    </div>
                    
                    {/* Desktop Wishlist Button */}
                    <button
                      onClick={handleWishlistToggle}
                      className="absolute top-2 right-2 bg-white/80 hover:bg-white rounded-full p-1.5 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hidden md:block"
                    >
                      {isFavorite(product.sku || '') ? (
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
        
        {/* Desktop Quick Buy Button - Overlay at bottom of image */}
        <div className="absolute bottom-0 left-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-2 hidden md:block">
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
          {product.newProduct && (
            <span className="bg-black text-white text-xs font-medium px-2 py-0.5 uppercase">
              {language === 'he' ? 'חדש' : 'NEW'}
            </span>
          )}
        </div>

        <div className="text-sm font-medium text-gray-900">{product.sku}</div>
        
        <div className="text-sm font-medium text-gray-900">
          {hasSalePrice() && salePrice && salePrice < originalPrice ? (
            <div className="flex items-center gap-2">
              <span className="text-gray-500 line-through">
                ₪{originalPrice.toFixed(2)}
              </span>
              <span className="text-red-600 font-bold">
                ₪{salePrice.toFixed(2)}
              </span>
            </div>
          ) : (
            <span>₪{currentPrice.toFixed(2)}</span>
          )}
        </div>
      </div>
      
      {/* Color Variants Section */}
      {product.colorVariants && Object.keys(product.colorVariants).length > 1 && (
        <div className="mt-0 bg-gray-100 p-3 pt-1">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {Object.values(product.colorVariants)
              .filter(variant => variant.isActive !== false) // Filter out inactive variants
              .map((variant) => {
              const variantImage = variant.primaryImage || variant.images?.[0]
              const isSelected = variant.colorSlug === activeVariant.colorSlug
              
              return (
                <button
                  key={variant.colorSlug}
                  onClick={() => handleVariantSelect(variant)}
                  className="flex-shrink-0 relative group"
                  title={getColorName(variant.colorSlug, language)}
                >
                  {/* Product image */}
                  {variantImage && (
                    <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-transparent">
                      <Image
                        src={variantImage}
                        alt={variant.colorSlug}
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
      
      {/* Quick Buy Drawer */}
      <QuickBuyDrawer
        isOpen={isQuickBuyOpen}
        onClose={() => setIsQuickBuyOpen(false)}
        product={product}
        language={language}
        returnUrl={returnUrl}
      />
    </div>
  )
} 