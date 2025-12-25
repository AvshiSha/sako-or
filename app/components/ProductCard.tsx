'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
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
  selectedColors?: string[] // Color filter from collection page
}

export default function ProductCard({ product, language = 'en', returnUrl, selectedColors }: ProductCardProps) {
  const [selectedVariant, setSelectedVariant] = useState<ColorVariant | null>(null)
  const [isQuickBuyOpen, setIsQuickBuyOpen] = useState(false)
  const { isFavorite, toggleFavorite } = useFavorites()
  
  // Swipe/carousel state
  const isRTL = language === 'he'
  const pointerStartXRef = useRef<number | null>(null)
  const pointerStartYRef = useRef<number | null>(null)
  const pointerStartTimeRef = useRef<number | null>(null)
  const lastPointerXRef = useRef<number | null>(null)
  const lastPointerTimeRef = useRef<number | null>(null)
  const isSwipingRef = useRef(false)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState(0)
  const [isTransitionEnabled, setIsTransitionEnabled] = useState(true)
  const [transitionDurationMs, setTransitionDurationMs] = useState(260)
  const [carouselWidth, setCarouselWidth] = useState(0)
  const [carouselPositionState, setCarouselPositionState] = useState(1)
  const carouselPositionRef = useRef(1)
  const carouselContainerRef = useRef<HTMLDivElement | null>(null)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const linkClickedRef = useRef(false)
  
  // Get the default color variant for display
  // If selectedColors filter is active, prioritize matching color variant
  const getDefaultVariant = () => {
    if (!product.colorVariants) return null
    
    const activeVariants = Object.values(product.colorVariants).filter(variant => variant.isActive !== false)
    
    // If color filter is active, find matching variant
    if (selectedColors && selectedColors.length > 0) {
      const matchingVariant = activeVariants.find(variant => 
        variant.colorSlug && selectedColors.includes(variant.colorSlug)
      )
      if (matchingVariant) {
        return matchingVariant
      }
    }
    
    // Fallback to first active variant
    return activeVariants[0] || null
  }
  
  const defaultVariant = getDefaultVariant()
  const activeVariant = selectedVariant || defaultVariant
  
  // Get all images from active variant
  const variantImages = useMemo(() => {
    if (!activeVariant) return []
    return activeVariant.images || []
  }, [activeVariant])
  
  const totalImages = variantImages.length
  
  // Find primary image index
  const primaryImageIndex = useMemo(() => {
    if (!activeVariant || totalImages === 0) return 0
    const primaryImage = ('primaryImage' in activeVariant && activeVariant.primaryImage) || null
    if (!primaryImage) return 0
    
    // Find the index of the primary image in the images array
    // Images are always strings in product.colorVariants
    const index = variantImages.findIndex(img => img === primaryImage)
    
    return index >= 0 ? index : 0
  }, [activeVariant, variantImages, totalImages])
  
  // Extended images for infinite carousel
  const extendedImages = useMemo(() => {
    if (totalImages <= 1) return variantImages
    const firstImage = variantImages[0]
    const lastImage = variantImages[totalImages - 1]
    return [lastImage, ...variantImages, firstImage]
  }, [variantImages, totalImages])
  
  const setCarouselPosition = useCallback((value: number | ((prev: number) => number)) => {
    setCarouselPositionState((prev) => {
      const nextValue = typeof value === 'function' ? (value as (prevValue: number) => number)(prev) : value
      carouselPositionRef.current = nextValue
      return nextValue
    })
  }, [])
  
  const getResponsiveDuration = useCallback(() => {
    if (typeof window === 'undefined') {
      return 260
    }
    return window.innerWidth < 768 ? 320 : 240
  }, [])
  
  // Update carousel width on mount and resize
  useEffect(() => {
    const updateWidth = () => {
      if (carouselContainerRef.current) {
        setCarouselWidth(carouselContainerRef.current.offsetWidth)
      }
    }

    updateWidth()

    let resizeObserver: ResizeObserver | null = null
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', updateWidth)
      if ('ResizeObserver' in window && carouselContainerRef.current) {
        resizeObserver = new ResizeObserver(() => updateWidth())
        resizeObserver.observe(carouselContainerRef.current)
      }
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', updateWidth)
      }
      resizeObserver?.disconnect()
    }
  }, [])
  
  // Reset carousel when variant changes - start with primary image
  useEffect(() => {
    if (activeVariant && totalImages > 0) {
      const initialIndex = primaryImageIndex
      setSelectedImageIndex(initialIndex)
      if (totalImages > 1) {
        setIsTransitionEnabled(false)
        // For infinite carousel, position 1 is the first real image (index 0)
        // So we need to add 1 to the index to account for the clone at the start
        setCarouselPosition(initialIndex + 1)

        if (typeof window !== 'undefined') {
          window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => {
              setIsTransitionEnabled(true)
            })
          })
        } else {
          setIsTransitionEnabled(true)
        }
      } else {
        setCarouselPosition(0)
      }
    }
  }, [activeVariant, totalImages, primaryImageIndex, setCarouselPosition])
  
  const goToNextImage = useCallback(() => {
    if (totalImages <= 1) return

    setIsTransitionEnabled(true)
    setTransitionDurationMs(getResponsiveDuration())
    setCarouselPosition((prev) => prev + 1)
    setSelectedImageIndex((prev) => {
      const nextIndex = (prev + 1) % totalImages
      return nextIndex
    })
    setDragOffset(0)
  }, [getResponsiveDuration, totalImages, setCarouselPosition])

  const goToPreviousImage = useCallback(() => {
    if (totalImages <= 1) return

    setIsTransitionEnabled(true)
    setTransitionDurationMs(getResponsiveDuration())
    setCarouselPosition((prev) => prev - 1)
    setSelectedImageIndex((prev) => {
      const nextIndex = ((prev - 1) % totalImages + totalImages) % totalImages
      return nextIndex
    })
    setDragOffset(0)
  }, [getResponsiveDuration, totalImages, setCarouselPosition])
  
  const handleCarouselTransitionEnd = useCallback(() => {
    if (totalImages <= 1) return

    if (carouselPositionRef.current === 0) {
      setIsTransitionEnabled(false)
      setCarouselPosition(totalImages)

      if (typeof window !== 'undefined') {
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => {
            setIsTransitionEnabled(true)
          })
        })
      } else {
        setIsTransitionEnabled(true)
      }
    } else if (carouselPositionRef.current === totalImages + 1) {
      setIsTransitionEnabled(false)
      setCarouselPosition(1)

      if (typeof window !== 'undefined') {
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => {
            setIsTransitionEnabled(true)
          })
        })
      } else {
        setIsTransitionEnabled(true)
      }
    }
  }, [totalImages, setCarouselPosition])
  
  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    // Only handle primary pointer (left mouse button or first touch)
    if (event.button !== 0 && event.pointerType !== 'touch') return
    
    const element = event.currentTarget
    element.setPointerCapture(event.pointerId)
    
    pointerStartXRef.current = event.clientX
    pointerStartYRef.current = event.clientY
    pointerStartTimeRef.current = typeof performance !== 'undefined' ? performance.now() : Date.now()
    lastPointerXRef.current = event.clientX
    lastPointerTimeRef.current = typeof performance !== 'undefined' ? performance.now() : Date.now()
    isSwipingRef.current = false
    setIsTransitionEnabled(false)
    setIsDragging(true)
    setDragOffset(0)
    linkClickedRef.current = false
  }, [])

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerStartXRef.current === null || pointerStartYRef.current === null) return
    
    const deltaX = event.clientX - pointerStartXRef.current
    const deltaY = event.clientY - pointerStartYRef.current

    // Detect horizontal swipe (threshold: 10px to avoid accidental taps)
    if (!isSwipingRef.current && Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
      isSwipingRef.current = true
      linkClickedRef.current = true
      // Disable transitions for smooth dragging
      setIsTransitionEnabled(false)
    }

    // Live drag-follow: continuously update transform while dragging
    if (isSwipingRef.current) {
      const width = carouselWidth || (carouselContainerRef.current?.offsetWidth ?? 0)
      
      if (width > 0) {
        // Allow rubber-band effect with max 35% drag
        const maxOffset = width * 0.35
        const clampedDelta = Math.max(Math.min(deltaX, maxOffset), -maxOffset)
        // Update drag offset in real-time - this triggers re-render with new transform
        setDragOffset(clampedDelta)
      } else {
        setDragOffset(deltaX)
      }
      
      lastPointerXRef.current = event.clientX
      lastPointerTimeRef.current = typeof performance !== 'undefined' ? performance.now() : Date.now()
    }
  }, [carouselWidth])

  const handlePointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerStartXRef.current === null || pointerStartYRef.current === null) return
    
    const element = event.currentTarget
    element.releasePointerCapture(event.pointerId)

    const deltaX = event.clientX - pointerStartXRef.current
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
    const lastTime = lastPointerTimeRef.current ?? now
    const lastX = lastPointerXRef.current ?? event.clientX
    const timeSinceLast = Math.max(1, now - lastTime)
    const deltaSinceLast = event.clientX - lastX

    // Calculate velocity for momentum-based snapping
    const instantaneousVelocity = deltaSinceLast / timeSinceLast
    const totalTime = pointerStartTimeRef.current ? Math.max(1, now - pointerStartTimeRef.current) : timeSinceLast
    const averageVelocity = deltaX / totalTime
    const velocity = instantaneousVelocity !== 0 ? instantaneousVelocity : averageVelocity

    const width = carouselWidth || (carouselContainerRef.current?.offsetWidth ?? 0)
    
    // Threshold: 20% of card width (within 15-30% range) or velocity-based
    const distanceThreshold = width > 0 ? width * 0.20 : 80
    const velocityThreshold = 0.3 // pixels per ms
    
    // Prevent accidental taps: if drag distance > 8px, it's a swipe
    const minSwipeDistance = 8
    const isSwipe = Math.abs(deltaX) > minSwipeDistance

    const shouldCommitByDistance = Math.abs(deltaX) >= distanceThreshold
    const shouldCommitByVelocity = Math.abs(velocity) >= velocityThreshold
    const shouldCommit = (shouldCommitByDistance || shouldCommitByVelocity) && isSwipe

    setIsTransitionEnabled(true)
    setTransitionDurationMs(getResponsiveDuration())

    // Snap to closest slide with momentum
    if (shouldCommit && isSwipingRef.current) {
      const directionalDelta = deltaX !== 0 ? deltaX : velocity
      if (directionalDelta < 0) {
        goToNextImage()
      } else {
        goToPreviousImage()
      }
      linkClickedRef.current = true
    } else if (isSwipe) {
      // Small swipe that didn't meet threshold - snap back
      setDragOffset(0)
      linkClickedRef.current = true
    } else {
      // No swipe detected - allow normal tap
      setDragOffset(0)
      linkClickedRef.current = false
    }

    pointerStartXRef.current = null
    pointerStartYRef.current = null
    pointerStartTimeRef.current = null
    lastPointerXRef.current = null
    lastPointerTimeRef.current = null
    isSwipingRef.current = false
    setIsDragging(false)
  }, [carouselWidth, getResponsiveDuration, goToNextImage, goToPreviousImage])

  const handlePointerCancel = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const element = event.currentTarget
    element.releasePointerCapture(event.pointerId)
    
    pointerStartXRef.current = null
    pointerStartYRef.current = null
    pointerStartTimeRef.current = null
    lastPointerXRef.current = null
    lastPointerTimeRef.current = null
    isSwipingRef.current = false
    setDragOffset(0)
    setIsTransitionEnabled(true)
    setIsDragging(false)
    setTransitionDurationMs(getResponsiveDuration())
  }, [getResponsiveDuration])
  
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
  
  // Get primary image from the active variant (for fallback)
  const primaryImage = ('primaryImage' in activeVariant && activeVariant.primaryImage) || activeVariant.images?.[0]
  
  // Calculate carousel transform
  const baseSlidePosition = totalImages > 1 ? carouselPositionState : selectedImageIndex
  const translateDeltaPercentage = carouselWidth > 0 ? (dragOffset / carouselWidth) * 100 : 0
  const translateValue = -(baseSlidePosition * 100) + translateDeltaPercentage
  
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

  const handleLinkClick = useCallback((e: React.MouseEvent) => {
    if (linkClickedRef.current) {
      e.preventDefault()
      linkClickedRef.current = false
      return
    }
    
    // Track select_item when product is clicked
    try {
      const productName = productHelpers.getField(product, 'name', language as 'en' | 'he') || product.title_en || product.title_he || 'Unknown Product';
      const itemId = `${product.sku}-${activeVariant.colorSlug}`;
      const price = currentPrice;
      const categories = product.categories_path || [product.category || 'Unknown'];
      const listName = 'Product List';
      const listId = 'product_list';
      
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
          index: undefined,
          currency: product.currency || 'ILS'
        }
      );
    } catch (dataLayerError) {
      console.warn('Data layer tracking error:', dataLayerError);
    }
  }, [product, activeVariant, currentPrice, language])

  return (
    <div className="group relative bg-gray-100">
      {/* Main Product Image Section - Clickable to go to selected variant */}
      <Link 
        href={`/${language}/product/${product.sku}/${activeVariant.colorSlug}`}
        className="relative aspect-square overflow-hidden bg-gray-50 block"
        onClick={handleLinkClick}
      >
        {/* Image Carousel Container */}
        <div
          ref={carouselContainerRef}
          className="w-full h-full relative"
          style={{ touchAction: 'pan-y' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
        >
          {/* Image indicator dots */}
          {totalImages > 1 && (
            <div className="absolute top-2 left-1/2 transform -translate-x-1/2 z-10 flex space-x-1">
              {Array.from({ length: totalImages }).map((_, index) => (
                <div
                  key={index}
                  className={`w-1.5 h-1.5 rounded-full transition-all duration-200 ${
                    selectedImageIndex === index ? 'bg-white' : 'bg-white/50'
                  }`}
                />
              ))}
            </div>
          )}
          
          {/* Image Carousel */}
          <div 
            dir="ltr"
            className="flex h-full w-full"
            style={{
              transform: `translate3d(${translateValue}%, 0, 0)`,
              transitionDuration: isTransitionEnabled && !isDragging ? `${transitionDurationMs}ms` : '0ms',
              transitionTimingFunction: isTransitionEnabled ? 'cubic-bezier(.22,.61,.36,1)' : 'linear',
              willChange: 'transform',
              touchAction: 'pan-y'
            }}
            onTransitionEnd={handleCarouselTransitionEnd}
          >
            {extendedImages.length > 0 ? (
              extendedImages.map((image, extendedIndex) => {
                const actualIndex = extendedIndex === 0 ? totalImages - 1 : extendedIndex === extendedImages.length - 1 ? 0 : extendedIndex - 1
                const isClone = totalImages > 1 && (extendedIndex === 0 || extendedIndex === extendedImages.length - 1)
                const distance = Math.abs(selectedImageIndex - actualIndex)
                const wrapDistance = totalImages > 0 ? Math.min(distance, totalImages - distance) : distance
                const shouldPreload = wrapDistance <= 1
                const isActive = selectedImageIndex === actualIndex && !isClone

                return (
                  <div key={`image-${extendedIndex}-${actualIndex}`} className="w-full h-full flex-shrink-0 relative">
                    <Image
                      src={typeof image === 'string' ? image : image?.url || ''}
                      alt={`${productName} - ${activeVariant.colorSlug}`}
                      width={500}
                      height={500}
                      className="h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-105"
                      priority={shouldPreload && !isClone && extendedIndex === 1}
                      unoptimized={true}
                      loading={shouldPreload && !isClone ? undefined : 'lazy'}
                      draggable={false}
                      decoding={isActive ? 'sync' : 'async'}
                    />
                  </div>
                )
              })
            ) : primaryImage ? (
              <div className="w-full h-full flex-shrink-0 relative">
                <Image
                  src={typeof primaryImage === 'string' ? primaryImage : primaryImage?.url || ''}
                  alt={`${productName} - ${activeVariant.colorSlug}`}
                  width={500}
                  height={500}
                  className="h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-105"
                  priority={true}
                  unoptimized={true}
                  draggable={false}
                />
              </div>
            ) : (
              <div className="w-full h-full flex-shrink-0 flex items-center justify-center bg-gray-200">
                <span className="text-gray-400 text-sm">No Image</span>
              </div>
            )}
          </div>
        </div>
        
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