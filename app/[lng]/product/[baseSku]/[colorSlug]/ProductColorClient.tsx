'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import Link from 'next/link'
import { 
  HeartIcon, 
  ShareIcon,
  ShoppingBagIcon,
  MinusIcon,
  PlusIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid'
import { productService, productHelpers, Product, getClientAnalytics, logEvent } from '@/lib/firebase'
import { useFavorites } from '@/app/hooks/useFavorites'
import { useCart } from '@/app/hooks/useCart'
import Toast, { useToast } from '@/app/components/Toast'
import Accordion from '@/app/components/Accordion'
import { trackViewItem, trackAddToCart as trackAddToCartEvent } from '@/lib/dataLayer'
import { getColorName } from '@/lib/colors'
import { ProductImageCarousel } from '@/app/components/ProductImageCarousel'
import { buildFavoriteKey } from '@/lib/favorites'
import { buildAbsoluteUrl } from '@/lib/seo'
import { getImageUrl } from '@/lib/image-urls'
import { useProductCouponBadge } from '@/app/contexts/CouponBadgeContext'
import { ProductPromoRibbon } from '@/app/components/ProductPromoRibbon'

const SizeChart = dynamic(() => import('@/app/components/SizeChart'), { ssr: false })

interface ColorVariantData {
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

interface ProductWithVariants extends Product {
  colorVariants: Record<string, ColorVariantData>
  defaultColorVariant?: ColorVariantData
}

interface ProductColorClientProps {
  lng: string;
  baseSku: string;
  colorSlug: string;
  initialProduct: ProductWithVariants;
  initialVariant: ColorVariantData;
}

export default function ProductColorClient({
  lng,
  baseSku,
  colorSlug,
  initialProduct,
  initialVariant,
}: ProductColorClientProps) {
  const router = useRouter()
  const [product, setProduct] = useState<ProductWithVariants | null>(initialProduct)
  const [currentVariant, setCurrentVariant] = useState<ColorVariantData | null>(initialVariant)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedSize, setSelectedSize] = useState<string>(() => {
    const availableSizes = Object.keys(initialVariant.stockBySize).filter(
      (size) => initialVariant.stockBySize[size] > 0
    )
    return availableSizes[0] ?? ''
  })
  const [quantity, setQuantity] = useState(1)
  const [isAddingToCart, setIsAddingToCart] = useState(false)
  const [isSizeChartOpen, setIsSizeChartOpen] = useState(false)
  
  // Favorites hook
  const { isFavorite, toggleFavorite } = useFavorites()

  // Cart hook
  const { addToCart } = useCart()
  
  // Toast hook
  const { toast, showToast, hideToast } = useToast()

  function reorderImagesByPrimary(images: string[] | undefined, primaryImage: string | undefined): string[] {
    const list = Array.isArray(images) ? images : []
    if (!primaryImage) return list
    const idx = list.findIndex((img) => img === primaryImage)
    if (idx <= 0) return list
    return [primaryImage, ...list.slice(0, idx), ...list.slice(idx + 1)]
  }

  // Get images only (no videos) with primary image first
  const productImages = useMemo(() => {
    if (!currentVariant) return []
    return reorderImagesByPrimary(currentVariant.images, currentVariant.primaryImage)
  }, [currentVariant])

  // Get language from props
  const isRTL = lng === 'he'

  const couponBadgeLookup = useMemo(() => {
    if (!product) {
      return { sku: null as string | null, baseSku: null as string | null }
    }
    const variantSku = colorSlug ? `${product.sku}-${colorSlug}` : null
    return {
      sku: variantSku ?? product.sku,
      baseSku: product.baseSku ?? product.sku,
    }
  }, [product, colorSlug])

  const promoBadge = useProductCouponBadge(
    couponBadgeLookup.sku,
    couponBadgeLookup.baseSku
  )

  // Sync server props when navigating between color variants
  useEffect(() => {
    setProduct(initialProduct)
    setCurrentVariant(initialVariant)
    const availableSizes = Object.keys(initialVariant.stockBySize).filter(
      (size) => initialVariant.stockBySize[size] > 0
    )
    if (availableSizes.length > 0) {
      setSelectedSize(availableSizes[0])
    }
  }, [initialProduct, initialVariant, colorSlug])

  // Defer real-time Firebase listener until after first paint (live stock/price updates)
  useEffect(() => {
    if (!baseSku || !colorSlug) return

    let unsubscribe: (() => void) | undefined
    let cancelled = false

    const attachListener = () => {
      if (cancelled) return
      unsubscribe = productService.onProductByBaseSku(baseSku, (productData) => {
        if (!productData) return

        const variant = Object.values(productData.colorVariants || {}).find(
          (v) => v.colorSlug === colorSlug
        )
        if (!variant || variant.isActive === false) return

        setProduct(productData)
        setCurrentVariant(variant)
      })
    }

    const schedule =
      typeof window.requestIdleCallback === 'function'
        ? window.requestIdleCallback
        : (cb: () => void) => window.setTimeout(cb, 200)

    const idleId = schedule(attachListener)

    return () => {
      cancelled = true
      if (typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleId as number)
      }
      unsubscribe?.()
    }
  }, [baseSku, colorSlug])

  // Defer analytics until after LCP-critical content paints
  useEffect(() => {
    if (!product || !currentVariant) return

    const fireAnalytics = () => {
      try {
        logEvent(getClientAnalytics(), 'view_item', {
          currency: product.currency || 'ILS',
          value: currentVariant.salePrice || product.price,
          items: [{
            item_id: `${baseSku}-${colorSlug}`,
            item_name: `${baseSku} - ${currentVariant.colorSlug}`,
            item_category: product.category || 'Unknown',
            price: currentVariant.salePrice || product.price,
            quantity: 1
          }]
        })

        const productName = productHelpers.getField(product, 'name', lng as 'en' | 'he') || product.title_en || product.title_he || 'Unknown Product'
        const itemId = `${baseSku}-${colorSlug}`
        const price = currentVariant.salePrice || currentVariant.priceOverride || product.price
        const categories = product.categories_path || [product.category || 'Unknown']

        trackViewItem(
          `${productName} - ${currentVariant.colorSlug}`,
          itemId,
          price,
          {
            brand: product.brand,
            categories: categories,
            variant: currentVariant.colorSlug,
            quantity: 1,
            currency: product.currency || 'ILS'
          }
        )
      } catch (dataLayerError) {
        console.warn('Data layer tracking error:', dataLayerError)
      }
    }

    const schedule =
      typeof window.requestIdleCallback === 'function'
        ? window.requestIdleCallback
        : (cb: () => void) => window.setTimeout(cb, 1500)

    const idleId = schedule(fireAnalytics)
    return () => {
      if (typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleId as number)
      }
    }
  }, [product, currentVariant, baseSku, colorSlug, lng])

  // Get current price (variant price takes precedence)
  const getCurrentPrice = useCallback(() => {
    if (!currentVariant) return 0
    
    // First check for variant-specific sale price
    if (currentVariant.salePrice) return currentVariant.salePrice
    // Then check for product-level sale price
    if (product?.salePrice) return product.salePrice
    // Then check for variant price override
    if (currentVariant.priceOverride) return currentVariant.priceOverride
    return product?.price || 0
  }, [currentVariant, product])

  // Get original price (without any sale price)
  const getOriginalPrice = useCallback(() => {
    if (!currentVariant) return product?.price || 0
    
    // Check for variant price override first
    if (currentVariant.priceOverride) return currentVariant.priceOverride
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
    logEvent(getClientAnalytics(), 'add_to_cart', {
      currency: product.currency || 'ILS',
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
      currency: product.currency || 'ILS',
      image: productImages?.[0],
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
  const structuredDataImages =
    productImages.length > 0
      ? productImages.map((img) =>
          img.startsWith('http') ? img : buildAbsoluteUrl(img)
        )
      : [getImageUrl('/images/placeholder.svg')]

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
      "priceCurrency": product.currency || 'ILS',
      "availability": isOutOfStock ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
      "url": buildAbsoluteUrl(`/${lng}/product/${baseSku}/${colorSlug}`)
    },
    "image": structuredDataImages,
    "category": product.category,
    "color": currentVariant.colorSlug
  }

  return (
    <>
      {/* Structured Data (client-side price/stock refresh) */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <div className={`min-h-screen bg-white ${isRTL ? 'rtl' : 'ltr'}`}>
        <div>
        <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_2fr] gap-0 lg:items-start">            {/* Product Images - Full Width */}
            <div className="relative w-full lg:sticky lg:top-28 lg:self-start lg:z-10 lg:max-h-[calc(100dvh-7rem)]">
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

              {promoBadge && (
                <ProductPromoRibbon
                  language={lng as 'en' | 'he'}
                  promoBadge={promoBadge}
                  size="card"
                  className="absolute left-4 top-14 z-20 max-w-[calc(100%-4rem)] lg:hidden"
                />
              )}

              <ProductImageCarousel
                key={colorSlug}
                images={productImages}
                alt={`${productName} - ${currentVariant.colorSlug}`}
                direction={isRTL ? "rtl" : "ltr"}
                variant="pdp"
                isAboveFold
                className="w-full"
                dotSelectLabelPrefix={
                  lng === "he" ? "עבור לתמונה" : "Go to image"
                }
              />
            </div>

            {/* Product Details */}
            <div className={`space-y-6 px-4 sm:px-6 py-4 lg:pb-8 ${isRTL ? 'lg:pl-48 lg:pr-4' : 'lg:pl-4 lg:pr-48'}`}>
              {/* Mobile Layout — promo labels on image carousel */}
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
                {promoBadge && (
                  <ProductPromoRibbon
                    language={lng as 'en' | 'he'}
                    promoBadge={promoBadge}
                    size="page"
                    className="w-fit max-w-full"
                  />
                )}

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
                        <span>{product.categories_path?.[0] || product.category || (lng === 'he' ? 'לא ידוע' : 'Unknown')}</span>
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