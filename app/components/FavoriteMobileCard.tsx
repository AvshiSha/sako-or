'use client'

import { useState, useEffect, useMemo } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { XMarkIcon, ShoppingBagIcon, MinusIcon, PlusIcon } from '@heroicons/react/24/outline'
import { Product, ColorVariant, productHelpers } from '@/lib/firebase'
import { useCart } from '@/app/hooks/useCart'
import { trackAddToCart as trackAddToCartEvent } from '@/lib/dataLayer'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from '@/app/components/ui/carousel'

interface FavoriteMobileCardProps {
  product: Product
  language: 'en' | 'he'
  onRemove: (sku: string) => void
  onAddToCartSuccess?: () => void
}

export default function FavoriteMobileCard({ 
  product, 
  language, 
  onRemove,
  onAddToCartSuccess 
}: FavoriteMobileCardProps) {
  const isRTL = language === 'he'
  const { addToCart } = useCart()
  const [selectedSize, setSelectedSize] = useState<string>('')
  const [quantity, setQuantity] = useState(1)
  const [isAddingToCart, setIsAddingToCart] = useState(false)
  const [carouselApi, setCarouselApi] = useState<CarouselApi>()
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)

  // Get the specific color variant that was favorited, or fallback to first active
  const activeVariant = useMemo(() => {
    if (!product.colorVariants) return null
    
    // Check if we have a specific color variant that was favorited
    const favoriteColorSlug = (product as any).favoriteColorSlug
    if (favoriteColorSlug && product.colorVariants[favoriteColorSlug]) {
      const variant = product.colorVariants[favoriteColorSlug]
      if (variant.isActive !== false) {
        return variant
      }
    }
    
    // Fallback to first active variant
    const activeVariants = Object.values(product.colorVariants).filter((v: any) => v.isActive !== false)
    return activeVariants[0] || null
  }, [product.colorVariants, (product as any).favoriteColorSlug]) as any

  // Get all images from the active variant
  const variantImages = useMemo(() => {
    if (!activeVariant) return []
    return activeVariant.images || []
  }, [activeVariant])

  // Get available sizes for the active variant (only sizes with stock > 0)
  const availableSizes = useMemo(() => {
    if (!activeVariant || !('stockBySize' in activeVariant)) return []
    const stockBySize = activeVariant.stockBySize as Record<string, number>
    return Object.entries(stockBySize)
      .filter(([_, stock]) => stock > 0)
      .map(([size, stock]) => ({ size, stock }))
  }, [activeVariant])

  // Get current price
  const getCurrentPrice = () => {
    if (!activeVariant) return product.price
    if (activeVariant.salePrice) return activeVariant.salePrice as number
    if (product.salePrice) return product.salePrice
    if ('priceOverride' in activeVariant && activeVariant.priceOverride) return activeVariant.priceOverride as number
    return product.price
  }

  const getOriginalPrice = () => {
    if (!activeVariant) return product.price
    if ('priceOverride' in activeVariant && activeVariant.priceOverride) return activeVariant.priceOverride as number
    return product.price
  }

  const hasSalePrice = () => {
    if (!activeVariant) return product.salePrice !== undefined
    return (activeVariant.salePrice || product.salePrice) !== undefined
  }

  const getSalePrice = () => {
    if (!activeVariant) return product.salePrice
    return (activeVariant.salePrice || product.salePrice) as number | undefined
  }

  const currentPrice = getCurrentPrice()
  const originalPrice = getOriginalPrice()
  const salePrice = getSalePrice()
  const productName = language === 'he' ? (product.title_he || product.title_en) : (product.title_en || product.title_he) || 'Unnamed Product'
  const primaryImage = ('primaryImage' in activeVariant && activeVariant.primaryImage) || activeVariant?.images?.[0]

  // Update selected image index when carousel changes
  useEffect(() => {
    if (!carouselApi) return

    const onSelect = () => {
      const selected = carouselApi.selectedScrollSnap()
      setSelectedImageIndex(selected)
    }

    carouselApi.on('select', onSelect)
    onSelect() // Set initial index

    return () => {
      carouselApi.off('select', onSelect)
    }
  }, [carouselApi])

  // Reset quantity when size changes
  useEffect(() => {
    setQuantity(1)
  }, [selectedSize])

  // Handle size selection
  const handleSizeSelect = (size: string) => {
    setSelectedSize(size)
  }

  // Handle quantity change
  const handleQuantityChange = (delta: number) => {
    const maxStock = selectedSize 
      ? (availableSizes.find(s => s.size === selectedSize)?.stock || 0)
      : ('stockBySize' in activeVariant && activeVariant.stockBySize 
          ? Object.values(activeVariant.stockBySize as Record<string, number>).reduce((total, stock) => total + stock, 0)
          : 0)
    const newQuantity = Math.max(1, Math.min(quantity + delta, maxStock))
    setQuantity(newQuantity)
  }

  // Handle add to cart
  const handleAddToCart = async () => {
    if (isAddingToCart || !activeVariant) return
    
    // Check if size is required but not selected
    if (isSizeRequired && !selectedSize) return

    setIsAddingToCart(true)

    try {
      const sku = product.baseSku || product.sku || ''
      if (!sku) {
        console.error('No SKU found for product')
        return
      }

      const maxStock = selectedSize 
        ? (availableSizes.find(s => s.size === selectedSize)?.stock || 0)
        : ('stockBySize' in activeVariant && activeVariant.stockBySize 
            ? Object.values(activeVariant.stockBySize as Record<string, number>).reduce((total, stock) => total + stock, 0)
            : 0)
      
      const resolvedSalePrice = salePrice && salePrice > 0 && salePrice < originalPrice ? salePrice : undefined

      const cartItem = {
        sku: sku,
        name: {
          en: productHelpers.getField(product, 'name', 'en') || product.title_en || '',
          he: productHelpers.getField(product, 'name', 'he') || product.title_he || ''
        },
        price: originalPrice,
        salePrice: resolvedSalePrice,
        currency: 'ILS',
        image: typeof primaryImage === 'string' ? primaryImage : (primaryImage as any)?.url,
        color: activeVariant.colorSlug,
        size: selectedSize || undefined,
        maxStock: maxStock
      }

      // Track add_to_cart for GA4 data layer
      try {
        const itemName = productHelpers.getField(product, 'name', language) || product.title_en || product.title_he || 'Unknown Product'
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

      // Add to cart (quantity times)
      for (let i = 0; i < quantity; i++) {
        addToCart(cartItem)
      }

      // Reset selection
      setSelectedSize('')
      setQuantity(1)

      // Call success callback if provided
      if (onAddToCartSuccess) {
        onAddToCartSuccess()
      }
    } catch (error) {
      console.error('Error adding to cart:', error)
    } finally {
      setIsAddingToCart(false)
    }
  }

  if (!activeVariant) {
    return null
  }

  const maxStockForSize = selectedSize 
    ? (availableSizes.find(s => s.size === selectedSize)?.stock || 0)
    : ('stockBySize' in activeVariant && activeVariant.stockBySize 
        ? Object.values(activeVariant.stockBySize as Record<string, number>).reduce((total, stock) => total + stock, 0)
        : 0)
  const isSizeRequired = availableSizes.length > 0
  const canAddToCart = !isSizeRequired 
    ? (quantity > 0 && quantity <= maxStockForSize)
    : (selectedSize && quantity > 0 && quantity <= maxStockForSize)

  // Get the color slug for navigation (prefer favoriteColorSlug, fallback to activeVariant)
  const colorSlug = (product as any).favoriteColorSlug || activeVariant?.colorSlug || 'default'
  const baseSku = product.baseSku || product.sku || ''
  const productUrl = `/${language}/product/${baseSku}/${colorSlug}`

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-4 sm:hidden -mx-3" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-stretch">
        {/* Image Section - Fixed Stage Container - Clickable to navigate to product */}
        <Link href={productUrl} className="relative w-40 h-40 flex-shrink-0 bg-gray-50 -mx-1 block">
          {variantImages.length > 1 ? (
            <Carousel
              setApi={setCarouselApi}
              direction={isRTL ? 'rtl' : 'ltr'}
              opts={{
                align: 'start',
                loop: true,
                dragFree: false,
                containScroll: 'trimSnaps',
                duration: 25,
              }}
              className="w-full h-full"
            >
              <CarouselContent className={`h-full ${isRTL ? '-mr-0' : '-ml-0'}`}>
                {variantImages.map((image: string | any, index: number) => (
                  <CarouselItem key={`image-${index}`} className={`h-full basis-full ${isRTL ? 'pr-0' : 'pl-0'}`}>
                    <div className="relative w-full h-full flex items-center justify-center bg-gray-50">
                      <Image
                        src={typeof image === 'string' ? image : (image as any)?.url || ''}
                        alt={`${productName} - ${activeVariant.colorSlug} - ${index + 1}`}
                        width={160}
                        height={160}
                        className="w-full h-full object-contain object-center"
                        priority={index === 0}
                        unoptimized={true}
                        draggable={false}
                        loading={index === 0 ? undefined : 'lazy'}
                      />
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
            </Carousel>
          ) : primaryImage ? (
            <div className="relative w-full h-full flex items-center justify-center bg-gray-50">
              <Image
                src={typeof primaryImage === 'string' ? primaryImage : (primaryImage as any)?.url || ''}
                alt={`${productName} - ${activeVariant.colorSlug}`}
                width={160}
                height={160}
                className="w-full h-full object-contain object-center"
                priority={true}
                unoptimized={true}
                draggable={false}
              />
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-100">
              <span className="text-gray-400 text-xs">No Image</span>
            </div>
          )}

          {/* Image indicator dots - Minimal, only if multiple images */}
          {variantImages.length > 1 && (
            <div className={`absolute bottom-1.5 z-10 flex gap-1 ${isRTL ? 'right-1/2 transform translate-x-1/2' : 'left-1/2 transform -translate-x-1/2'}`}>
              {variantImages.map((_: any, index: number) => (
                <div
                  key={index}
                  className={`w-1 h-1 rounded-full transition-all ${
                    selectedImageIndex === index ? 'bg-[#856D55]' : 'bg-[#856D55]/50'
                  }`}
                />
              ))}
            </div>
          )}
        </Link>

        {/* Product Info Section */}
        <div className="flex-1 flex flex-col p-3 min-w-0 justify-between">
          {/* Top Area: Product Name, Price, Remove Button */}
          <div className="flex items-start justify-between mb-2">
            <div className={`flex-1 min-w-0 ${isRTL ? 'pl-2' : 'pr-2'}`}>
              <h3 className="font-medium text-gray-900 text-sm mb-1 line-clamp-2">
                {productName}
              </h3>
              <div className="text-sm">
                {hasSalePrice() && salePrice && salePrice < originalPrice ? (
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xs line-through text-gray-500">
                      ₪{originalPrice.toFixed(2)}
                    </span>
                    <span className="font-bold text-red-600">
                      ₪{salePrice.toFixed(2)}
                    </span>
                  </div>
                ) : (
                  <span className="font-bold text-black">
                    ₪{currentPrice.toFixed(2)}
                  </span>
                )}
              </div>
            </div>
            {/* Remove Button */}
            <button
              onClick={() => onRemove(product.baseSku || product.sku || '')}
              className="flex-shrink-0 p-1 text-gray-400 hover:text-red-600 transition-colors"
              aria-label={language === 'he' ? 'הסר מהמועדפים' : 'Remove from favorites'}
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Bottom Area: Action Row */}
          <div className="mt-auto space-y-2">
            {/* Size Selector */}
            {isSizeRequired && (
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {availableSizes.map((sizeObj) => {
                  const isSelected = selectedSize === sizeObj.size
                  return (
                    <button
                      key={sizeObj.size}
                      onClick={() => handleSizeSelect(sizeObj.size)}
                      className={`flex-shrink-0 px-2.5 py-1 text-xs border rounded transition-colors ${
                        isSelected
                          ? 'border-[#856D55] bg-[#856D55] text-white'
                          : 'border-gray-300 hover:border-gray-400 bg-white text-gray-900'
                      }`}
                    >
                      {sizeObj.size}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Quantity and Add to Bag Row */}
            <div className="flex items-center gap-2">
              {/* Quantity Selector */}
              <div className="flex items-center border border-gray-300 rounded">
                <button
                  onClick={() => handleQuantityChange(-1)}
                  disabled={quantity <= 1}
                  className="p-1 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                >
                  <MinusIcon className="h-4 w-4 text-gray-600" />
                </button>
                <span className="px-2 text-sm font-medium text-gray-900 min-w-[2rem] text-center">
                  {quantity}
                </span>
                <button
                  onClick={() => handleQuantityChange(1)}
                  disabled={quantity >= maxStockForSize}
                  className="p-1 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                >
                  <PlusIcon className="h-4 w-4 text-gray-600" />
                </button>
              </div>

              {/* Add to Bag Button */}
              <button
                onClick={handleAddToCart}
                disabled={!canAddToCart || isAddingToCart}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded font-medium text-sm transition-colors ${
                  !canAddToCart || isAddingToCart
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-[#856D55] text-white hover:bg-[#856D55]/90'
                }`}
              >
                <ShoppingBagIcon className="h-3 w-3" />
                <span>
                  {isAddingToCart
                    ? (language === 'he' ? 'מוסיף...' : 'Adding...')
                    : (language === 'he' ? 'הוסף לעגלה' : 'Add to Bag')
                  }
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

