'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Product, ColorVariant, productHelpers } from '@/lib/firebase'
import { HeartIcon, ShoppingCartIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid'
import { useFavorites } from '@/app/hooks/useFavorites'
import QuickBuyDrawer from './QuickBuyDrawer'
import { trackSelectItem } from '@/lib/dataLayer'
import { getColorName } from '@/lib/colors'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from '@/app/components/ui/carousel'
import { buildFavoriteKey } from '@/lib/favorites'

interface ProductCardProps {
  product: Product
  language?: 'en' | 'he'
  returnUrl?: string
  selectedColors?: string[] // Color filter from collection page
  disableImageCarousel?: boolean // Disable image carousel (e.g., when inside ProductCarousel)
  isAboveFold?: boolean // Whether product is above the fold (for lazy loading)
}

export default function ProductCard({ product, language = 'en', returnUrl, selectedColors, disableImageCarousel = false, isAboveFold = false }: ProductCardProps) {
  const [selectedVariant, setSelectedVariant] = useState<ColorVariant | null>(null)
  const [isQuickBuyOpen, setIsQuickBuyOpen] = useState(false)
  const { isFavorite, toggleFavorite } = useFavorites()
  
  // Carousel state
  const [api, setApi] = useState<CarouselApi>()
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
  
  // Update selected image index when carousel changes
  useEffect(() => {
    if (!api) return

    let isScrolling = false
    let scrollTimeout: NodeJS.Timeout | null = null

    const onSelect = () => {
      const selected = api.selectedScrollSnap()
      setSelectedImageIndex(selected)
      
      // If the index changed, it means user swiped - prevent link click
      if (isScrolling) {
        linkClickedRef.current = true
        // Reset after a short delay to allow normal clicks again
        if (scrollTimeout) clearTimeout(scrollTimeout)
        scrollTimeout = setTimeout(() => {
          linkClickedRef.current = false
        }, 300)
      }
    }

    const onScroll = () => {
      isScrolling = true
      linkClickedRef.current = true
    }

    const onScrollEnd = () => {
      isScrolling = false
    }

    api.on('select', onSelect)
    api.on('scroll', onScroll)
    api.on('settle', onScrollEnd)
    onSelect() // Set initial index

    return () => {
      api.off('select', onSelect)
      api.off('scroll', onScroll)
      api.off('settle', onScrollEnd)
      if (scrollTimeout) clearTimeout(scrollTimeout)
    }
  }, [api])

  // Reset carousel to primary image when variant changes
  useEffect(() => {
    if (api && activeVariant && totalImages > 0) {
      const initialIndex = primaryImageIndex
      api.scrollTo(initialIndex, false) // false = instant scroll, no animation
      setSelectedImageIndex(initialIndex)
    }
  }, [api, activeVariant, totalImages, primaryImageIndex])
  
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
  
  // Get available sizes for the active variant (only sizes with stock > 0)
  // const availableSizes = 'stockBySize' in activeVariant ? Object.entries(activeVariant.stockBySize).filter(([_, stock]) => stock > 0).map(([size, _]) => size) : []
  
  // Calculate total stock for the active variant
  const totalStock = useMemo(() => {
    if (!activeVariant) return 0
    
    if ('stockBySize' in activeVariant && activeVariant.stockBySize) {
      const stockValues = Object.values(activeVariant.stockBySize)
      return stockValues.reduce((total, stock) => total + (stock || 0), 0)
    }
    
    return 0
  }, [activeVariant])
  
  // Check if the active variant is out of stock
  const isOutOfStock = useMemo(() => {
    return totalStock <= 0
  }, [totalStock])
  
  // Check if the active variant is in "last call" (stock between 1 and 4)
  const isLastCall = useMemo(() => {
    return totalStock > 0 && totalStock < 4
  }, [totalStock])
  
  // Handle color variant selection - just change the display
  const handleVariantSelect = (variant: any, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent click from bubbling up to parent (e.g., SearchBar wrapper)
    setSelectedVariant(variant)
  }
  
  // Handle wishlist toggle
  const handleWishlistToggle = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    // Save favorite as product + specific displayed color (when available)
    const baseSku = product.baseSku || product.sku || ''
    const colorSlug = activeVariant?.colorSlug || ''
    const favoriteKey = buildFavoriteKey(baseSku, colorSlug)
    if (favoriteKey) {
      void toggleFavorite(favoriteKey)
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

  // Handle arrow navigation (desktop only)
  const handleArrowClick = useCallback((direction: 'prev' | 'next', e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (!api || totalImages <= 1) return
    
    linkClickedRef.current = true // Prevent link navigation
    
    if (direction === 'prev') {
      api.scrollPrev()
    } else {
      api.scrollNext()
    }
    
    // Reset after a short delay to allow normal clicks again
    setTimeout(() => {
      linkClickedRef.current = false
    }, 300)
  }, [api, totalImages])

  return (
    <div className="group relative bg-gray-100">
      {/* Main Product Image Section - Clickable to go to selected variant */}
      <Link 
        href={`/${language}/product/${product.sku}/${activeVariant.colorSlug}`}
        className="relative aspect-square overflow-hidden bg-gray-50 block"
        onClick={handleLinkClick}
      >
        {/* Image Carousel Container */}
        <div className="w-full h-full relative">
          {/* Image indicator dots */}
          {!disableImageCarousel && totalImages > 1 && (
            <div className="absolute top-2 left-1/2 transform -translate-x-1/2 z-10 flex space-x-1">
              {Array.from({ length: totalImages }).map((_, index) => (
                <div
                  key={index}
                  className={`w-1 h-1 rounded-full transition-all duration-200 ${
                    selectedImageIndex === index ? 'bg-[#E1DBD7]' : 'bg-[#E1DBD7]/50'
                  }`}
                />
              ))}
            </div>
          )}
          
          {/* Image Carousel */}
          {!disableImageCarousel && totalImages > 1 ? (
            <>
              <Carousel
                setApi={setApi}
                direction={language === 'he' ? 'rtl' : 'ltr'}
                opts={{
                  align: 'start',
                  loop: true,
                }}
                className="w-full h-full"
              >
                <CarouselContent className={`h-full ${language === 'he' ? '-mr-0' : '-ml-0'}`}>
                  {variantImages.map((image, index) => {
                    const shouldPreload = Math.abs(selectedImageIndex - index) <= 1
                    const isActive = selectedImageIndex === index
                    const isPrimary = index === primaryImageIndex

                    return (
                      <CarouselItem key={`image-${index}`} className={`h-full basis-full ${language === 'he' ? 'pr-0' : 'pl-0'}`}>
                        <div className="w-full h-full relative aspect-square">
                          <Image
                            src={typeof image === 'string' ? image : image?.url || ''}
                            alt={`${productName} - ${activeVariant.colorSlug}`}
                            width={500}
                            height={500}
                            className="h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-105 md:group-hover:scale-100"
                            priority={isPrimary && isAboveFold}
                            unoptimized={true}
                            loading={isAboveFold && isPrimary ? undefined : (shouldPreload ? undefined : 'lazy')}
                            draggable={false}
                            decoding={isActive ? 'sync' : 'async'}
                            style={{ aspectRatio: '1 / 1' }} // Ensure fixed aspect ratio to prevent layout shift
                          />
                        </div>
                      </CarouselItem>
                    )
                  })}
                </CarouselContent>
              </Carousel>
              
              {/* Desktop Arrow Navigation - Only show when more than 1 image */}
              {totalImages > 1 && (
                <>
                  {/* Left Arrow (Previous) */}
                  <button
                    onClick={(e) => handleArrowClick('prev', e)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-2 shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-20 hidden md:flex items-center justify-center"
                    aria-label={language === 'he' ? 'תמונה קודמת' : 'Previous image'}
                  >
                    <ChevronLeftIcon className="h-5 w-5 text-gray-800" />
                  </button>
                  
                  {/* Right Arrow (Next) */}
                  <button
                    onClick={(e) => handleArrowClick('next', e)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-2 shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-20 hidden md:flex items-center justify-center"
                    aria-label={language === 'he' ? 'תמונה הבאה' : 'Next image'}
                  >
                    <ChevronRightIcon className="h-5 w-5 text-gray-800" />
                  </button>
                </>
              )}
            </>
          ) : primaryImage ? (
            <div className="w-full h-full relative aspect-square">
              <Image
                src={typeof primaryImage === 'string' ? primaryImage : primaryImage?.url || ''}
                alt={`${productName} - ${activeVariant.colorSlug}`}
                width={500}
                height={500}
                className="h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-105 md:group-hover:scale-100"
                priority={isAboveFold}
                unoptimized={true}
                loading={isAboveFold ? undefined : 'lazy'}
                draggable={false}
                style={{ aspectRatio: '1 / 1' }} // Ensure fixed aspect ratio to prevent layout shift
              />
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-200">
              <span className="text-gray-400 text-sm">No Image</span>
            </div>
          )}
        </div>
        
                    {/* Mobile Icons - Heart and Quick Buy */}
                    <div className="absolute top-2 right-2 flex flex-col gap-1 md:hidden">
                      {/* Wishlist Button */}
                      <button
                        onClick={handleWishlistToggle}
                        className="bg-white/80 hover:bg-white rounded-full p-1.5 shadow-sm transition-colors"
                      >
                        {isFavorite(buildFavoriteKey(product.baseSku || product.sku || '', activeVariant?.colorSlug || '')) ? (
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
                      {isFavorite(buildFavoriteKey(product.baseSku || product.sku || '', activeVariant?.colorSlug || '')) ? (
                        <HeartSolidIcon className="h-4 w-4 text-red-500" />
                      ) : (
                        <HeartIcon className="h-4 w-4 text-gray-600" />
                      )}
                    </button>
        
        {/* Out of Stock Badge */}
        {isOutOfStock && (
          <div className="absolute bottom-2 md:top-2 md:bottom-auto left-2 bg-[#7B1B38]/80 text-white text-xs font-medium px-2 py-1 rounded z-10" style={{ fontFamily: 'Assistant, sans-serif' }}>
            {language === 'he' ? 'אזל מהמלאי' : 'Out of Stock'}
          </div>
        )}
        
        {/* Last Call Badge - Show if stock is between 1 and 4 */}
        {!isOutOfStock && isLastCall && (
          <div className="absolute bottom-2 md:top-2 md:bottom-auto left-2 bg-[#B2A28E]/80 text-white text-xs font-medium px-2 py-1 rounded z-10" style={{ fontFamily: 'Assistant, sans-serif' }}>
            {language === 'he' ? 'Last Call' : 'Last Call'}
          </div>
        )}
        
        {/* New Product Badge - Only show if not out of stock and not last call */}
        {!isOutOfStock && !isLastCall && product.newProduct && (
          <div className="absolute bottom-2 md:top-2 md:bottom-auto left-2 bg-[#856D55]/80 text-white text-xs font-medium px-2 py-1 rounded z-10" style={{ fontFamily: 'Assistant, sans-serif' }}>
            {language === 'he' ? 'NEW' : 'NEW'}
          </div>
        )}
        
        {/* Sale Badge */}
        {activeVariant.salePrice && currentPrice === activeVariant.salePrice && (
          <div className="absolute top-2 left-2 bg-red-500 text-white text-xs font-medium px-2 py-1 rounded z-10">
            {language === 'he' ? 'מבצע' : 'Sale'}
          </div>
        )}
        
        {/* Desktop Quick Buy Button - Overlay at bottom of image */}
        <div className="absolute bottom-0 left-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-2 hidden md:block">
          <button
            onClick={handleQuickBuy}
            className="w-full border border-[#856D55]/90 bg-white text-black font-medium py-2 px-4 hover:bg-[#856D55]/90 hover:text-white transition-colors duration-200"
          >
            {language === 'he' ? 'קניה מהירה' : 'Quick buy'}
          </button>
        </div>
      </Link>
      
      {/* Product Information Section */}
      <div className="mt-0 bg-[#E1DBD7]/60 p-3 pb-1">
        <div className={`flex items-center justify-between mb-1 ${language === 'he' ? 'flex-row' : 'flex-row-reverse'}`}>
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">{productName}</h3>
          {/* {product.newProduct && (
            <span className="bg-black text-white text-xs font-medium px-2 py-0.5 uppercase">
              {language === 'he' ? 'חדש' : 'NEW'}
            </span> */}
          {/* )} */}
        </div>

        <div className="text-sm font-medium text-gray-900">{language === 'he' ? 'מספר דגם: ' : 'SKU: '}{product.sku}</div>
        
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
      {product.colorVariants && Object.keys(product.colorVariants).length >= 1 && (
        <div className="mt-0 bg-[#E1DBD7]/60 p-3 pt-1">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {Object.values(product.colorVariants)
              .filter(variant => variant.isActive !== false) // Filter out inactive variants
              .map((variant) => {
              const variantImage = variant.primaryImage || variant.images?.[0]
              const isSelected = variant.colorSlug === activeVariant.colorSlug
              
              return (
                <button
                  key={variant.colorSlug}
                  onClick={(e) => handleVariantSelect(variant, e)}
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
                        ? 'bg-[#856D55]/90' 
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