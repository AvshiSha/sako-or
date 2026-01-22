'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import Head from 'next/head'
import { 
  HeartIcon, 
  ShareIcon,
  ShoppingBagIcon,
  MinusIcon,
  PlusIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid'
import { productService, productHelpers, Product, ColorVariant, analytics, logEvent } from '@/lib/firebase'
import { useFavorites } from '@/app/hooks/useFavorites'
import { useCart } from '@/app/hooks/useCart'
import Toast, { useToast } from '@/app/components/Toast'
import Accordion from '@/app/components/Accordion'
import SizeChart from '@/app/components/SizeChart'
import { trackViewItem, trackAddToCart as trackAddToCartEvent } from '@/lib/dataLayer'
import { getColorName } from '@/lib/colors'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from '@/app/components/ui/carousel'
import { buildFavoriteKey } from '@/lib/favorites'

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
  const [isSizeChartOpen, setIsSizeChartOpen] = useState(false)
  
  // Carousel API state
  const [api, setApi] = useState<CarouselApi>()
  
  // Favorites hook
  const { isFavorite, toggleFavorite } = useFavorites()
  
  // Cart hook
  const { addToCart } = useCart()
  
  // Toast hook
  const { toast, showToast, hideToast } = useToast()

  // Get images only (no videos)
  const productImages = useMemo(() => {
    if (!currentVariant) return []
    return currentVariant.images || []
  }, [currentVariant])

  // Get language, baseSku, and colorSlug from params
  const lng = params?.lng as string || 'en'
  const baseSku = params?.baseSku as string
  const colorSlug = params?.colorSlug as string
  const isRTL = lng === 'he'

  // Client-side only effect
  useEffect(() => {
    setIsClient(true)
  }, [])

  // Track carousel selection
  useEffect(() => {
    if (!api) return

    const onSelect = () => {
      const selected = api.selectedScrollSnap()
      setSelectedImageIndex(selected)
    }

    api.on('select', onSelect)
    onSelect() // Set initial index

    return () => {
      api.off('select', onSelect)
    }
  }, [api])

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

        // Reset image selection to 0
        setSelectedImageIndex(0)

        // Fire Product View analytics event (Firebase)
        if (productData) {
          logEvent(analytics, 'view_item', {
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

  // Show loading until client-side hydration is complete
  if (!isClient) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#856D55] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#856D55] mx-auto"></div>
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
            {lng === 'he' ? 'חזור לאוסף' : 'Back to Collection'}
          </Link>
        </div>
      </div>
    )
  }

  const productName = productHelpers.getField(product, 'name', lng as 'en' | 'he')
  const productDescription = productHelpers.getField(product, 'description', lng as 'en' | 'he')
  const currentPrice = getCurrentPrice()
  const currentStock = getSizeStock(selectedSize)
  const isOutOfStock = currentStock <= 0

  const handleAddToCart = async () => {
    if (isOutOfStock || isAddingToCart || !selectedSize) return

    setIsAddingToCart(true)

    const sizeLabel = selectedSize
    const cartSku = baseSku
    const variantItemId = `${baseSku}-${colorSlug}-${sizeLabel}`
    const itemName = `${productName} - ${currentVariant.colorSlug}`
    const categories = product.categories_path || [product.category || 'Unknown']

    // Fire Add to Cart analytics event (Firebase)
    logEvent(analytics, 'add_to_cart', {
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
        <div className="pt-[102px]">
        <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_2fr] gap-0">            {/* Product Images - Full Width */}
            <div className="relative w-full">
              {/* Favorite Heart Icon - Top Left */}
              <button
                onClick={() => void toggleFavorite(buildFavoriteKey(baseSku, colorSlug))}
                className="absolute top-4 left-4 z-20 p-2 rounded-full bg-white/80 backdrop-blur-sm shadow-sm hover:bg-white transition-colors"
                aria-label={isFavorite(buildFavoriteKey(baseSku, colorSlug)) ? (lng === 'he' ? 'הסר ממועדפים' : 'Remove from favorites') : (lng === 'he' ? 'הוסף למועדפים' : 'Add to favorites')}
              >
                {isFavorite(buildFavoriteKey(baseSku, colorSlug)) ? (
                  <HeartSolidIcon className="h-4 w-4 text-red-500" />
                ) : (
                  <HeartIcon className="h-4 w-4 text-gray-700" />
                )}
              </button>

              {/* Main Image Carousel */}
              <Carousel
                setApi={setApi}
                opts={{
                  align: "start",
                  loop: productImages.length > 1,
                }}
                direction={isRTL ? "rtl" : "ltr"}
                className="w-full group"
              >
                <div className="relative aspect-square w-full overflow-hidden">
                  <CarouselContent>
                    {productImages.length > 0 ? (
                      productImages.map((image, index) => (
                        <CarouselItem key={index} className="pl-0">
                          <div className="relative w-full h-full">
                            <Image
                              src={image}
                              alt={`${productName} - ${currentVariant.colorSlug} - ${index + 1}`}
                              width={600}
                              height={600}
                              className="w-full h-full object-cover object-center"
                              priority={index === 0}
                              unoptimized={true}
                              loading={index === 0 ? undefined : 'lazy'}
                              draggable={false}
                            />
                          </div>
                        </CarouselItem>
                      ))
                    ) : (
                      <CarouselItem className="pl-0">
                        <div className="w-full h-full flex items-center justify-center bg-white">
                          <span className="text-gray-400">
                            {lng === 'he' ? 'אין תמונה זמינה' : 'No image available'}
                          </span>
                        </div>
                      </CarouselItem>
                    )}
                  </CarouselContent>

                  {/* Navigation Arrows */}
                  {productImages.length > 1 && (
                    <>
                      {isRTL ? (
                        <>
                          <CarouselPrevious className="!right-2 sm:!right-4 !left-auto !-translate-y-1/2 !opacity-50 z-20 pointer-events-auto h-6 w-6 [&>svg]:text-[#000000] [&>svg]:rotate-180 disabled:!opacity-30 [&[disabled]]:!pointer-events-auto" />
                          <CarouselNext className="!left-2 sm:!left-4 !right-auto !-translate-y-1/2 !opacity-50 z-20 pointer-events-auto h-6 w-6 [&>svg]:text-[#000000] [&>svg]:rotate-180 disabled:!opacity-30 [&[disabled]]:!pointer-events-auto" />
                        </>
                      ) : (
                        <>
                          <CarouselPrevious className="!left-2 sm:!left-4 !-translate-y-1/2 opacity-50 sm:opacity-100 group-hover:opacity-100 transition-opacity pointer-events-auto h-6 w-6 [&>svg]:text-[#000000] z-20" />
                          <CarouselNext className="!right-2 sm:!right-4 !-translate-y-1/2 opacity-50 sm:opacity-100 group-hover:opacity-100 transition-opacity pointer-events-auto h-6 w-6 [&>svg]:text-[#000000] z-20" />
                        </>
                      )}
                    </>
                  )}

                  {/* Pagination Dots - Bottom Center */}
                  {productImages.length > 1 && (
                    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10 flex space-x-2">
                      {productImages.map((_, index) => (
                        <button
                          key={index}
                          onClick={() => api?.scrollTo(index)}
                          className={`w-2 h-2 rounded-full transition-all duration-200 ${
                            selectedImageIndex === index
                              ? 'bg-[#E1DBD7] w-6'
                              : 'bg-[#E1DBD7]/50 hover:bg-[#E1DBD7]/75'
                          }`}
                          aria-label={`${lng === 'he' ? 'עבור לתמונה' : 'Go to image'} ${index + 1}`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </Carousel>
            </div>

            {/* Product Details */}
            <div className={`space-y-6 px-4 sm:px-6 py-4 ${isRTL ? 'lg:pl-48 lg:pr-4' : 'lg:pl-4 lg:pr-48'}`}>
              {/* Mobile Layout */}
              <div className="lg:hidden space-y-2">
                {/* Product Title + Price (same row) */}
                <div className="flex items-start justify-between gap-2">
                  <h1 className="text-2xl font-bold text-gray-900 flex-1">
                    {lng === 'he' ? product.title_he : product.title_en}
                  </h1>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {hasSalePrice() && getSalePrice() && getSalePrice()! < getOriginalPrice() ? (
                      <>
                        <div className="flex flex-col items-end">
                          <span className="text-2xl font-bold text-red-600">
                            ₪{getSalePrice()!.toFixed(2)}
                          </span>
                          <span className="text-sm text-gray-500 line-through">
                            ₪{getOriginalPrice().toFixed(2)}
                          </span>
                        </div>
                      </>
                    ) : (
                      <span className="text-2xl font-bold text-gray-900">
                        ₪{currentPrice.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Product Variants (Colors) */}
                {product.colorVariants && Object.keys(product.colorVariants).length > 1 && (
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      {lng === 'he' ? 'צבע' : 'Color'}
                    </h3>
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {Object.values(product.colorVariants)
                        .filter(variant => variant.isActive !== false)
                        .map((variant) => {
                        const isCurrentVariant = variant.colorSlug === colorSlug
                        const isVariantOutOfStock = Object.values(variant.stockBySize).every(stock => stock <= 0)
                        const variantImage = variant.primaryImage || variant.images?.[0]
                        
                        return (
                          <button
                            key={variant.colorSlug}
                            onClick={() => {
                              if (!isVariantOutOfStock) {
                                handleColorChange(variant.colorSlug)
                              }
                            }}
                            disabled={isVariantOutOfStock}
                            className="flex-shrink-0 relative group"
                            title={getColorName(variant.colorSlug, lng as 'en' | 'he')}
                          >
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
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-medium text-gray-900">
                        {lng === 'he' ? 'מידה' : 'Size'}
                      </h3>
                      <button 
                        onClick={() => setIsSizeChartOpen(true)}
                        className="text-sm text-gray-600 underline hover:text-gray-900 transition-colors"
                      >
                        {lng === 'he' ? 'טבלת מידות' : 'Size Chart'}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(currentVariant.stockBySize)
                        .filter(([size, stock]) => stock > 0)
                        .map(([size, stock]) => {
                          return (
                            <button
                              key={size}
                              onClick={() => setSelectedSize(size)}
                              className={`px-4 py-2 border rounded-md text-sm font-medium ${
                                selectedSize === size
                                  ? 'border-[#856D55] bg-[#B2A28E] text-[#000000]'
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

                {/* Quantity Selector */}
                {(() => {
                  const allSizesOutOfStock = Object.keys(currentVariant.stockBySize).length > 0 && 
                    Object.values(currentVariant.stockBySize).every(stock => stock <= 0)
                  
                  if (allSizesOutOfStock) {
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

                {/* Add to Bag Button */}
                <button
                  onClick={handleAddToCart}
                  disabled={isOutOfStock || (Object.keys(currentVariant.stockBySize).length > 0 && !selectedSize) || isAddingToCart}
                  className={`w-full py-3 px-6 rounded-md font-medium transition-colors duration-200 flex items-center justify-center gap-2 ${
                    isOutOfStock || (Object.keys(currentVariant.stockBySize).length > 0 && !selectedSize) || isAddingToCart
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-[#B2A28E] text-[#000000] hover:bg-[#856D55]'
                  }`}
                >
                  <ShoppingBagIcon className="h-5 w-5" />
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

                {/* Actions Row: Share & Favorites */}
                <div className="flex space-x-4">
                  <button
                    onClick={handleShare}
                    className="flex-1 py-2 px-2 rounded-md text-xs font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors duration-200 flex items-center justify-center gap-1"
                  >
                    <ShareIcon className="h-3 w-3" />
                    {lng === 'he' ? 'שתף' : 'Share'}
                  </button>
                  <button
                    onClick={() => {
                      void toggleFavorite(buildFavoriteKey(baseSku, colorSlug))
                    }}
                    className={`flex-1 py-2 px-2 rounded-md text-xs font-medium border transition-colors duration-200 flex items-center justify-center gap-1 ${
                      isFavorite(buildFavoriteKey(baseSku, colorSlug))
                        ? 'border-red-300 bg-red-50 text-red-600'
                        : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {isFavorite(buildFavoriteKey(baseSku, colorSlug)) ? (
                      <HeartSolidIcon className="h-3 w-3" />
                    ) : (
                      <HeartIcon className="h-3 w-3" />
                    )}
                    {isFavorite(buildFavoriteKey(baseSku, colorSlug))
                      ? (lng === 'he' ? 'הוסר מהמועדפים' : 'Remove from Favorites')
                      : (lng === 'he' ? 'הוסף למועדפים' : 'Add to Favorites')
                    }
                  </button>
                </div>

                {/* Benefits / Info Lines */}
                <div className="space-y-4 text-sm text-gray-600 bg-[#E1DBD7] p-2 rounded-md gap">
                  <div>
                    {lng === 'he' 
                      ? 'משלוח חינם בקנייה מעל 300 ₪' 
                      : 'Free delivery above 300 ILS'
                    }
                  </div>
                  <div>
                    {lng === 'he' 
                      ? 'החלפה ראשונה ללא עלות – ללא עלות משלוח' 
                      : 'First exchange is free – no shipping cost'
                    }
                  </div>
                </div>

                {/* Product Description */}
                <div className="text-lg font-medium text-gray-900 mb-2">{lng === 'he' ? 'תיאור' : 'Description'}</div>
                <div>
                  <p className="text-gray-600 leading-relaxed">{lng === 'he' ? product.description_he : product.description_en}</p>
                </div>
              </div>

              {/* Desktop Layout */}
              <div className="hidden lg:block space-y-2">
                {/* Product Title + Price (same row) */}
                <div className="flex items-start justify-between gap-2">
                  <h1 className="text-2xl font-bold text-gray-900 flex-1">
                    {lng === 'he' ? product.title_he : product.title_en}
                  </h1>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {hasSalePrice() && getSalePrice() && getSalePrice()! < getOriginalPrice() ? (
                      <>
                        <div className="flex flex-col items-end">
                          <span className="text-2xl font-bold text-red-600">
                            ₪{getSalePrice()!.toFixed(2)}
                          </span>
                          <span className="text-sm text-gray-500 line-through">
                            ₪{getOriginalPrice().toFixed(2)}
                          </span>
                        </div>
                      </>
                    ) : (
                      <span className="text-2xl font-bold text-gray-900">
                        ₪{currentPrice.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Color Selection */}
                {product.colorVariants && Object.keys(product.colorVariants).length > 1 && (
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      {lng === 'he' ? 'צבע' : 'Color'}
                    </h3>
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {Object.values(product.colorVariants)
                        .filter(variant => variant.isActive !== false)
                        .map((variant) => {
                        const isCurrentVariant = variant.colorSlug === colorSlug
                        const isVariantOutOfStock = Object.values(variant.stockBySize).every(stock => stock <= 0)
                        const variantImage = variant.primaryImage || variant.images?.[0]
                        
                        return (
                          <button
                            key={variant.colorSlug}
                            onClick={() => {
                              if (!isVariantOutOfStock) {
                                handleColorChange(variant.colorSlug)
                              }
                            }}
                            disabled={isVariantOutOfStock}
                            className="flex-shrink-0 relative group"
                            title={getColorName(variant.colorSlug, lng as 'en' | 'he')}
                          >
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
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-medium text-gray-900">
                        {lng === 'he' ? 'מידה' : 'Size'}
                      </h3>
                      <button 
                        onClick={() => setIsSizeChartOpen(true)}
                        className="text-sm text-gray-600 underline hover:text-gray-900 transition-colors"
                      >
                        {lng === 'he' ? 'טבלת מידות' : 'Size Chart'}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(currentVariant.stockBySize)
                        .filter(([size, stock]) => stock > 0)
                        .map(([size, stock]) => {
                          return (
                            <button
                              key={size}
                              onClick={() => setSelectedSize(size)}
                              className={`px-4 py-2 border rounded-md text-sm font-medium ${
                                selectedSize === size
                                  ? 'border-[#856D55] bg-[#B2A28E] text-[#000000]'
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
                  const allSizesOutOfStock = Object.keys(currentVariant.stockBySize).length > 0 && 
                    Object.values(currentVariant.stockBySize).every(stock => stock <= 0)
                  
                  if (allSizesOutOfStock) {
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

                {/* Add to Bag Button */}
                <button
                  onClick={handleAddToCart}
                  disabled={isOutOfStock || (Object.keys(currentVariant.stockBySize).length > 0 && !selectedSize) || isAddingToCart}
                  className={`w-full py-3 px-6 rounded-md font-medium transition-colors duration-200 flex items-center justify-center gap-2 ${
                    isOutOfStock || (Object.keys(currentVariant.stockBySize).length > 0 && !selectedSize) || isAddingToCart
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-[#B2A28E] text-[#000000] hover:bg-[#856D55]'
                  }`}
                >
                  <ShoppingBagIcon className="h-5 w-5" />
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

                {/* Actions Row: Share & Favorites */}
                <div className="flex space-x-4">
                  <button
                    onClick={handleShare}
                    className="flex-1 py-2 px-2 rounded-md text-xs font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors duration-200 flex items-center justify-center gap-1"
                  >
                    <ShareIcon className="h-3 w-3" />
                    {lng === 'he' ? 'שתף' : 'Share'}
                  </button>
                  <button
                    onClick={() => {
                      void toggleFavorite(buildFavoriteKey(baseSku, colorSlug))
                    }}
                    className={`flex-1 py-2 px-2 rounded-md text-xs font-medium border transition-colors duration-200 flex items-center justify-center gap-1 ${
                      isFavorite(buildFavoriteKey(baseSku, colorSlug))
                        ? 'border-red-300 bg-red-50 text-red-600'
                        : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {isFavorite(buildFavoriteKey(baseSku, colorSlug)) ? (
                      <HeartSolidIcon className="h-3 w-3" />
                    ) : (
                      <HeartIcon className="h-3 w-3" />
                    )}
                    {isFavorite(buildFavoriteKey(baseSku, colorSlug))
                      ? (lng === 'he' ? 'הוסר מהמועדפים' : 'Remove from Favorites')
                      : (lng === 'he' ? 'הוסף למועדפים' : 'Add to Favorites')
                    }
                  </button>
                </div>

                {/* Benefits / Info Lines */}
                <div className="space-y-4 text-sm text-gray-600 bg-[#E1DBD7] p-2 rounded-md gap">
                  <div>
                    {lng === 'he' 
                      ? 'משלוח חינם בקנייה מעל 300 ₪' 
                      : 'Free delivery above 300 ILS'
                    }
                  </div>
                  <div>
                    {lng === 'he' 
                      ? 'החלפה ראשונה ללא עלות – ללא עלות משלוח' 
                      : 'First exchange is free – no shipping cost'
                    }
                  </div>
                </div>

                {/* Product Description */}
                <div className="text-lg font-medium text-gray-900 mb-2">{lng === 'he' ? 'תיאור' : 'Description'}</div>
                <div>
                  <p className="text-gray-600 leading-relaxed">{lng === 'he' ? product.description_he : product.description_en}</p>
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

      {/* Size Chart Sheet */}
      <SizeChart
        isOpen={isSizeChartOpen}
        onClose={() => setIsSizeChartOpen(false)}
        lng={lng as 'en' | 'he'}
      />
    </>
  )
}