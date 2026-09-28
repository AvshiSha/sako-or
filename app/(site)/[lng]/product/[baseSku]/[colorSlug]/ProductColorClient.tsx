'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import Link from 'next/link'
import { 
  HeartIcon, 
  ShareIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid'
import { productService, productHelpers, getClientAnalytics, logEvent } from '@/lib/firebase'
import type { ProductClientView } from '@/lib/product-types'
import { resolveVariantHardwareColor } from '@/lib/product-types'
import { buildBagFactRows, buildMeasurementRows } from '@/lib/bag-facts'
import { useFavorites } from '@/app/hooks/useFavorites'
import { useCart } from '@/app/hooks/useCart'
import Toast, { useToast } from '@/app/components/Toast'
import Accordion from '@/app/components/Accordion'
import QuantityStepper from '@/app/components/QuantityStepper'
import { Button } from '@/app/components/ui/button'
import { getProductSizeOptions, getSizeGridColumns } from '@/lib/product-size-options'

/**
 * Written out as whole class names on purpose. Tailwind scans source text, so a
 * composed `grid-cols-${n}` would never be generated.
 */
const SIZE_GRID_COLUMN_CLASS = {
  1: 'grid-cols-1',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
} as const
import { trackViewItem, trackAddToCart as trackAddToCartEvent } from '@/lib/dataLayer'
import { getColorName } from '@/lib/colors'
import { ProductImageCarousel } from '@/app/components/ProductImageCarousel'
import { buildFavoriteKey } from '@/lib/favorites'
import { useProductCouponBadge } from '@/app/contexts/CouponBadgeContext'
import { ProductPromoRibbon } from '@/app/components/ProductPromoRibbon'
import { normalizeProductImages, getProductImageAlt, type ProductImageDetail } from '@/lib/product-images'
import PreviewModeBanner from '@/app/(unlocalized)/admin/products/_components/PreviewModeBanner'
import {
  SIZE_FIT_OPTIONS,
  FOOT_WIDTH_FIT_OPTIONS,
  ARCH_FIT_OPTIONS,
  ADJUSTABLE_FEATURE_OPTIONS,
  UPPER_MATERIAL_OPTIONS,
  LINING_OPTIONS,
  INSOLE_OPTIONS,
  OUTSOLE_OPTIONS,
  SOLE_TYPE_OPTIONS,
  TOE_SHAPE_OPTIONS,
  HEEL_TYPE_OPTIONS,
  CLOSURE_TYPE_OPTIONS,
  HEEL_HEIGHT_CM_OPTIONS,
  type HardwareColor,
  getOptionLabel,
  isUndefinedFitValue,
} from '@/lib/product-enums'

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
  imageDetails?: ProductImageDetail[];
  primaryImage?: string;
  videos?: string[];
  /** Overrides bagSpecs.hardwareColor for this colour; unset inherits the product value. */
  hardwareColor?: HardwareColor;
}

interface ProductWithVariants extends ProductClientView {
  colorVariants: Record<string, ColorVariantData>
  defaultColorVariant?: ColorVariantData
}

interface ProductColorClientProps {
  lng: string;
  baseSku: string;
  colorSlug: string;
  initialProduct: ProductWithVariants;
  initialVariant: ColorVariantData;
  /**
   * The heading text: the merchandiser-authored short title when there is one,
   * otherwise the composed name (category + colour – brand). The stored title
   * is the brand alone, so without this every bag renders the same `<h1>`.
   * Falls back to the stored title when the server couldn't compose one.
   */
  displayName?: string;
  /**
   * The keyword-led composed name that also backs the `<title>` tag and the
   * JSON-LD. Rendered as a sub-line under the heading so that shortening the
   * `<h1>` doesn't strip those keywords out of the page's body copy. Omitted,
   * or equal to `displayName`, means there is nothing extra to show.
   */
  seoName?: string;
  /** Localised category trail, root-first, e.g. ["נשים", "אקססוריז", "תיקים"]. */
  categoryTrail?: string[];
  /** True when rendering an admin draft rather than the live, published product. */
  previewMode?: boolean;
  /** Route prefix color-switching should navigate within, e.g. `/admin/products/preview/{draftId}`. Required when previewMode is true. */
  previewBasePath?: string;
  /** Signed short-lived token appended to preview navigations; carried across color switches. */
  previewToken?: string;
  /** The live product this draft was created from (edit flow), or null for a brand-new, never-published product. */
  sourceProductId?: string | null;
  /** colorSlug -> warning message (e.g. "no images assigned"), surfaced in the preview banner instead of silently rendering an empty gallery. */
  previewWarnings?: Record<string, string>;
}

export default function ProductColorClient({
  lng,
  baseSku,
  colorSlug,
  initialProduct,
  initialVariant,
  displayName,
  seoName,
  categoryTrail,
  previewMode = false,
  previewBasePath,
  previewToken,
  sourceProductId = null,
  previewWarnings,
}: ProductColorClientProps) {
  const router = useRouter()
  const [product, setProduct] = useState<ProductWithVariants | null>(initialProduct)
  const [currentVariant, setCurrentVariant] = useState<ColorVariantData | null>(initialVariant)
  /** Server-composed name; falls back to the stored title (the brand) when the
   * server had no category to compose one from, or in the preview flow. The
   * preview flow passes neither prop, so it resolves the short title itself -
   * an admin previewing a draft should see the same heading the live page will
   * render. */
  const productDisplayName =
    displayName ||
    (lng === 'he' ? product?.shortTitle_he : product?.shortTitle_en)?.trim() ||
    (lng === 'he' ? product?.title_he : product?.title_en) ||
    ''
  /** Only worth its own line when it says something the heading doesn't. */
  const productSeoName =
    seoName?.trim() && seoName.trim() !== productDisplayName.trim()
      ? seoName.trim()
      : ''
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

  function reorderByPrimary<T extends { url: string }>(items: T[], primaryImage: string | undefined): T[] {
    if (!primaryImage) return items
    const idx = items.findIndex((item) => item.url === primaryImage)
    if (idx <= 0) return items
    return [items[idx], ...items.slice(0, idx), ...items.slice(idx + 1)]
  }

  // Combined URL + alt-text metadata (legacy string[] products get a title-based fallback alt), with primary image first
  const galleryImages = useMemo(() => {
    if (!currentVariant) return []
    const normalized = normalizeProductImages(currentVariant.images, currentVariant.imageDetails, {
      titleEn: product?.title_en,
      titleHe: product?.title_he,
    })
    return reorderByPrimary(normalized, currentVariant.primaryImage)
  }, [currentVariant, product])

  // Get images only (no videos) with primary image first
  const productImages = useMemo(() => galleryImages.map((image) => image.url), [galleryImages])

  // Per-image alt text in the current page language; falls back to the carousel's default alt when unset
  const productImageAltList = useMemo(
    () => galleryImages.map((image) => getProductImageAlt(image, lng === 'he' ? 'he' : 'en') || undefined),
    [galleryImages, lng]
  )

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
    // Drafts live outside the `products` collection this listens to, and previewing
    // a live product's pending edits must never let a stale, published snapshot
    // overwrite the draft data the admin is reviewing.
    if (previewMode) return
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
  }, [baseSku, colorSlug, previewMode])

  // Defer analytics until after LCP-critical content paints
  useEffect(() => {
    if (previewMode) return
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
  }, [product, currentVariant, baseSku, colorSlug, lng, previewMode])

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
    if (previewMode && previewBasePath) {
      const query = previewToken ? `?token=${encodeURIComponent(previewToken)}` : ''
      router.push(`${previewBasePath}/${newColorSlug}${query}`)
      return
    }
    router.push(`/${lng}/product/${baseSku}/${newColorSlug}`)
  }

  const handleToggleFavorite = (key: string) => {
    if (previewMode) {
      showToast(lng === 'he' ? 'מצב תצוגה מקדימה — פעולה מושבתת' : 'Preview mode — action disabled', 'info')
      return
    }
    void toggleFavorite(key)
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

  // Offered sizes come from the category (women's 35-42, men's 39-46, one OS cell
  // for everything that is not footwear), with each cell's availability read off
  // the current colour's stock. Plain const, not useMemo: this sits after the
  // component's early returns, so a hook here would be a conditional one.
  const sizeOptions = getProductSizeOptions(product, currentVariant?.stockBySize)
  const sizeGridColumns = getSizeGridColumns(sizeOptions.length)

  const handleAddToCart = async () => {
    if (isOutOfStock || isAddingToCart || !selectedSize) return

    if (previewMode) {
      showToast(lng === 'he' ? 'מצב תצוגה מקדימה — פעולה מושבתת' : 'Preview mode — action disabled', 'info')
      return
    }

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

  return (
    <>
      {previewMode && (
        <PreviewModeBanner
          lng={lng}
          editHref={sourceProductId ? `/admin/products/${sourceProductId}/edit` : '/admin/products/new'}
          warning={previewWarnings?.[currentVariant.colorSlug]}
        />
      )}

      <div className={`min-h-screen bg-white ${isRTL ? 'rtl' : 'ltr'}`}>
        <div>
        <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_2fr] gap-0 lg:items-start">            {/* Product Images - Full Width */}
            <div className="relative w-full lg:sticky lg:top-28 lg:self-start lg:z-10 lg:max-h-[calc(100dvh-7rem)]">
              {/* Favorite Heart Icon - Top Left */}
              <button
                onClick={() => handleToggleFavorite(buildFavoriteKey(baseSku, colorSlug))}
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
                altList={productImageAltList}
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
              {/* Mobile buy box — design system 438:4218. The frame drives its own
                  vertical rhythm with padding (pt-12/13/32/12), so the blanket
                  space-y-2 is gone rather than stacking on top of it. */}
              <div className="lg:hidden">
                {/* Heading block, 438:4219. Title, price and swatches stack to the
                    inline start; no items-end, which in RTL would throw all three to
                    the left - the frame's "end" is a left-to-right artboard's end. */}
                <div className="flex flex-col gap-[10px] pt-[12px]">
                  {/* Typography/Heading/Section: Ploni Black 40/30. The frame sets
                      whitespace-nowrap around a two-word Latin placeholder; real
                      Hebrew names are longer, so this is allowed to wrap. */}
                  <h1 className="font-ploni text-[40px] font-black leading-[30px] text-text-primary">
                    {productDisplayName}
                  </h1>
                  {productSeoName && (
                    <p className="font-ploni text-[13px] leading-[16px] text-text-secondary">{productSeoName}</p>
                  )}

                  {/* Price, 438:4221. Struck original first, current second - the same
                      order ProductCard uses, so a card and the PDP it opens agree.
                      In RTL that puts the current price on the left of the pair. */}
                  <div className="flex items-center gap-[10px] font-ploni text-[14px] tabular-nums">
                    {hasSalePrice() && getSalePrice() && getSalePrice()! < getOriginalPrice() ? (
                      <>
                        <span className="font-medium leading-[18px] text-text-secondary line-through">
                          ₪{getOriginalPrice().toFixed(2)}
                        </span>
                        <span className="font-bold leading-[20.8px] text-text-primary">
                          ₪{getSalePrice()!.toFixed(2)}
                        </span>
                      </>
                    ) : (
                      <span className="font-bold leading-[20.8px] text-text-primary">
                        ₪{currentPrice.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Colour swatches, 438:4224. The frame carries no "צבע" heading -
                    the swatches sit directly under the price inside the heading
                    block, which is what the mt-[10px] reproduces here. They stay a
                    sibling because the whole group is conditional. */}
                {product.colorVariants && Object.keys(product.colorVariants).length > 1 && (
                  <div className="mt-[10px] flex gap-[6px] overflow-x-auto">
                    {Object.values(product.colorVariants)
                      .filter(variant => variant.isActive !== false)
                      .map((variant) => {
                      const isCurrentVariant = variant.colorSlug === colorSlug
                      const isVariantOutOfStock = Object.values(variant.stockBySize).every(stock => stock <= 0)
                      const variantImage = variant.primaryImage || variant.images?.[0]

                      return (
                        // Circular, matching ProductCard rather than the frame. 438:4227
                        // draws a square swatch with the selected one underlined, but the
                        // card renders these as round thumbnails with a border ring, and a
                        // shopper moving from the grid to the product should not meet two
                        // different controls for the same thing. The frame's 47px diameter
                        // is kept - only the shape and the selected state come from the card.
                        <button
                          key={variant.colorSlug}
                          type="button"
                          onClick={() => {
                            if (!isVariantOutOfStock) {
                              handleColorChange(variant.colorSlug)
                            }
                          }}
                          disabled={isVariantOutOfStock}
                          aria-label={getColorName(variant.colorSlug, lng as 'en' | 'he')}
                          aria-pressed={isCurrentVariant}
                          title={getColorName(variant.colorSlug, lng as 'en' | 'he')}
                          className={`relative flex size-[47px] shrink-0 items-center justify-center overflow-hidden rounded-full border bg-surface-secondary transition-colors ${
                            isCurrentVariant
                              ? 'border-border-default'
                              : 'border-border-subtle hover:border-text-secondary'
                          } ${isVariantOutOfStock ? 'opacity-50' : ''}`}
                        >
                          {variantImage ? (
                            <Image
                              src={variantImage}
                              alt={getColorName(variant.colorSlug, lng as 'en' | 'he')}
                              width={47}
                              height={47}
                              className="size-full object-cover"
                            />
                          ) : (
                            <span className="px-1 font-ploni text-[9px] leading-none text-text-secondary">
                              {getColorName(variant.colorSlug, lng as 'en' | 'he')}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}

                {/* Description, 438:4232. Typography/Paragraph/Regular at 13/16, and
                    no "תיאור" heading - the frame runs the copy straight under the
                    swatches. It used to sit at the very bottom of the column, below
                    shipping and returns, where it read as an afterthought. */}
                {(lng === 'he' ? product.description_he : product.description_en) && (
                  <p className="pt-[13px] font-ploni text-[13px] leading-[16px] text-text-primary">
                    {lng === 'he' ? product.description_he : product.description_en}
                  </p>
                )}

                {/* Size selection, 438:4234 + 438:4240. Rendered unconditionally now:
                    the options come from the category, so an accessory with no stock
                    rows still offers its one OS cell. */}
                {(
                  <div>
                    {/* 10px labels, the section name bold. justify-between puts the
                        name on the inline start and the guide on the end, which
                        mirrors: name right / guide left in Hebrew. */}
                    <div className="flex items-start justify-between pt-[32px] font-ploni text-[10px] text-text-primary">
                      <h3 className="font-bold">
                        {lng === 'he' ? 'בחירת מידה' : 'Select size'}
                      </h3>
                      <button
                        type="button"
                        onClick={() => setIsSizeChartOpen(true)}
                        className="transition-opacity hover:opacity-70"
                      >
                        {lng === 'he' ? 'מדריך מידות' : 'Size guide'}
                      </button>
                    </div>

                    {/* The dividers are the grid itself: an ink-900 ground showing
                        through 1px gaps between paper cells, framed by a 1px border.
                        That is how the frame draws it, and it keeps the hairlines
                        even when the sizes wrap onto a second row. */}
                    {/* Column count is chosen to divide the run evenly - see
                        getSizeGridColumns. An eight-size range lands on 4+4; a
                        five-size product keeps the frame's single row of five. */}
                    <div
                      className={`mt-[12px] grid gap-px border border-border-default bg-sako-ink-900 p-px ${SIZE_GRID_COLUMN_CLASS[sizeGridColumns]}`}
                    >
                      {sizeOptions.map((option) => {
                        const isSelected = selectedSize === option.key
                        return (
                          <button
                            key={option.key}
                            type="button"
                            onClick={() => setSelectedSize(option.key)}
                            disabled={!option.inStock}
                            aria-pressed={isSelected}
                            aria-label={
                              option.inStock
                                ? option.label
                                : `${option.label} — ${lng === 'he' ? 'אזל מהמלאי' : 'out of stock'}`
                            }
                            // Sold out, 438:2692: grey label with a hairline ruled
                            // corner to corner. The frame hard-codes the angle at
                            // 35.6deg, which is the diagonal of its own cell; `to top
                            // right` is the same line expressed so it stays corner to
                            // corner whatever width the grid resolves to. The band sits
                            // perpendicular to the gradient axis, so this rules the cell
                            // from its top left down to its bottom right.
                            style={
                              option.inStock
                                ? undefined
                                : {
                                    backgroundImage:
                                      'linear-gradient(to top right, rgba(170,170,170,0) 49%, rgb(170,170,170) 50%, rgba(170,170,170,0) 51%)',
                                  }
                            }
                            className={`flex h-[46px] items-center justify-center font-ploni text-[11px] tabular-nums transition-colors ${
                              !option.inStock
                                ? 'cursor-not-allowed bg-surface-secondary text-sako-gray-500'
                                : isSelected
                                  ? 'bg-sako-ink-900 text-text-inverse'
                                  : 'bg-surface-secondary text-text-primary hover:bg-sako-gray-200'
                            }`}
                          >
                            {option.label}
                          </button>
                        )
                      })}

                      {/* Only reachable for counts that divide by nothing (7, 11), since
                          the column count is picked to come out even otherwise. */}
                      {Array.from({
                        length: (sizeGridColumns - (sizeOptions.length % sizeGridColumns)) % sizeGridColumns,
                      }).map((_, index) => (
                        <div key={`size-spacer-${index}`} aria-hidden="true" className="h-[46px] bg-surface-secondary" />
                      ))}
                    </div>
                  </div>
                )}

                {/* Everything below the size grid is not yet redesigned, so it keeps
                    the old space-y-2 rhythm here rather than losing its spacing when
                    that class came off the column above. */}
                <div className="mt-[20px] space-y-2">
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
                      <QuantityStepper
                        value={quantity}
                        max={currentStock}
                        onChange={setQuantity}
                        language={lng === 'he' ? 'he' : 'en'}
                        disabled={isOutOfStock}
                      />
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
                {/* Design system 438:2703 — the CTA is a flat dark bar carrying the
                    label alone. The bag icon goes: the frame has none, and it was the
                    only thing forcing this button off the shared style. */}
                <Button
                  type="button"
                  variant="sako"
                  size="sako"
                  onClick={handleAddToCart}
                  disabled={isOutOfStock || (Object.keys(currentVariant.stockBySize).length > 0 && !selectedSize) || isAddingToCart}
                  className="duration-200"
                >
                  {(() => {
                    if (isAddingToCart) {
                      return lng === 'he' ? 'מוסיף לעגלה...' : 'Adding to Cart...'
                    } else if (isOutOfStock) {
                      return lng === 'he' ? 'אזל מהמלאי' : 'Out of Stock'
                    } else if (Object.keys(currentVariant.stockBySize).length > 0 && !selectedSize) {
                      // "בחרי", not "בחר": the frame addresses the shopper in the
                      // feminine, as the product card already does.
                      return lng === 'he' ? 'בחרי מידה' : 'Select Size'
                    } else {
                      return lng === 'he' ? 'הוסף לעגלה' : 'Add to Cart'
                    }
                  })()}
                </Button>

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
                      handleToggleFavorite(buildFavoriteKey(baseSku, colorSlug))
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

                {/* Product Title + Price (same row).
                    Deliberately NOT an <h1>: the mobile block above already
                    emits one, and both blocks are always present in the DOM
                    (only CSS hides one), so a second <h1> tag would give every
                    product page two. role/aria-level keep this announced as the
                    page heading for desktop screen readers, which skip the
                    display:none mobile copy. */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div role="heading" aria-level={1} className="text-2xl font-bold text-gray-900">
                      {productDisplayName}
                    </div>
                    {productSeoName && (
                      <p className="mt-1 text-sm text-gray-500">{productSeoName}</p>
                    )}
                  </div>
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
                                  alt={getColorName(variant.colorSlug, lng as 'en' | 'he')}
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
                      <QuantityStepper
                        value={quantity}
                        max={currentStock}
                        onChange={setQuantity}
                        language={lng === 'he' ? 'he' : 'en'}
                        disabled={isOutOfStock}
                      />
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
                {/* Design system 438:2703 — the CTA is a flat dark bar carrying the
                    label alone. The bag icon goes: the frame has none, and it was the
                    only thing forcing this button off the shared style. */}
                <Button
                  type="button"
                  variant="sako"
                  size="sako"
                  onClick={handleAddToCart}
                  disabled={isOutOfStock || (Object.keys(currentVariant.stockBySize).length > 0 && !selectedSize) || isAddingToCart}
                  className="duration-200"
                >
                  {(() => {
                    if (isAddingToCart) {
                      return lng === 'he' ? 'מוסיף לעגלה...' : 'Adding to Cart...'
                    } else if (isOutOfStock) {
                      return lng === 'he' ? 'אזל מהמלאי' : 'Out of Stock'
                    } else if (Object.keys(currentVariant.stockBySize).length > 0 && !selectedSize) {
                      // "בחרי", not "בחר": the frame addresses the shopper in the
                      // feminine, as the product card already does.
                      return lng === 'he' ? 'בחרי מידה' : 'Select Size'
                    } else {
                      return lng === 'he' ? 'הוסף לעגלה' : 'Add to Cart'
                    }
                  })()}
                </Button>

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
                      handleToggleFavorite(buildFavoriteKey(baseSku, colorSlug))
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
                      {/* Availability and effective price as plain text. Both existed
                          only inside the JSON-LD before, so anything reading the page
                          as prose — a shopper skimming, or the sales assistant — had
                          no way to tell whether this colour was actually buyable. */}
                      <div className="flex justify-between">
                        <span>{lng === 'he' ? 'זמינות' : 'Availability'}:</span>
                        <span className={isOutOfStock ? 'text-gray-500' : 'text-green-700'}>
                          {isOutOfStock
                            ? (lng === 'he' ? 'אזל מהמלאי' : 'Out of stock')
                            : (lng === 'he' ? 'במלאי' : 'In stock')}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>{lng === 'he' ? 'מחיר' : 'Price'}:</span>
                        <span>
                          {hasSalePrice() && getSalePrice() && getSalePrice()! < getOriginalPrice()
                            ? (lng === 'he'
                                ? `₪${getSalePrice()!.toFixed(2)} (במקום ₪${getOriginalPrice().toFixed(2)})`
                                : `₪${getSalePrice()!.toFixed(2)} (was ₪${getOriginalPrice().toFixed(2)})`)
                            : `₪${getOriginalPrice().toFixed(2)}`}
                        </span>
                      </div>
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
                        {/* The full localised trail ("נשים › אקססוריז › תיקים"), not
                            categories_path[0] — that printed the untranslated root
                            slug ("women"), which says nothing about the product. */}
                        <span>
                          {categoryTrail && categoryTrail.length > 0
                            ? categoryTrail.join(' › ')
                            : product.categories_path?.[0] || product.category || (lng === 'he' ? 'לא ידוע' : 'Unknown')}
                        </span>
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
                  {(() => {
                    const mc = product.materialCare
                    const locale = lng === 'he' ? 'he' : 'en'
                    /** Dropdown value first (resolved to a label), then legacy free text, then the older flat {en,he} shape. */
                    const resolveSpec = (
                      dropdownValue: string | undefined,
                      options: { value: string; label_en: string; label_he: string }[],
                      legacyEn: string | undefined,
                      legacyHe: string | undefined,
                      flatEn: string | undefined,
                      flatHe: string | undefined
                    ): string | undefined => {
                      if (dropdownValue) {
                        const label = getOptionLabel(options, dropdownValue, locale)
                        if (label) return label
                      }
                      if (legacyEn || legacyHe) return locale === 'he' ? legacyHe : legacyEn
                      return locale === 'he' ? flatHe : flatEn
                    }
                    const upperMaterialText = mc?.upperMaterial && mc.upperMaterial.length > 0
                      ? mc.upperMaterial
                          .map((value) => getOptionLabel(UPPER_MATERIAL_OPTIONS, value, locale))
                          .filter((label): label is string => !!label)
                          .join(', ')
                      : mc?.upperMaterial_en || mc?.upperMaterial_he
                        ? (locale === 'he' ? mc?.upperMaterial_he : mc?.upperMaterial_en)
                        : (locale === 'he' ? product.upperMaterial?.he : product.upperMaterial?.en)
                    const insoleText = resolveSpec(mc?.insole, INSOLE_OPTIONS, mc?.materialInnerSole_en, mc?.materialInnerSole_he, product.materialInnerSole?.en, product.materialInnerSole?.he)
                    const liningText = resolveSpec(mc?.lining, LINING_OPTIONS, mc?.lining_en, mc?.lining_he, product.lining?.en, product.lining?.he)
                    const outsoleText = resolveSpec(mc?.outsole, OUTSOLE_OPTIONS, mc?.sole_en, mc?.sole_he, product.sole?.en, product.sole?.he)
                    const soleTypeText = mc?.soleType ? getOptionLabel(SOLE_TYPE_OPTIONS, mc.soleType, locale) : undefined
                    const heelHeightText = resolveSpec(mc?.heelHeight, HEEL_HEIGHT_CM_OPTIONS, mc?.heelHeight_en, mc?.heelHeight_he, product.heelHeight?.en, product.heelHeight?.he)
                    const closureTypeText = resolveSpec(mc?.closureType, CLOSURE_TYPE_OPTIONS, mc?.closureType_en, mc?.closureType_he, undefined, undefined)
                    const heelTypeText = resolveSpec(mc?.heelType, HEEL_TYPE_OPTIONS, mc?.heelType_en, mc?.heelType_he, undefined, undefined)
                    const toeShapeText = resolveSpec(mc?.toeShape, TOE_SHAPE_OPTIONS, mc?.toeShape_en, mc?.toeShape_he, undefined, undefined)
                    const measurementRows = buildMeasurementRows(product, locale)
                    const bagRows = buildBagFactRows(product, locale, {
                      hardwareColor: resolveVariantHardwareColor(product, currentVariant),
                    })

                    if (!(upperMaterialText || insoleText || liningText || outsoleText || soleTypeText || heelHeightText ||
                      measurementRows.length > 0 || bagRows.length > 0 ||
                      closureTypeText || heelTypeText || toeShapeText || mc?.careInstructions_en || mc?.careInstructions_he)) {
                      return null
                    }

                    return (
                    <Accordion title={lng === 'he' ? 'מפרט טכני' : 'Material & Care'}>
                      <div className="space-y-3">
                        {upperMaterialText && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">
                              {lng === 'he' ? 'חומר עליון:' : 'Upper Material:'}
                            </span>
                            <span className="text-sm text-gray-900">{upperMaterialText}</span>
                          </div>
                        )}
                        {insoleText && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">
                              {lng === 'he' ? 'מדרס:' : 'Insole:'}
                            </span>
                            <span className="text-sm text-gray-900">{insoleText}</span>
                          </div>
                        )}
                        {liningText && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">
                              {lng === 'he' ? 'בטנה:' : 'Lining:'}
                            </span>
                            <span className="text-sm text-gray-900">{liningText}</span>
                          </div>
                        )}
                        {outsoleText && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">
                              {lng === 'he' ? 'סוליה חיצונית:' : 'Outsole:'}
                            </span>
                            <span className="text-sm text-gray-900">{outsoleText}</span>
                          </div>
                        )}
                        {soleTypeText && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">
                              {lng === 'he' ? 'סוג סוליה:' : 'Sole Type:'}
                            </span>
                            <span className="text-sm text-gray-900">{soleTypeText}</span>
                          </div>
                        )}
                        {heelHeightText && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">
                              {lng === 'he' ? 'גובה עקב:' : 'Heel Height:'}
                            </span>
                            <span className="text-sm text-gray-900">{heelHeightText}</span>
                          </div>
                        )}
                        {/* Dimensions and weight: structured numbers when they exist,
                            otherwise the legacy free text, via buildMeasurementRows. */}
                        {measurementRows.map((row) => (
                          <div key={row.key} className="flex justify-between">
                            <span className="text-sm text-gray-600">{row.label}:</span>
                            <span className="text-sm text-gray-900">{row.value}</span>
                          </div>
                        ))}
                        {closureTypeText && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">
                              {lng === 'he' ? 'סגירה:' : 'Closure:'}
                            </span>
                            <span className="text-sm text-gray-900">{closureTypeText}</span>
                          </div>
                        )}
                        {heelTypeText && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">
                              {lng === 'he' ? 'סוג עקב:' : 'Heel Type:'}
                            </span>
                            <span className="text-sm text-gray-900">{heelTypeText}</span>
                          </div>
                        )}
                        {toeShapeText && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">
                              {lng === 'he' ? 'צורת בהונות:' : 'Toe Shape:'}
                            </span>
                            <span className="text-sm text-gray-900">{toeShapeText}</span>
                          </div>
                        )}
                        {/* Bag attributes — empty for every non-bag product */}
                        {bagRows.map((row) => (
                          <div key={row.key} className="flex justify-between">
                            <span className="text-sm text-gray-600">{row.label}:</span>
                            <span className="text-sm text-gray-900">{row.value}</span>
                          </div>
                        ))}
                        {(product.materialCare?.careInstructions_en || product.materialCare?.careInstructions_he) && (
                          <div className="pt-2 mt-1 border-t border-gray-200">
                            <span className="text-sm text-gray-600 block mb-1">
                              {lng === 'he' ? 'הוראות טיפוח:' : 'Care Instructions:'}
                            </span>
                            <p className="text-sm text-gray-900 leading-relaxed">
                              {lng === 'he' ? product.materialCare?.careInstructions_he : product.materialCare?.careInstructions_en}
                            </p>
                          </div>
                        )}
                      </div>
                    </Accordion>
                    )
                  })()}

                  {/* Shoe Fit and Sizing Section */}
                  {product.shoeFit && (() => {
                    const { shoeFit } = product
                    const adjustableFeatureLabels = (shoeFit.adjustableFeatures ?? [])
                      .map((feature) => getOptionLabel(ADJUSTABLE_FEATURE_OPTIONS, feature, lng as 'en' | 'he'))
                      .filter((label): label is string => Boolean(label))
                    const notes = lng === 'he' ? shoeFit.notes_he : shoeFit.notes_en

                    const hasAnyFitData =
                      !isUndefinedFitValue(shoeFit.sizeFit) ||
                      !isUndefinedFitValue(shoeFit.footWidthFit) ||
                      !isUndefinedFitValue(shoeFit.archFit) ||
                      adjustableFeatureLabels.length > 0 ||
                      Boolean(notes)

                    if (!hasAnyFitData) return null

                    return (
                      <Accordion title={lng === 'he' ? 'התאמה ומידות' : 'Fit & Sizing'}>
                        <div className="space-y-3">
                          {!isUndefinedFitValue(shoeFit.sizeFit) && (
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">
                                {lng === 'he' ? 'התאמת מידה:' : 'Size Fit:'}
                              </span>
                              <span className="text-sm text-gray-900">
                                {getOptionLabel(SIZE_FIT_OPTIONS, shoeFit.sizeFit, lng as 'en' | 'he')}
                              </span>
                            </div>
                          )}
                          {!isUndefinedFitValue(shoeFit.footWidthFit) && (
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">
                                {lng === 'he' ? 'רוחב מומלץ:' : 'Recommended Foot Width:'}
                              </span>
                              <span className="text-sm text-gray-900">
                                {getOptionLabel(FOOT_WIDTH_FIT_OPTIONS, shoeFit.footWidthFit, lng as 'en' | 'he')}
                              </span>
                            </div>
                          )}
                          {!isUndefinedFitValue(shoeFit.archFit) && (
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">
                                {lng === 'he' ? 'קשת כף רגל:' : 'Arch Fit:'}
                              </span>
                              <span className="text-sm text-gray-900">
                                {getOptionLabel(ARCH_FIT_OPTIONS, shoeFit.archFit, lng as 'en' | 'he')}
                              </span>
                            </div>
                          )}
                          {adjustableFeatureLabels.length > 0 && (
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">
                                {lng === 'he' ? 'סגירה באמצעות:' : 'Adjustable Features:'}
                              </span>
                              <span className="text-sm text-gray-900">{adjustableFeatureLabels.join(', ')}</span>
                            </div>
                          )}
                          {notes && (
                            <p className="text-sm text-gray-600 leading-relaxed">{notes}</p>
                          )}
                        </div>
                      </Accordion>
                    )
                  })()}

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
                              <li>בהזמנה מתחת ל־300 ₪ – משלוח עם שליח עד הבית בעלות 30 ₪</li>
                              <li>משלוח מהיר: 3–5 ימי עסקים</li>
                            </ul>
                        
                            <p><strong>🔄 החזרות והחלפות:</strong></p>
                            <ul className="list-disc list-inside space-y-1 ml-4">
                              <li>החזרה בחינם דרך החנות תוך 14 יום</li>
                              <li>החזרה עם שליח – בעלות של 30 ₪</li>
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
                              <li>Orders under ₪300 – home delivery for ₪30</li>
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