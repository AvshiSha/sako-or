'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import type { TouchEvent as ReactTouchEvent } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import Head from 'next/head'
import { 
  ChevronLeftIcon, 
  ChevronRightIcon,
  HeartIcon, 
  ShareIcon,
  ShoppingBagIcon,
  MinusIcon,
  PlusIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid'
import { productService, productHelpers, Product, ColorVariant } from '@/lib/firebase'
import { analytics } from '@/lib/firebase'
import { useFavorites } from '@/app/hooks/useFavorites'
import { useCart } from '@/app/hooks/useCart'
import Toast, { useToast } from '@/app/components/Toast'
import Accordion from '@/app/components/Accordion'
import { trackViewItem, trackAddToCart as trackAddToCartEvent } from '@/lib/dataLayer'
import { getColorName } from '@/lib/colors'

interface ProductWithVariants extends Product {
  colorVariants: Record<string, {
    colorSlug: string;
    isActive?: boolean;
    priceOverride?: number;
    salePrice?: number;
    stockBySize: Record<string, number>;
    metaTitle?: string;
    metaDescription?: string;
    images: string[];
    primaryImage?: string;
    videos?: string[];
  }>
  defaultColorVariant?: {
    colorSlug: string;
    isActive?: boolean;
    priceOverride?: number;
    salePrice?: number;
    stockBySize: Record<string, number>;
    metaTitle?: string;
    metaDescription?: string;
    images: string[];
    primaryImage?: string;
    videos?: string[];
  }
}

export default function ProductColorPage() {
  const params = useParams()
  const router = useRouter()
  const [product, setProduct] = useState<ProductWithVariants | null>(null)
  const [currentVariant, setCurrentVariant] = useState<{
    colorSlug: string;
    isActive?: boolean;
    priceOverride?: number;
    salePrice?: number;
    stockBySize: Record<string, number>;
    metaTitle?: string;
    metaDescription?: string;
    images: string[];
    primaryImage?: string;
    videos?: string[];
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [selectedSize, setSelectedSize] = useState<string>('')
  const [quantity, setQuantity] = useState(1)
  const [isClient, setIsClient] = useState(false)
  const [isAddingToCart, setIsAddingToCart] = useState(false)
  
  // Image navigation state
  const touchStartXRef = useRef<number | null>(null)
  const touchStartYRef = useRef<number | null>(null)
  const touchStartTimeRef = useRef<number | null>(null)
  const lastTouchXRef = useRef<number | null>(null)
  const lastTouchTimeRef = useRef<number | null>(null)
  const isSwipingRef = useRef(false)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState(0)
  const [isTransitionEnabled, setIsTransitionEnabled] = useState(true)
  const [transitionDurationMs, setTransitionDurationMs] = useState(260)
  const [carouselWidth, setCarouselWidth] = useState(0)
  const [carouselPositionState, setCarouselPositionState] = useState(1)
  const carouselPositionRef = useRef(1)
  const carouselContainerRef = useRef<HTMLDivElement | null>(null)
  
  // Favorites hook
  const { isFavorite, toggleFavorite } = useFavorites()
  
  // Cart hook
  const { addToCart } = useCart()
  
  // Toast hook
  const { toast, showToast, hideToast } = useToast()

  const setCarouselPosition = useCallback((value: number | ((prev: number) => number)) => {
    setCarouselPositionState((prev) => {
      const nextValue = typeof value === 'function' ? (value as (prevValue: number) => number)(prev) : value
      carouselPositionRef.current = nextValue
      return nextValue
    })
  }, [setCarouselPositionState])

  const mediaItems = useMemo(() => {
    if (!currentVariant) return []

    const items: Array<{ type: 'image' | 'video'; src: string; index: number }> = []
    const images = currentVariant.images || []
    const videos = currentVariant.videos || []

    images.forEach((src, index) => {
      if (src) {
        items.push({
          type: 'image',
          src,
          index,
        })
      }
    })

    const videoStartIndex = images.length
    videos.forEach((src, videoIdx) => {
      if (src) {
        items.push({
          type: 'video',
          src,
          index: videoStartIndex + videoIdx,
        })
      }
    })

    return items
  }, [currentVariant])

  const totalMediaCount = mediaItems.length

  const extendedMediaItems = useMemo(() => {
    if (totalMediaCount <= 1) return mediaItems

    const firstItem = mediaItems[0]
    const lastItem = mediaItems[totalMediaCount - 1]
    return [lastItem, ...mediaItems, firstItem]
  }, [mediaItems, totalMediaCount])

  // Get language, baseSku, and colorSlug from params
  const lng = params?.lng as string || 'en'
  const baseSku = params?.baseSku as string
  const colorSlug = params?.colorSlug as string
  const isRTL = lng === 'he'

  const getResponsiveDuration = useCallback(() => {
    if (typeof window === 'undefined') {
      return 260
    }
    return window.innerWidth < 768 ? 320 : 240
  }, [])

  // Client-side only effect
  useEffect(() => {
    setIsClient(true)
  }, [])

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

  // Set up real-time listener for product data
  useEffect(() => {
    if (!baseSku || !colorSlug || !isClient) return

    setLoading(true)
    setError(null)

    // Set up real-time listener
    const unsubscribe = productService.onProductByBaseSku(baseSku, (productData) => {
      try {
        if (!productData) {
          setError('Product not found')
          setLoading(false)
          return
        }


        // Find the specific color variant
        const variant = Object.values(productData.colorVariants || {}).find(v => v.colorSlug === colorSlug)
        
        if (!variant) {
          setError('Color variant not found')
          setLoading(false)
          return
        }

        // Check if the variant is active
        if (variant.isActive === false) {
          setError('Color variant is not available')
          setLoading(false)
          return
        }


        setProduct(productData)
        setCurrentVariant(variant)
        
        // Set default size from first available
        const availableSizes = Object.keys(variant.stockBySize).filter(size => variant.stockBySize[size] > 0)
        if (availableSizes.length > 0) {
          setSelectedSize(availableSizes[0])
        }

        // Reset image selection to 0 (video will be shown if available)
        setSelectedImageIndex(0)

        const totalMedia = (variant.images?.length || 0) + (variant.videos?.length || 0)
        if (totalMedia > 1) {
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
        } else {
          setCarouselPosition(0)
        }

        // Fire Product View analytics event (Firebase)
        if (analytics && typeof analytics.logEvent === 'function' && productData) {
          try {
            analytics.logEvent('view_item', {
              currency: 'USD',
              value: variant.salePrice || productData.price,
              items: [{
                item_id: `${baseSku}-${colorSlug}`,
                item_name: `${baseSku} - ${variant.colorSlug}`,
                item_category: productData.category || 'Unknown',
                price: variant.salePrice || productData.price,
                quantity: 1
              }]
            })
          } catch (analyticsError) {
            console.warn('Analytics error:', analyticsError)
          }
        }

        // Track view_item for GA4 data layer
        try {
          const productName = productHelpers.getField(productData, 'name', lng as 'en' | 'he') || productData.title_en || productData.title_he || 'Unknown Product'
          const itemId = `${baseSku}-${colorSlug}`
          const price = variant.salePrice || variant.priceOverride || productData.price
          const categories = productData.categories_path || [productData.category || 'Unknown']
          
          trackViewItem(
            `${productName} - ${variant.colorSlug}`,
            itemId,
            price,
            {
              brand: productData.brand,
              categories: categories,
              variant: variant.colorSlug,
              quantity: 1,
              currency: productData.currency || 'ILS'
            }
          )
        } catch (dataLayerError) {
          console.warn('Data layer tracking error:', dataLayerError)
        }
        
        setLoading(false)
      } catch (error) {
        console.error('Error processing real-time product data:', error)
        setError('Failed to process product data')
        setLoading(false)
      }
    })

    // Cleanup listener on unmount or dependency change
    return () => {
      unsubscribe()
    }
  }, [baseSku, colorSlug, lng, isClient])

  // Get current price (variant price takes precedence)
  const getCurrentPrice = useCallback(() => {
    if (!currentVariant) return 0
    
    // First check for variant-specific sale price
    if (currentVariant.salePrice) return currentVariant.salePrice
    // Then check for product-level sale price
    if (product?.salePrice) return product.salePrice
    // Then check for variant price override
    if ('price' in currentVariant && typeof currentVariant.price === 'number' && currentVariant.price) {
      return currentVariant.price
    }
    return product?.price || 0
  }, [currentVariant, product])

  // Get original price (without any sale price)
  const getOriginalPrice = useCallback(() => {
    if (!currentVariant) return product?.price || 0
    
    // Check for variant price override first
    if ('price' in currentVariant && typeof currentVariant.price === 'number' && currentVariant.price) {
      return currentVariant.price
    }
    return product?.price || 0
  }, [currentVariant, product])

  // Check if there's any sale price (variant or product level)
  const hasSalePrice = useCallback(() => {
    return currentVariant?.salePrice || product?.salePrice
  }, [currentVariant, product])

  // Get the sale price (variant takes precedence over product)
  const getSalePrice = useCallback(() => {
    return currentVariant?.salePrice || product?.salePrice
  }, [currentVariant, product])

  // Get stock for selected size
  const getSizeStock = useCallback((size: string) => {
    if (!currentVariant) return 0
    return currentVariant.stockBySize[size] || 0
  }, [currentVariant])

  // Reset quantity when size changes
  useEffect(() => {
    if (selectedSize && currentVariant) {
      const sizeStock = getSizeStock(selectedSize)
      if (quantity > sizeStock) {
        setQuantity(Math.max(1, sizeStock))
      }
    }
  }, [selectedSize, currentVariant, quantity, getSizeStock])

  // Handle color change - navigate to new URL
  const handleColorChange = (newColorSlug: string) => {
    router.push(`/${lng}/product/${baseSku}/${newColorSlug}`)
  }


  // Get total media count for navigation
  const getTotalMediaCount = useCallback(() => {
    return totalMediaCount
  }, [totalMediaCount])

  const handleMediaIndexChange = useCallback((targetIndex: number) => {
    const total = getTotalMediaCount()
    if (total === 0) return

    const normalizedIndex = ((targetIndex % total) + total) % total
    setSelectedImageIndex(normalizedIndex)

    if (total > 1) {
      setIsTransitionEnabled(true)
      setTransitionDurationMs(getResponsiveDuration())
      setCarouselPosition(normalizedIndex + 1)
    } else {
      setTransitionDurationMs(getResponsiveDuration())
      setCarouselPosition(normalizedIndex)
    }
    setDragOffset(0)
  }, [getResponsiveDuration, getTotalMediaCount, setCarouselPosition])

  const goToNextMedia = useCallback(() => {
    const total = getTotalMediaCount()
    if (total <= 1) return

    setIsTransitionEnabled(true)
    setTransitionDurationMs(getResponsiveDuration())
    setCarouselPosition((prev) => prev + 1)
    setSelectedImageIndex((prev) => {
      const nextIndex = (prev + 1) % total
      return nextIndex
    })
    setDragOffset(0)
  }, [getResponsiveDuration, getTotalMediaCount, setCarouselPosition])

  const goToPreviousMedia = useCallback(() => {
    const total = getTotalMediaCount()
    if (total <= 1) return

    setIsTransitionEnabled(true)
    setTransitionDurationMs(getResponsiveDuration())
    setCarouselPosition((prev) => prev - 1)
    setSelectedImageIndex((prev) => {
      const nextIndex = ((prev - 1) % total + total) % total
      return nextIndex
    })
    setDragOffset(0)
  }, [getResponsiveDuration, getTotalMediaCount, setCarouselPosition])

  const handleCarouselTransitionEnd = useCallback(() => {
    const total = getTotalMediaCount()
    if (total <= 1) return

    if (carouselPositionRef.current === 0) {
      setIsTransitionEnabled(false)
      setCarouselPosition(total)

      if (typeof window !== 'undefined') {
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => {
            setIsTransitionEnabled(true)
          })
        })
      } else {
        setIsTransitionEnabled(true)
      }
    } else if (carouselPositionRef.current === total + 1) {
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
  }, [getTotalMediaCount, setCarouselPosition])

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
      return
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault()
      if (isRTL) {
        goToPreviousMedia()
      } else {
        goToNextMedia()
      }
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      if (isRTL) {
        goToNextMedia()
      } else {
        goToPreviousMedia()
      }
    }
  }, [goToNextMedia, goToPreviousMedia, isRTL])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown])

  const handleTouchStart = useCallback((event: ReactTouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0]
    touchStartXRef.current = touch.clientX
    touchStartYRef.current = touch.clientY
    touchStartTimeRef.current = typeof performance !== 'undefined' ? performance.now() : Date.now()
    lastTouchXRef.current = touch.clientX
    lastTouchTimeRef.current = typeof performance !== 'undefined' ? performance.now() : Date.now()
    isSwipingRef.current = false
    setIsTransitionEnabled(false)
    setIsDragging(true)
    setDragOffset(0)
  }, [])

  const handleTouchMove = useCallback((event: ReactTouchEvent<HTMLDivElement>) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null) return
    const touch = event.touches[0]
    const deltaX = touch.clientX - touchStartXRef.current
    const deltaY = touch.clientY - touchStartYRef.current

    if (!isSwipingRef.current && Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
      isSwipingRef.current = true
    }

    if (isSwipingRef.current) {
      if (carouselWidth > 0) {
        const maxOffset = carouselWidth * 0.35
        const clampedDelta = Math.max(Math.min(deltaX, maxOffset), -maxOffset)
        setDragOffset(clampedDelta)
      } else {
        setDragOffset(deltaX)
      }
      lastTouchXRef.current = touch.clientX
      lastTouchTimeRef.current = typeof performance !== 'undefined' ? performance.now() : Date.now()
    }
  }, [carouselWidth])

  const handleTouchEnd = useCallback((event: ReactTouchEvent<HTMLDivElement>) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null) return

    const touch = event.changedTouches[0]
    const deltaX = touch.clientX - touchStartXRef.current
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
    const lastTime = lastTouchTimeRef.current ?? now
    const lastX = lastTouchXRef.current ?? touch.clientX
    const timeSinceLast = Math.max(1, now - lastTime)
    const deltaSinceLast = touch.clientX - lastX

    const instantaneousVelocity = deltaSinceLast / timeSinceLast
    const totalTime = touchStartTimeRef.current ? Math.max(1, now - touchStartTimeRef.current) : timeSinceLast
    const averageVelocity = deltaX / totalTime
    const velocity = instantaneousVelocity !== 0 ? instantaneousVelocity : averageVelocity

    const width = carouselWidth || (carouselContainerRef.current?.offsetWidth ?? 0)
    const distanceThreshold = width > 0 ? width * 0.28 : 80
    const velocityThreshold = 0.35

    const shouldCommitByDistance = Math.abs(deltaX) >= distanceThreshold
    const shouldCommitByVelocity = Math.abs(velocity) >= velocityThreshold
    const shouldCommit = shouldCommitByDistance || shouldCommitByVelocity

    setIsTransitionEnabled(true)
    setTransitionDurationMs(getResponsiveDuration())

    if (shouldCommit) {
      const directionalDelta = deltaX !== 0 ? deltaX : velocity
      if (directionalDelta < 0) {
        goToNextMedia()
      } else {
        goToPreviousMedia()
      }
    } else {
      setDragOffset(0)
    }

    touchStartXRef.current = null
    touchStartYRef.current = null
    touchStartTimeRef.current = null
    lastTouchXRef.current = null
    lastTouchTimeRef.current = null
    isSwipingRef.current = false
    setIsDragging(false)
  }, [carouselWidth, getResponsiveDuration, goToNextMedia, goToPreviousMedia, isRTL])

  const handleTouchCancel = useCallback(() => {
    touchStartXRef.current = null
    touchStartYRef.current = null
    touchStartTimeRef.current = null
    lastTouchXRef.current = null
    lastTouchTimeRef.current = null
    isSwipingRef.current = false
    setDragOffset(0)
    setIsTransitionEnabled(true)
    setIsDragging(false)
    setTransitionDurationMs(getResponsiveDuration())
  }, [getResponsiveDuration])

  // Show loading until client-side hydration is complete
  if (!isClient) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading product...</p>
        </div>
      </div>
    )
  }

  if (error || !product || !currentVariant) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <ExclamationTriangleIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            {lng === 'he' ? 'מוצר לא נמצא' : 'Product Not Found'}
          </h1>
          <p className="text-gray-600 mb-6">
            {lng === 'he' 
              ? 'המוצר או הצבע שחיפשת לא קיים או הוסר מהקטלוג.' 
              : 'The product or color you\'re looking for doesn\'t exist or has been removed from the catalog.'
            }
          </p>
          <Link 
            href={`/${lng}/collection`}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
          >
            <ChevronLeftIcon className={`h-4 w-4 ${lng === 'he' ? 'ml-2' : 'mr-2'}`} />
            {lng === 'he' ? 'חזור לאוסף' : 'Back to Collection'}
          </Link>
        </div>
      </div>
    )
  }

  const productName = productHelpers.getField(product, 'name', lng as 'en' | 'he')
  const productDescription = productHelpers.getField(product, 'description', lng as 'en' | 'he')
  const nextMediaLabel = lng === 'he' ? 'המדיה הבאה' : 'Next media'
  const previousMediaLabel = lng === 'he' ? 'המדיה הקודמת' : 'Previous media'
  const LeftArrowIconComponent = ChevronLeftIcon
  const RightArrowIconComponent = ChevronRightIcon
  const currentPrice = getCurrentPrice()
  const currentStock = getSizeStock(selectedSize)
  const isOutOfStock = currentStock <= 0
  const baseSlidePosition = totalMediaCount > 1 ? carouselPositionState : selectedImageIndex
  const translateDeltaPercentage = carouselWidth > 0 ? (dragOffset / carouselWidth) * 100 : 0
  const translateValue = -(baseSlidePosition * 100) + translateDeltaPercentage

  const handleAddToCart = async () => {
    if (isOutOfStock || isAddingToCart || !selectedSize) return

    setIsAddingToCart(true)

    const sizeLabel = selectedSize
    const cartSku = baseSku
    const variantItemId = `${baseSku}-${colorSlug}-${sizeLabel}`
    const itemName = `${productName} - ${currentVariant.colorSlug}`
    const categories = product.categories_path || [product.category || 'Unknown']

    // Fire Add to Cart analytics event (Firebase)
    if (analytics && typeof analytics.logEvent === 'function') {
      try {
        analytics.logEvent('add_to_cart', {
          currency: 'USD',
          value: currentPrice * quantity,
          items: [{
            item_id: variantItemId,
            item_name: `${baseSku} - ${currentVariant.colorSlug}`,
            item_category: product.category || 'Unknown',
            item_variant: `${sizeLabel}-${currentVariant.colorSlug}`,
            price: currentPrice,
            quantity: quantity
          }]
        })
      } catch (analyticsError) {
        console.warn('Analytics error:', analyticsError)
      }
    }

    // Track add_to_cart for GA4 data layer
    try {
      trackAddToCartEvent(
        [{
          name: itemName,
          id: variantItemId,
          price: currentPrice,
          brand: product.brand,
          categories: categories,
          variant: `${sizeLabel}-${currentVariant.colorSlug}`,
          quantity: quantity
        }],
        product.currency || 'ILS'
      )
    } catch (dataLayerError) {
      console.warn('Data layer tracking error:', dataLayerError)
    }

    // Add to cart
    const resolvedSalePrice = getSalePrice()
    const baseNameEn = productHelpers.getField(product, 'name', 'en') || product.title_en || ''
    const baseNameHe = productHelpers.getField(product, 'name', 'he') || product.title_he || ''
    const baseCartItem = {
      sku: cartSku,
      name: {
        en: baseNameEn,
        he: baseNameHe
      },
      price: getOriginalPrice(),
      salePrice: resolvedSalePrice && resolvedSalePrice > 0 && resolvedSalePrice < getOriginalPrice() ? resolvedSalePrice : undefined,
      currency: 'USD',
      image: currentVariant.images?.[0],
      size: sizeLabel,
      color: currentVariant.colorSlug,
      maxStock: currentStock
    }
    addToCart(baseCartItem)
    
    // Add multiple items if quantity > 1
    for (let i = 1; i < quantity; i++) {
      addToCart({ ...baseCartItem })
    }
    
    // Show success toast
    const successMessage = lng === 'he' 
      ? `הוספת ${quantity} ${quantity === 1 ? 'פריט' : 'פריטים'} לעגלה` 
      : `Added ${quantity} ${quantity === 1 ? 'item' : 'items'} to cart`
    showToast(successMessage, 'success')
    
    // Reset button state after a short delay
    setTimeout(() => {
      setIsAddingToCart(false)
    }, 1000)
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${productName} - ${currentVariant.colorSlug}`,
          text: productDescription,
          url: window.location.href,
        })
      } catch (error) {
        console.log('Error sharing:', error)
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(window.location.href)
      showToast(lng === 'he' ? 'הקישור הועתק' : 'Link copied', 'success')
    }
  }

  // Generate structured data for SEO
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": `${productName} - ${currentVariant.colorSlug}`,
    "description": currentVariant.metaDescription || productDescription,
    "sku": `${baseSku}-${colorSlug}`,
    "brand": {
      "@type": "Brand",
      "name": "Sako"
    },
    "offers": {
      "@type": "Offer",
      "price": currentPrice,
      "priceCurrency": "USD",
      "availability": isOutOfStock ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
      "url": window.location.href
    },
    "image": currentVariant.images || [],
    "category": product.category,
    "color": currentVariant.colorSlug
  }

  return (
    <>
      <Head>
        <title>{currentVariant.metaTitle || `${productName} - ${currentVariant.colorSlug}`} | Sako</title>
        <meta name="description" content={currentVariant.metaDescription || productDescription} />
        <meta name="keywords" content={`${productName}, ${currentVariant.colorSlug}, ${product.category || ''}, shoes, footwear, ${baseSku}`} />
        
        {/* Canonical URL */}
        <link rel="canonical" href={`https://sako-or.com/${lng}/product/${baseSku}/${colorSlug}`} />
        
        {/* Hreflang for language alternatives */}
        <link rel="alternate" hrefLang="en" href={`https://sako-or.com/en/product/${baseSku}/${colorSlug}`} />
        <link rel="alternate" hrefLang="he" href={`https://sako-or.com/he/product/${baseSku}/${colorSlug}`} />
        <link rel="alternate" hrefLang="x-default" href={`https://sako-or.com/en/product/${baseSku}/${colorSlug}`} />
        
        {/* Open Graph */}
        <meta property="og:title" content={`${productName} - ${currentVariant.colorSlug}`} />
        <meta property="og:description" content={currentVariant.metaDescription || productDescription} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`https://sako-or.com/${lng}/product/${baseSku}/${colorSlug}`} />
        <meta property="og:image" content={currentVariant.images?.[0]} />
        <meta property="og:site_name" content="Sako" />
        <meta property="product:price:amount" content={currentPrice.toString()} />
        <meta property="product:price:currency" content="USD" />
        <meta property="product:availability" content={isOutOfStock ? "out of stock" : "in stock"} />
        <meta property="product:condition" content="new" />
        <meta property="product:brand" content="Sako" />
        <meta property="product:color" content={currentVariant.colorSlug} />
        
        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`${productName} - ${currentVariant.colorSlug}`} />
        <meta name="twitter:description" content={currentVariant.metaDescription || productDescription} />
        <meta name="twitter:image" content={currentVariant.images?.[0]} />
      </Head>

      {/* Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <div className={`min-h-screen bg-white ${isRTL ? 'rtl' : 'ltr'}`}>
        {/* Breadcrumb Navigation */}
        <div className="pt-[104px] bg-white border-b border-gray-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="py-6" aria-label="Breadcrumb">
              <ol className={`flex items-center space-x-1 text-sm ${isRTL ? 'space-x-reverse' : ''}`}>
                <li>
                  <Link 
                    href={`/${lng}`} 
                    className="text-gray-500 hover:text-gray-700 transition-colors duration-200 font-medium"
                  >
                    {lng === 'he' ? 'בית' : 'Home'}
                  </Link>
                </li>
                <li>
                  <div className="flex items-center">
                    <ChevronLeftIcon className={`h-4 w-4 text-gray-300 mx-2 ${isRTL ? 'rotate-90' : 'rotate-270'}`} />
                  </div>
                </li>
                <li>
                  <Link 
                    href={`/${lng}/collection`} 
                    className="text-gray-500 hover:text-gray-700 transition-colors duration-200 font-medium"
                  >
                    {lng === 'he' ? 'קולקציה' : 'Collection'}
                  </Link>
                </li>
                <li>
                  <div className="flex items-center">
                    <ChevronLeftIcon className={`h-4 w-4 text-gray-300 mx-2 ${isRTL ? 'rotate-90' : 'rotate-270'}`} />
                  </div>
                </li>
                <li>
                <Link 
                    href={`/${lng}/collection/${product.categories_path[0]}`} 
                    className="text-gray-500 hover:text-gray-700 transition-colors duration-200 font-medium"
                  >
                    {product.categories_path[0]}
                  </Link>
                </li>
                <li>
                  <div className="flex items-center">
                    <ChevronLeftIcon className={`h-4 w-4 text-gray-300 mx-2 ${isRTL ? 'rotate-90' : 'rotate-270'}`} />
                  </div>
                </li>
                <li>
                  <span className="text-gray-600 font-medium">{product.sku} {getColorName(currentVariant.colorSlug, lng as 'en' | 'he')}</span>
                </li>
              </ol>
            </nav>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Product Images and Video */}
            <div className="space-y-4">
              {/* Main Media Carousel */}
              <div
                className="group aspect-w-1 aspect-h-1 w-full overflow-hidden bg-gray-200 rounded-lg relative touch-pan-y"
                ref={carouselContainerRef}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onTouchCancel={handleTouchCancel}
              >
                {/* Media indicator dots */}
                {getTotalMediaCount() > 1 && (
                  <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 flex space-x-2">
                    {Array.from({ length: getTotalMediaCount() }).map((_, index) => (
                      <div
                        key={index}
                        className={`w-2 h-2 rounded-full transition-all duration-200 ${
                          selectedImageIndex === index ? 'bg-white' : 'bg-white/50'
                        }`}
                      />
                    ))}
                  </div>
                )}

                {/* Media Container */}
                <div 
                  dir="ltr"
                  className="flex h-full w-full transition-transform"
                  style={{
                    transform: `translate3d(${translateValue}%, 0, 0)`,
                    transitionDuration: isTransitionEnabled ? `${transitionDurationMs}ms` : '0ms',
                    transitionTimingFunction: 'cubic-bezier(.22,.61,.36,1)',
                    willChange: isDragging ? 'transform' : undefined
                  }}
                  onTransitionEnd={handleCarouselTransitionEnd}
                >
                  {extendedMediaItems.length > 0 ? (
                    extendedMediaItems.map((item, extendedIndex) => {
                      const actualIndex = item.index
                      const isClone = totalMediaCount > 1 && (extendedIndex === 0 || extendedIndex === extendedMediaItems.length - 1)
                      const distance = Math.abs(selectedImageIndex - actualIndex)
                      const wrapDistance = totalMediaCount > 0 ? Math.min(distance, totalMediaCount - distance) : distance
                      const shouldPreload = wrapDistance <= 1
                      const isActive = selectedImageIndex === actualIndex && !isClone

                      if (item.type === 'image') {
                        return (
                          <div key={`media-image-${extendedIndex}-${actualIndex}`} className="w-full h-full flex-shrink-0 relative">
                            <Image
                              src={item.src}
                              alt={`${productName} - ${currentVariant.colorSlug}`}
                              width={600}
                              height={600}
                              className="h-full w-full object-cover object-center"
                              priority={shouldPreload && !isClone}
                              unoptimized={true}
                              loading={shouldPreload && !isClone ? undefined : 'lazy'}
                              draggable={false}
                              decoding={isActive ? 'sync' : 'async'}
                              onError={(e) => {
                                console.error('Image failed to load:', item.src, 'Index:', actualIndex, 'Language:', lng)
                              }}
                              onLoad={() => {
                                console.log('Image loaded successfully:', item.src, 'Index:', actualIndex, 'Language:', lng)
                              }}
                            />
                          </div>
                        )
                      }

                      return (
                        <div key={`media-video-${extendedIndex}-${actualIndex}`} className="w-full h-full flex-shrink-0">
                          <video
                            src={item.src}
                            autoPlay={isActive}
                            loop
                            muted
                            playsInline
                            preload={shouldPreload ? 'auto' : 'metadata'}
                            className="h-full w-full object-cover object-center"
                            poster={currentVariant.images?.[0]}
                          >
                            Your browser does not support the video tag.
                          </video>
                        </div>
                      )
                    })
                  ) : (
                    <div className="w-full h-full flex-shrink-0 flex items-center justify-center bg-gray-200">
                      <span className="text-gray-400">
                        {lng === 'he' ? 'אין תמונה זמינה' : 'No image available'}
                      </span>
                    </div>
                  )}
                </div>

                {getTotalMediaCount() > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={isRTL ? goToNextMedia : goToPreviousMedia}
                      aria-label={isRTL ? nextMediaLabel : previousMediaLabel}
                      className="pointer-events-auto hidden sm:flex items-center justify-center absolute inset-y-0 left-0 px-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
                    >
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-gray-700 shadow">
                        <LeftArrowIconComponent className="h-5 w-5" />
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={isRTL ? goToPreviousMedia : goToNextMedia}
                      aria-label={isRTL ? previousMediaLabel : nextMediaLabel}
                      className="pointer-events-auto hidden sm:flex items-center justify-center absolute inset-y-0 right-0 px-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
                    >
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-gray-700 shadow">
                        <RightArrowIconComponent className="h-5 w-5" />
                      </span>
                    </button>
                  </>
                )}
              </div>

              {/* Thumbnail Images and Video */}
              {((currentVariant.videos && currentVariant.videos.length > 0) || (currentVariant.images && currentVariant.images.length > 0)) && (
                <div className="grid grid-cols-4 gap-2">
                  {/* Image thumbnails */}
                  {currentVariant.images && currentVariant.images.map((image, index) => (
                    <button
                      key={index}
                      onClick={() => handleMediaIndexChange(index)}
                      className={`aspect-w-1 aspect-h-1 w-full overflow-hidden rounded-lg border-2 transition-all duration-200 ${
                        selectedImageIndex === index ? 'border-indigo-600 scale-105' : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <Image
                        src={image}
                        alt={`${productName} - ${currentVariant.colorSlug}`}
                        width={150}
                        height={150}
                        className="h-full w-full object-cover object-center"
                        loading="lazy"
                        draggable={false}
                      />
                    </button>
                  ))}
                  
                  {/* Video thumbnails */}
                  {currentVariant.videos && currentVariant.videos.map((video, index) => {
                    const videoIndex = (currentVariant.images?.length || 0) + index
                    return (
                      <button
                        key={`video-thumb-${index}`}
                        onClick={() => handleMediaIndexChange(videoIndex)}
                        className={`aspect-w-1 aspect-h-1 w-full overflow-hidden rounded-lg border-2 relative transition-all duration-200 ${
                          selectedImageIndex === videoIndex ? 'border-indigo-600 scale-105' : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <video
                          src={video}
                          autoPlay
                          loop
                          muted
                          playsInline
                          preload="metadata"
                          className="h-full w-full object-cover object-center"
                          poster={currentVariant.images?.[0]}
                        >
                          Your browser does not support the video tag.
                        </video>
                        {/* Video play icon overlay */}
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-6 h-6 bg-white/80 rounded-full flex items-center justify-center">
                            <div className="w-0 h-0 border-l-[6px] border-l-gray-700 border-y-[4px] border-y-transparent ml-0.5"></div>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Product Details */}
            <div className="space-y-6">
              {/* Product Header */}
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  {lng === 'he' ? product.title_he : product.title_en}
                </h1>
              </div>

              {/* Price */}
              <div className="flex items-center space-x-4">
                {hasSalePrice() && getSalePrice() && getSalePrice()! < getOriginalPrice() ? (
                  <>
                    <span className="text-3xl font-bold text-red-600">
                      ₪{getSalePrice()!.toFixed(2)}
                    </span>
                    <span className="text-xl text-gray-500 line-through">
                      ₪{getOriginalPrice().toFixed(2)}
                    </span>
                    <span className="bg-red-100 text-red-800 text-sm font-medium px-2.5 py-0.5 rounded">
                      {Math.round((getOriginalPrice() - getSalePrice()!) / getOriginalPrice() * 100)}% {lng === 'he' ? 'הנחה' : 'OFF'}
                    </span>
                  </>
                ) : (
                  <span className="text-3xl font-bold text-gray-900">
                    ₪{currentPrice.toFixed(2)}
                  </span>
                )}
              </div>

              {/* Description */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {lng === 'he' ? 'תיאור' : 'Description'}
                </h3>
                <p className="text-gray-600 leading-relaxed">{lng === 'he' ? product.description_he : product.description_en}</p>
              </div>

              {/* Color Selection */}
              {product.colorVariants && Object.keys(product.colorVariants).length > 1 && (
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {lng === 'he' ? 'צבע' : 'Color'}
                  </h3>
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {Object.values(product.colorVariants)
                      .filter(variant => variant.isActive !== false) // Filter out inactive variants
                      .map((variant) => {
                      const isCurrentVariant = variant.colorSlug === colorSlug
                      // Check if variant has any available sizes (stock > 0)
                      const isVariantOutOfStock = Object.values(variant.stockBySize).every(stock => stock <= 0)
                      const variantImage = variant.primaryImage || variant.images?.[0]
                      
                      return (
                        <button
                          key={variant.colorSlug}
                          onClick={() => {
                            console.log('Color button clicked:', { 
                              colorSlug: variant.colorSlug, 
                              isVariantOutOfStock,
                              currentColorSlug: colorSlug,
                              variantStock: Object.values(variant.stockBySize).reduce((sum, stock) => sum + stock, 0),
                              sizes: Object.entries(variant.stockBySize).map(([size, stock]) => ({ size, stock }))
                            })
                            if (!isVariantOutOfStock) {
                              handleColorChange(variant.colorSlug)
                            }
                          }}
                          disabled={isVariantOutOfStock}
                          className="flex-shrink-0 relative group"
                          title={getColorName(variant.colorSlug, lng as 'en' | 'he')}
                        >
                          {/* Product image */}
                          {variantImage ? (
                            <div className={`w-12 h-12 rounded-full overflow-hidden border-2 border-transparent ${
                              isVariantOutOfStock ? 'opacity-50' : ''
                            }`}>
                              <Image
                                src={variantImage}
                                alt={variant.colorSlug}
                                width={48}
                                height={48}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className={`w-12 h-12 rounded-full border-2 border-gray-200 flex items-center justify-center ${
                              isVariantOutOfStock ? 'opacity-50' : ''
                            }`}>
                              <span className="text-xs text-gray-500">{getColorName(variant.colorSlug, lng as 'en' | 'he')}</span>
                            </div>
                          )}
                          
                          {/* Selection line indicator */}
                          <div 
                            className={`absolute -bottom-1 left-0 w-12 h-0.5 transition-all duration-200 ${
                              isCurrentVariant 
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

              {/* Size Selection */}
              {Object.keys(currentVariant.stockBySize).length > 0 && (
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {lng === 'he' ? 'מידה' : 'Size'}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(currentVariant.stockBySize)
                      .filter(([size, stock]) => stock > 0) // Only show available sizes
                      .map(([size, stock]) => {
                        return (
                          <button
                            key={size}
                            onClick={() => setSelectedSize(size)}
                            className={`px-4 py-2 border rounded-md text-sm font-medium ${
                              selectedSize === size
                                ? 'border-indigo-600 bg-indigo-50 text-indigo-600'
                                : 'border-gray-300 text-gray-700 hover:border-gray-400'
                            }`}
                          >
                            {size}
                          </button>
                        )
                      })}
                  </div>
                </div>
              )}

              {/* Quantity or Out of Stock */}
              {(() => {
                // Check if all sizes are out of stock
                const allSizesOutOfStock = Object.keys(currentVariant.stockBySize).length > 0 && 
                  Object.values(currentVariant.stockBySize).every(stock => stock <= 0)
                
                if (allSizesOutOfStock) {
                  // Show "OUT OF STOCK" message in red
                  return (
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        {lng === 'he' ? 'כמות' : 'Quantity'}
                      </h3>
                      <div className="text-red-600 font-semibold text-lg">
                        {lng === 'he' ? 'אזל מהמלאי' : 'OUT OF STOCK'}
                      </div>
                    </div>
                  )
                }
                
                // Show quantity selector if there are available sizes
                return (
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      {lng === 'he' ? 'כמות' : 'Quantity'}
                    </h3>
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        disabled={quantity <= 1 || isOutOfStock}
                        className="p-2 border border-gray-600 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <MinusIcon className="h-4 w-4 text-gray-600" />
                      </button>
                      <span className="text-lg font-medium min-w-[2rem] text-center text-gray-600">{quantity}</span>
                      <button
                        onClick={() => setQuantity(Math.min(quantity + 1, currentStock))}
                        disabled={quantity >= currentStock || isOutOfStock}
                        className="p-2 border border-gray-600 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <PlusIcon className="h-4 w-4 text-gray-600" />
                      </button>
                    </div>
                    {/* Stock Info */}
                    {/* {selectedSize && currentStock > 0 && (
                      <div className="mt-2 text-sm text-gray-600">
                        {lng === 'he' 
                          ? `מקסימום ${currentStock} יחידות זמינות` 
                          : `Maximum ${currentStock} units available`
                        }
                      </div>
                    )} */}
                    {!selectedSize && Object.keys(currentVariant.stockBySize).length > 0 && (
                      <div className="mt-2 text-sm text-gray-500">
                        {lng === 'he' 
                          ? 'אנא בחר מידה' 
                          : 'Please select a size'
                        }
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* Actions */}
              <div className="space-y-4">
                <button
                  onClick={handleAddToCart}
                  disabled={isOutOfStock || (Object.keys(currentVariant.stockBySize).length > 0 && !selectedSize) || isAddingToCart}
                  className={`w-full py-3 px-6 rounded-md font-medium transition-colors duration-200 flex items-center justify-center ${
                    isOutOfStock || (Object.keys(currentVariant.stockBySize).length > 0 && !selectedSize) || isAddingToCart
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700'
                  }`}
                >
                  <ShoppingBagIcon className="h-5 w-5 mr-2" />
                  {(() => {
                    if (isAddingToCart) {
                      return lng === 'he' ? 'מוסיף לעגלה...' : 'Adding to Cart...'
                    } else if (isOutOfStock) {
                      return lng === 'he' ? 'אזל מהמלאי' : 'Out of Stock'
                    } else if (Object.keys(currentVariant.stockBySize).length > 0 && !selectedSize) {
                      return lng === 'he' ? 'בחר מידה' : 'Select Size'
                    } else {
                      return lng === 'he' ? 'הוסף לעגלה' : 'Add to Cart'
                    }
                  })()}
                </button>

                <div className="flex space-x-4">
                  <button
                    onClick={() => {
                      const baseSkuKey = baseSku
                      toggleFavorite(baseSkuKey)
                    }}
                    className={`flex-1 py-3 px-6 rounded-md font-medium border transition-colors duration-200 flex items-center justify-center ${
                      (() => {
                        const baseSkuKey = baseSku
                        return isFavorite(baseSkuKey)
                      })()
                        ? 'border-red-300 bg-red-50 text-red-600'
                        : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {(() => {
                      const baseSkuKey = baseSku
                      return isFavorite(baseSkuKey)
                    })() ? (
                      <HeartSolidIcon className="h-5 w-5 mr-2" />
                    ) : (
                      <HeartIcon className="h-5 w-5 mr-2" />
                    )}
                    {(() => {
                      const baseSkuKey = baseSku
                      return isFavorite(baseSkuKey)
                    })()
                      ? (lng === 'he' ? 'הוסר מהמועדפים' : 'Remove from Favorites')
                      : (lng === 'he' ? 'הוסף למועדפים' : 'Add to Favorites')
                    }
                  </button>

                  <button
                    onClick={handleShare}
                    className="flex-1 py-3 px-6 rounded-md font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors duration-200 flex items-center justify-center"
                  >
                    <ShareIcon className="h-5 w-5 mr-2" />
                    {lng === 'he' ? 'שתף' : 'Share'}
                  </button>
                </div>
              </div>

              {/* Product Info */}
              <div className="border-t border-gray-200 pt-6">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-gray-900">
                      {lng === 'he' ? 'מידע נוסף' : 'Additional Information'}
                    </h4>
                    <div className="mt-2 space-y-2 text-sm text-gray-600">
                      <div className="flex justify-between">
                        <span>{lng === 'he' ? 'מספר דגם' : 'SKU'}:</span>
                        <span>{baseSku}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{lng === 'he' ? 'צבע' : 'Color'}:</span>
                        <span>{getColorName(currentVariant.colorSlug, lng as 'en' | 'he')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{lng === 'he' ? 'קטגוריה' : 'Category'}:</span>
                        <span>{product.categories_path[0]}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{lng === 'he' ? 'מותג' : 'Brand'}:</span>
                        <span>{product.brand}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Material & Care and Shipping & Returns Sections */}
              <div className="border-t border-gray-200 pt-6">
                <div className="space-y-4">
                  {/* Material & Care Section */}
                  {(product.materialCare?.upperMaterial_en || product.materialCare?.upperMaterial_he || 
                    product.materialCare?.materialInnerSole_en || product.materialCare?.materialInnerSole_he ||
                    product.materialCare?.lining_en || product.materialCare?.lining_he ||
                    product.materialCare?.sole_en || product.materialCare?.sole_he ||
                    product.materialCare?.heelHeight_en || product.materialCare?.heelHeight_he ||
                    product.materialCare?.height_en || product.materialCare?.height_he ||
                    product.materialCare?.depth_en || product.materialCare?.depth_he ||
                    product.materialCare?.width_en || product.materialCare?.width_he ||
                    // Legacy structure support
                    product.upperMaterial || product.materialInnerSole || product.lining || product.sole || product.heelHeight) && (
                    <Accordion title={lng === 'he' ? 'מפרט טכני' : 'Material & Care'}>
                      <div className="space-y-3">
                        {((product.materialCare?.upperMaterial_en || product.materialCare?.upperMaterial_he) || product.upperMaterial) && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">
                              {lng === 'he' ? 'חומר עליון:' : 'Upper Material:'}
                            </span>
                            <span className="text-sm text-gray-900">
                              {product.materialCare?.upperMaterial_en || product.materialCare?.upperMaterial_he 
                                ? (lng === 'he' ? product.materialCare?.upperMaterial_he : product.materialCare?.upperMaterial_en)
                                : (lng === 'he' ? product.upperMaterial?.he : product.upperMaterial?.en)
                              }
                            </span>
                          </div>
                        )}
                        {((product.materialCare?.materialInnerSole_en || product.materialCare?.materialInnerSole_he) || product.materialInnerSole) && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">
                              {lng === 'he' ? 'חומר סוליה פנימית:' : 'Material Inner Sole:'}
                            </span>
                            <span className="text-sm text-gray-900">
                              {product.materialCare?.materialInnerSole_en || product.materialCare?.materialInnerSole_he 
                                ? (lng === 'he' ? product.materialCare?.materialInnerSole_he : product.materialCare?.materialInnerSole_en)
                                : (lng === 'he' ? product.materialInnerSole?.he : product.materialInnerSole?.en)
                              }
                            </span>
                          </div>
                        )}
                        {((product.materialCare?.lining_en || product.materialCare?.lining_he) || product.lining) && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">
                              {lng === 'he' ? 'בטנה:' : 'Lining:'}
                            </span>
                            <span className="text-sm text-gray-900">
                              {product.materialCare?.lining_en || product.materialCare?.lining_he 
                                ? (lng === 'he' ? product.materialCare?.lining_he : product.materialCare?.lining_en)
                                : (lng === 'he' ? product.lining?.he : product.lining?.en)
                              }
                            </span>
                          </div>
                        )}
                        {((product.materialCare?.sole_en || product.materialCare?.sole_he) || product.sole) && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">
                              {lng === 'he' ? 'סוליה:' : 'Sole:'}
                            </span>
                            <span className="text-sm text-gray-900">
                              {product.materialCare?.sole_en || product.materialCare?.sole_he 
                                ? (lng === 'he' ? product.materialCare?.sole_he : product.materialCare?.sole_en)
                                : (lng === 'he' ? product.sole?.he : product.sole?.en)
                              }
                            </span>
                          </div>
                        )}
                        {((product.materialCare?.heelHeight_en || product.materialCare?.heelHeight_he) || product.heelHeight) && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">
                              {lng === 'he' ? 'גובה עקב:' : 'Heel Height:'}
                            </span>
                            <span className="text-sm text-gray-900">
                              {product.materialCare?.heelHeight_en || product.materialCare?.heelHeight_he 
                                ? (lng === 'he' ? product.materialCare?.heelHeight_he : product.materialCare?.heelHeight_en)
                                : (lng === 'he' ? product.heelHeight?.he : product.heelHeight?.en)
                              }
                            </span>
                          </div>
                        )}
                        {(product.materialCare?.height_en || product.materialCare?.height_he) && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">
                              {lng === 'he' ? 'גובה:' : 'Height:'}
                            </span>
                            <span className="text-sm text-gray-900">
                              {lng === 'he' ? product.materialCare?.height_he : product.materialCare?.height_en}
                            </span>
                          </div>
                        )}
                        {(product.materialCare?.depth_en || product.materialCare?.depth_he) && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">
                              {lng === 'he' ? 'עומק:' : 'Depth:'}
                            </span>
                            <span className="text-sm text-gray-900">
                              {lng === 'he' ? product.materialCare?.depth_he : product.materialCare?.depth_en}
                            </span>
                          </div>
                        )}
                        {(product.materialCare?.width_en || product.materialCare?.width_he) && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">
                              {lng === 'he' ? 'רוחב:' : 'Width:'}
                            </span>
                            <span className="text-sm text-gray-900">
                              {lng === 'he' ? product.materialCare?.width_he : product.materialCare?.width_en}
                            </span>
                          </div>
                        )}
                      </div>
                    </Accordion>
                  )}

                  {/* Shipping & Returns Section */}
                  <Accordion title={lng === 'he' ? 'משלוחים והחזרות' : 'Shipping & Returns'}>
                    <div className="text-sm text-gray-600 leading-relaxed">
                      {product.shippingReturns ? (
                        // Custom shipping returns content if provided by admin
                        lng === 'he' ? product.shippingReturns.he : product.shippingReturns.en
                      ) : (
                        // Default shipping returns content
                        lng === 'he' ? (
                          <div className="space-y-3">
                            <p><strong>🚚 משלוחים:</strong></p>
                            <ul className="list-disc list-inside space-y-1 ml-4">
                              <li>משלוח חינם בקנייה מעל 300 ₪</li>
                              <li>בהזמנה מתחת ל־300 ₪ – משלוח עם שליח עד הבית בעלות 45 ₪</li>
                              <li>משלוח מהיר: 3–5 ימי עסקים</li>
                            </ul>
                        
                            <p><strong>🔄 החזרות והחלפות:</strong></p>
                            <ul className="list-disc list-inside space-y-1 ml-4">
                              <li>החזרה בחינם דרך החנות תוך 14 יום</li>
                              <li>החזרה עם שליח – בעלות של 45 ₪</li>
                              <li>החלפה ראשונה ללא עלות</li>
                              <li>המוצר המוחזר חייב להיות חדש, ללא שימוש ובאריזתו המקורית</li>
                              <li>החזר כספי מיידי עם הגעת המוצר אלינו</li>
                            </ul>
                          </div>
                        ) :   (
                          <div className="space-y-3">
                            <p><strong>🚚 Shipping:</strong></p>
                            <ul className="list-disc list-inside space-y-1 ml-4">
                              <li>Free shipping on orders over ₪300</li>
                              <li>Orders under ₪300 – home delivery for ₪45</li>
                              <li>Fast delivery: 3–5 business days</li>
                            </ul>
                        
                            <p><strong>🔄 Returns & Exchanges:</strong></p>
                            <ul className="list-disc list-inside space-y-1 ml-4">
                              <li>Free in-store returns within 14 days</li>
                              <li>Return via courier – ₪30</li>
                              <li>First exchange free of charge</li>
                              <li>Items must be unused and in original packaging</li>
                              <li>Instant refund once the item arrives at our company</li>
                            </ul>
                          </div>
                        )
                      )}
                    </div>
                  </Accordion>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Toast Notification */}
      <Toast
        message={toast.message}
        isVisible={toast.isVisible}
        onClose={hideToast}
        type={toast.type}
      />
    </>
  )
}
