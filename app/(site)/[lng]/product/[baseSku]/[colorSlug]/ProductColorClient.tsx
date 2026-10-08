'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import Link from 'next/link'
import ListingLink from '@/app/components/ListingLink'
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
import { useToast } from '@/app/components/Toast'
import Accordion from '@/app/components/Accordion'
import QuantityStepper from '@/app/components/QuantityStepper'
import { Button } from '@/app/components/ui/button'
import { getProductSizeOptions, getSizeGridColumns, SIZE_GRID_COLUMN_CLASS, isFootwear } from '@/lib/product-size-options'

/**
 * Written out as whole class names on purpose. Tailwind scans source text, so a
 * composed `grid-cols-${n}` would never be generated.
 */
/**
 * Share and favourites. Neither is in 438:2664, so they borrow the design system's
 * own button vocabulary rather than inventing one: sharp corners, a border-default
 * hairline, Ploni at the sidebar's label size, and the size grid's hover tint.
 */
const SECONDARY_ACTION_BUTTON =
  'flex h-[44px] flex-1 items-center justify-center gap-2 border border-border-default font-ploni text-[12px] text-text-primary transition-colors hover:bg-sako-gray-200'

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

import {
  PDP_DESKTOP_GALLERY_GRID,
  PDP_GALLERY_COL,
  PDP_GRID,
  PDP_INFO_COL,
  PDP_INFO_HEAD,
} from '@/app/components/product/productPageChrome'

const SizeChart = dynamic(() => import('@/app/components/SizeChart'), { ssr: false })

/** Only ever opened by a successful add, so its chunk is fetched on the click. */
const MiniCartDrawer = dynamic(() => import('@/app/components/MiniCartDrawer'), { ssr: false })

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
  /** The add-to-cart confirmation. Replaces the success toast this flow used to raise. */
  const [isMiniCartOpen, setIsMiniCartOpen] = useState(false)
  /**
   * Sticky once the first add happens, so the drawer's chunk is fetched on that
   * click rather than on every product view — but is never torn out from under
   * its own closing animation, which is what unmounting on `isMiniCartOpen`
   * would do.
   */
  const [isMiniCartMounted, setIsMiniCartMounted] = useState(false)

  /**
   * The size chart is footwear-only - its table converts SAKO/US/foot-cm, which
   * means nothing for a bag or a belt.
   *
   * `isFootwear` rather than a literal `subCategory === 'Shoes'` test, for two
   * reasons found in the data. The runtime product document stores
   * `subCategory` as a category *id* ("eKedLsbjfWh7qywuslaB"), not a name, so a
   * name comparison never matches; and in the catalogue only 110 of 343
   * products carry the name "Shoes" at all - another 201 sit under "Outlet", a
   * merchandising bucket holding 180 shoes and 21 bags, so even against names a
   * literal match would hide the chart from more shoes than it showed.
   * `isFootwear` is the predicate the size grid beside it already uses, so the
   * chart and the sizes can never disagree about what a shoe is.
   */
  const showSizeChart = useMemo(() => isFootwear(product ?? {}), [product])

  // Favorites hook
  const { isFavorite, toggleFavorite } = useFavorites()

  // Cart hook
  const { addToCart } = useCart()
  
  // Toast hook
  const { showToast } = useToast()

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

  /**
   * The variant whose product view has most recently been reported.
   *
   * One page view must produce exactly one `view_item` / `ViewContent`, and the
   * effect below cannot promise that on its own because it keys off `product`
   * and `currentVariant` *objects*. The realtime listener above calls
   * `setProduct`/`setCurrentVariant` with freshly built values on every
   * snapshot - including the initial one Firestore delivers the moment the
   * listener attaches, whose data is identical to the server-rendered props.
   * New identity, same data, so the effect re-ran and reported the same view a
   * second time. Measured 2026-10-08: every PDP landing sent two ViewContent
   * events, which doubles the figure Meta reports and trains ad optimisation on
   * twice the real view volume.
   *
   * Holding only the *last* key, rather than a set of everything seen, is what
   * keeps real navigation honest: black -> red -> black is three genuine views
   * and reports three times, while any number of snapshots for the colour
   * currently on screen reports once.
   */
  const lastReportedViewKeyRef = useRef<string | null>(null)

  // Defer analytics until after LCP-critical content paints
  useEffect(() => {
    if (previewMode) return
    if (!product || !currentVariant) return

    const viewKey = `${baseSku}-${colorSlug}`

    const fireAnalytics = () => {
      // Checked here and not at the top of the effect, deliberately. Under
      // Strict Mode the effect runs, is cleaned up, then runs again; a guard
      // above would mark the view as reported on the first pass, have its idle
      // callback cancelled by that cleanup, and then skip the second pass -
      // suppressing the event entirely rather than de-duplicating it. Claiming
      // the key at the moment the event is actually sent cannot do that.
      if (lastReportedViewKeyRef.current === viewKey) return
      lastReportedViewKeyRef.current = viewKey

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

    // Cancelled through the same API it was scheduled with. The fallback branch
    // used to be scheduled with setTimeout but only ever cancelled through
    // cancelIdleCallback, so on a browser without requestIdleCallback nothing
    // was cancelled at all: a pending callback from the previous colour could
    // still fire after the next one had been reported, and with the de-dup
    // above keyed on the last reported view that would report the old colour a
    // second time.
    // Both are plain numeric handles on `window` - `window.setTimeout` returns a
    // number, not Node's Timeout - so one variable covers either branch.
    const hasIdleCallback = typeof window.requestIdleCallback === 'function'
    const handle: number = hasIdleCallback
      ? window.requestIdleCallback(fireAnalytics)
      : window.setTimeout(fireAnalytics, 1500)

    return () => {
      if (hasIdleCallback) {
        window.cancelIdleCallback(handle)
      } else {
        window.clearTimeout(handle)
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
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-border-default"></div>
          <p className="mt-4 font-ploni text-text-secondary">Loading product...</p>
        </div>
      </div>
    )
  }

  if (error || !product || !currentVariant) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <ExclamationTriangleIcon className="mx-auto mb-4 h-16 w-16 text-text-secondary" />
          <h1 className="mb-4 font-ploni text-[32px] font-black leading-[32px] text-text-primary">
            {lng === 'he' ? 'מוצר לא נמצא' : 'Product Not Found'}
          </h1>
          <p className="mb-6 font-ploni text-[13px] leading-[16px] text-text-secondary">
            {lng === 'he' 
              ? 'המוצר או הצבע שחיפשת לא קיים או הוסר מהקטלוג.' 
              : 'The product or color you\'re looking for doesn\'t exist or has been removed from the catalog.'
            }
          </p>
          <ListingLink
            href={`/${lng}/collection`}
            className="inline-flex h-[54px] items-center justify-center border border-btn-primary-bg bg-btn-primary-bg px-6 font-ploni text-[16px] font-bold text-btn-primary-text transition-colors hover:bg-sako-ink-800"
          >
            {lng === 'he' ? 'חזור לאוסף' : 'Back to Collection'}
          </ListingLink>
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
    try {
      addToCart(baseCartItem)

      // Add multiple items if quantity > 1
      for (let i = 1; i < quantity; i++) {
        addToCart({ ...baseCartItem })
      }

      // Confirmation is the mini cart drawer (438:4594), not a toast: it shows
      // the whole cart with the new line already in it, which is both the
      // acknowledgement and the route onwards. `addToCart` commits through
      // flushSync, so the drawer opens on a cart that already contains the add.
      setIsMiniCartMounted(true)
      setIsMiniCartOpen(true)
    } catch (error) {
      // Only failure still speaks through the toast. Success no longer does.
      console.error('Error adding to cart:', error)
      showToast(lng === 'he' ? 'שגיאה בהוספה לסל' : 'Error adding to cart', 'error')
    } finally {
      // No artificial delay any more — the drawer is the feedback, and a button
      // left disabled for a second behind it is just a control that looks broken
      // when the drawer is dismissed.
      setIsAddingToCart(false)
    }
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

      <div className={`min-h-screen bg-surface-secondary ${isRTL ? 'rtl' : 'ltr'}`}>
        <div>
        {/* 438:2644 — a 1224/502 split, so the sidebar is a fixed 502px track and the
            mosaic takes the rest. It was 1.5fr/2fr, which gave the images 43% and the
            copy 57%, the reverse of the frame. In RTL the first track is the rightmost,
            which is where the frame puts the sidebar; order swaps the two at lg only,
            so mobile keeps images-then-details. */}
        <div className={PDP_GRID}>            {/* Product Images - Full Width */}
            <div className={PDP_GALLERY_COL}>
              {/* Favorite Heart Icon - Top Left */}
              <button
                onClick={() => handleToggleFavorite(buildFavoriteKey(baseSku, colorSlug))}
                className="absolute top-4 left-4 z-20 p-2 rounded-full bg-white/80 backdrop-blur-sm shadow-sm hover:bg-white transition-colors"
                aria-label={isFavorite(buildFavoriteKey(baseSku, colorSlug)) ? (lng === 'he' ? 'הסר ממועדפים' : 'Remove from favorites') : (lng === 'he' ? 'הוסף למועדפים' : 'Add to favorites')}
              >
                {isFavorite(buildFavoriteKey(baseSku, colorSlug)) ? (
                  <HeartSolidIcon className="h-4 w-4 text-red-500" />
                ) : (
                  <HeartIcon className="h-4 w-4 text-text-primary" />
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

              {/* Mobile keeps the swipeable gallery. */}
              <div className="lg:hidden">
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

              {/* Desktop mosaic, 438:2645. The frame does not carousel on desktop - it
                  tiles the shots two across in squares, with the third spanning the
                  full width, and lets the whole column scroll past the sticky sidebar.
                  1px gaps, exactly as the frame spaces its figures. */}
              <div className={PDP_DESKTOP_GALLERY_GRID}>
                {productImages.map((src, index) => (
                  <div
                    key={`${src}-${index}`}
                    className={`relative aspect-square overflow-hidden bg-surface-secondary ${
                      index === 2 ? 'col-span-2' : ''
                    }`}
                  >
                    <Image
                      src={src}
                      alt={productImageAltList?.[index] || `${productName} - ${index + 1}`}
                      fill
                      sizes="(min-width: 1024px) 71vw, 100vw"
                      className="object-cover"
                      priority={index === 0}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Product Details — the sidebar. 36px inset either side is what leaves
                the frame's 430px content column inside a 502px track. This is the
                sticky one now: the frame scrolls the mosaic past it, where the build
                had it the other way round. */}
            {/* space-y-[30px]: the buy box, the additional-information block and the
                specification accordions are the column's top-level sections, and the
                gap between them is the same 30px the sections inside the buy box use. */}
            <div className={PDP_INFO_COL}>
              {/* Mobile Layout — promo labels on image carousel */}
              {/* Mobile buy box — design system 438:4218. The frame drives its own
                  vertical rhythm with padding (pt-12/13/32/12), so the blanket
                  space-y-2 is gone rather than stacking on top of it. */}
              <div className="lg:hidden">
                {/* Heading block, 438:4219. Title, price and swatches stack to the
                    inline start; no items-end, which in RTL would throw all three to
                    the left - the frame's "end" is a left-to-right artboard's end. */}
                <div className={PDP_INFO_HEAD}>
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
                      {/* Footwear only. justify-between leaves the heading on the
                          inline start when this is absent, so the row closes up
                          with no gap. */}
                      {showSizeChart && (
                        <button
                          type="button"
                          onClick={() => setIsSizeChartOpen(true)}
                          className="underline decoration-1 underline-offset-[3px] transition-opacity hover:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-default"
                        >
                          {lng === 'he' ? 'מדריך מידות' : 'Size guide'}
                        </button>
                      )}
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

                {/* No spacing class of its own. Everything below the size grid now
                    carries its own mt-[30px], and Tailwind v4's space-y-* is a
                    margin-block-end on the *previous* sibling - so a wrapper rhythm
                    here would add to each child's margin rather than set it, which is
                    how this block ended up at 20/8/12px in the first place. */}
                <div>
                {/* Quantity Selector */}
                {/* mt-[13px], matching the pb-[13px] this row already carries: the
                    row is a band between two rules — the size grid's bottom border
                    above it and its own border-b below — and `items-center` only
                    centres the label against the stepper, not the pair against those
                    rules. At mt-[30px] the stepper sat 30px below the grid and 13px
                    above its own rule. Same shape as the disclosure rows: the gap
                    above a ruled row lands entirely on one side of its contents. */}
                {(() => {
                  const allSizesOutOfStock = Object.keys(currentVariant.stockBySize).length > 0 &&
                    Object.values(currentVariant.stockBySize).every(stock => stock <= 0)
                  
                  if (allSizesOutOfStock) {
                    return (
                      <div className="mt-[13px] flex items-center justify-between border-b border-border-default pb-[13px]">
                        <h3 className="font-ploni text-[10px] font-bold text-text-primary lg:text-[12px]">
                          {lng === 'he' ? 'כמות' : 'Quantity'}
                        </h3>
                        <p className="font-ploni text-[12px] font-bold text-accent-error">
                          {lng === 'he' ? 'אזל מהמלאי' : 'OUT OF STOCK'}
                        </p>
                      </div>
                    )
                  }
                  
                  return (
                    <div>
                      {/* Quantity is absent from 438:2664, but kept as functionality the
                          frame omits. Given the same ruled-row vocabulary as the swatch
                          and size headers - label on the inline start, control on the
                          end - so it reads as part of the sidebar, not a leftover. */}
                      <div className="mt-[13px] flex items-center justify-between border-b border-border-default pb-[13px]">
                        <h3 className="font-ploni text-[10px] font-bold text-text-primary lg:text-[12px]">
                          {lng === 'he' ? 'כמות' : 'Quantity'}
                        </h3>
                        <QuantityStepper
                          value={quantity}
                          max={currentStock}
                          onChange={setQuantity}
                          language={lng === 'he' ? 'he' : 'en'}
                          disabled={isOutOfStock}
                        />
                      </div>
                      {!selectedSize && Object.keys(currentVariant.stockBySize).length > 0 && (
                        <p className="mt-[8px] font-ploni text-[10px] text-text-secondary lg:text-[12px]">
                          {lng === 'he' ? 'אנא בחרי מידה' : 'Please select a size'}
                        </p>
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
                  // 438:2703 gives the desktop bar an explicit 54px, taller than the
                  // shared 14px padding produces. Scoped with lg: rather than changing
                  // the sako size variant, which the product card also uses.
                  className="mt-[30px] duration-200 lg:h-[54px] lg:py-0"
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
                {/* gap, not space-x-4: space-x sets a physical margin that has to be
                    flipped by hand in RTL, and this row already reversed once. */}
                <div className="mt-[30px] flex gap-[8px]">
                  <button
                    type="button"
                    onClick={handleShare}
                    className={SECONDARY_ACTION_BUTTON}
                  >
                    <ShareIcon className="h-[14px] w-[14px]" aria-hidden="true" />
                    {lng === 'he' ? 'שיתוף' : 'Share'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleToggleFavorite(buildFavoriteKey(baseSku, colorSlug))
                    }}
                    aria-pressed={isFavorite(buildFavoriteKey(baseSku, colorSlug))}
                    className={SECONDARY_ACTION_BUTTON}
                  >
                    {/* The filled heart carries the state on its own. The design system
                        has no styling for a "saved" secondary button, and giving it the
                        dark fill it uses elsewhere for selection would have this
                        competing with the CTA directly above it. */}
                    {isFavorite(buildFavoriteKey(baseSku, colorSlug)) ? (
                      <HeartSolidIcon className="h-[14px] w-[14px]" aria-hidden="true" />
                    ) : (
                      <HeartIcon className="h-[14px] w-[14px]" aria-hidden="true" />
                    )}
                    {isFavorite(buildFavoriteKey(baseSku, colorSlug))
                      ? (lng === 'he' ? 'הסרה ממועדפים' : 'Remove from Favorites')
                      : (lng === 'he' ? 'הוספה למועדפים' : 'Add to Favorites')
                    }
                  </button>
                </div>

                </div>
              </div>

              {/* Desktop Layout */}
              {/* space-y-2 dropped for the same reason as the mobile block: in
                  Tailwind v4 it is a margin on the previous sibling, so it added 8px
                  on top of every explicit margin below instead of being overridden by
                  it. Each child now owns its gap. */}
              <div className="hidden lg:block">
                {promoBadge && (
                  <ProductPromoRibbon
                    language={lng as 'en' | 'he'}
                    promoBadge={promoBadge}
                    size="page"
                    // Carried by the ribbon rather than the title below it, so the
                    // title sits flush at the top of the column when there is no promo.
                    className="mb-2 w-fit max-w-full"
                  />
                )}

                {/* Product Title + Price (same row).
                    Deliberately NOT an <h1>: the mobile block above already
                    emits one, and both blocks are always present in the DOM
                    (only CSS hides one), so a second <h1> tag would give every
                    product page two. role/aria-level keep this announced as the
                    page heading for desktop screen readers, which skip the
                    display:none mobile copy. */}
                {/* Heading block, 438:2665. SKU, title and price stack to the inline
                    start on a 10px rhythm. No items-end: the frame's "end" is an
                    LTR artboard's, which in RTL would throw all three to the left. */}
                <div className="flex flex-col gap-[10px]">
                  {/* 438:2666 — the SKU sits above the title, DemiBold 9 with a
                      1.08px track. The build had no SKU on the page at all. */}
                  <p className="font-ploni text-[9px] font-semibold tracking-[1.08px] text-text-primary">
                    {product.sku || baseSku}
                  </p>

                  {/* Typography/Heading/H5: Ploni Black 60/50. */}
                  <div
                    role="heading"
                    aria-level={1}
                    className="font-ploni text-[60px] font-black leading-[50px] text-text-primary"
                  >
                    {productDisplayName}
                  </div>
                  {productSeoName && (
                    <p className="font-ploni text-[13px] leading-[16px] text-text-secondary">{productSeoName}</p>
                  )}

                  {/* Price, 438:2669 — 12px Regular, struck original then current,
                      the order ProductCard and the mobile buy box both use. The
                      frame drops the shekel sign; kept here, since a storefront
                      showing a bare number is a worse trade than matching the mock. */}
                  <div className="flex items-center gap-[10px] font-ploni text-[12px] tabular-nums">
                    {hasSalePrice() && getSalePrice() && getSalePrice()! < getOriginalPrice() ? (
                      <>
                        <span className="text-text-secondary line-through">
                          ₪{getOriginalPrice().toFixed(2)}
                        </span>
                        <span className="text-text-primary">
                          ₪{getSalePrice()!.toFixed(2)}
                        </span>
                      </>
                    ) : (
                      <span className="text-text-primary">
                        ₪{currentPrice.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Colour swatches, 438:2672. The swatches are pushed to the inline
                    end of a ruled row. The frame carries no "צבע" label - the empty
                    438:2674 spacer is where one would go.

                    mt-[13px], on the same 13/13 rhythm as the ruled rows below it.
                    Unlike those, this row has NO rule above it — the price block is
                    plain text — so this is not a centring fix: 438:2672 draws the
                    swatches 35px under the heading, and this deliberately tightens
                    that to keep every ruled row in the buy box on one ladder. The
                    frame's value if it ever needs restoring is mt-[35px]. */}
                {product.colorVariants && Object.keys(product.colorVariants).length > 1 && (
                  <div className="mt-[13px] flex items-center justify-end gap-[8px] border-b border-border-default pb-[13px]">
                    {Object.values(product.colorVariants)
                      .filter(variant => variant.isActive !== false)
                      .map((variant) => {
                      const isCurrentVariant = variant.colorSlug === colorSlug
                      const isVariantOutOfStock = Object.values(variant.stockBySize).every(stock => stock <= 0)
                      const variantImage = variant.primaryImage || variant.images?.[0]

                      return (
                        // Circular, as on the card and the mobile buy box. 438:2676
                        // draws a 47x28 landscape tile here, but three different
                        // swatch shapes across one storefront helps nobody.
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

                {/* Size selection, 438:2680 + 438:2687 */}
                <div>
                  {/* Ruled header 35px down, 12px labels. Section name first so it
                      lands on the inline start - right in Hebrew - with the size
                      chart opposite, which is how the frame reads once mirrored. */}
                  {/* mt-[13px] to match its own pb-[13px]: this row is a true band
                      between two rules — the swatch row's border-b above it and its
                      own below — so the label and the size-chart link now sit centred
                      between them rather than 30px down from the first. */}
                  <div className="mt-[13px] flex items-center justify-between border-b border-border-default pb-[13px] font-ploni text-[12px] text-text-primary">
                    <h3 className="font-bold">
                      {lng === 'he' ? 'בחירת מידה' : 'Select size'}
                    </h3>
                    {/* Footwear only - see showSizeChart. The ruled header keeps
                        its rule and the heading keeps its place when this goes. */}
                    {showSizeChart && (
                      <button
                        type="button"
                        onClick={() => setIsSizeChartOpen(true)}
                        className="underline decoration-1 underline-offset-[3px] transition-opacity hover:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-default"
                      >
                        {lng === 'he' ? 'טבלת מידות' : 'Size chart'}
                      </button>
                    )}
                  </div>

                  {/* One row of equal cells. The frame fixes seven 61.41px cells to
                      fill its 430px sidebar; flex-1 is the same row expressed so an
                      eight-size range still fits on one line instead of wrapping.
                      Dividers are border-e - the inline end, so they mirror. */}
                  <div className="mt-[12px] flex border border-border-default">
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
                          style={
                            option.inStock
                              ? undefined
                              : {
                                  backgroundImage:
                                    'linear-gradient(to top right, rgba(170,170,170,0) 49%, rgb(170,170,170) 50%, rgba(170,170,170,0) 51%)',
                                }
                          }
                          className={`flex h-[44px] flex-1 items-center justify-center border-e border-border-default font-ploni text-[16px] tabular-nums transition-colors last:border-e-0 ${
                            !option.inStock
                              ? 'cursor-not-allowed text-sako-gray-500'
                              : isSelected
                                ? 'bg-sako-ink-900 text-text-inverse'
                                : 'text-text-primary hover:bg-sako-gray-200'
                          }`}
                        >
                          {option.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Quantity or Out of Stock */}
                {(() => {
                  const allSizesOutOfStock = Object.keys(currentVariant.stockBySize).length > 0 && 
                    Object.values(currentVariant.stockBySize).every(stock => stock <= 0)
                  
                  if (allSizesOutOfStock) {
                    return (
                      <div className="mt-[13px] flex items-center justify-between border-b border-border-default pb-[13px]">
                        <h3 className="font-ploni text-[10px] font-bold text-text-primary lg:text-[12px]">
                          {lng === 'he' ? 'כמות' : 'Quantity'}
                        </h3>
                        <p className="font-ploni text-[12px] font-bold text-accent-error">
                          {lng === 'he' ? 'אזל מהמלאי' : 'OUT OF STOCK'}
                        </p>
                      </div>
                    )
                  }
                  
                  return (
                    <div>
                      {/* Quantity is absent from 438:2664, but kept as functionality the
                          frame omits. Given the same ruled-row vocabulary as the swatch
                          and size headers - label on the inline start, control on the
                          end - so it reads as part of the sidebar, not a leftover. */}
                      <div className="mt-[13px] flex items-center justify-between border-b border-border-default pb-[13px]">
                        <h3 className="font-ploni text-[10px] font-bold text-text-primary lg:text-[12px]">
                          {lng === 'he' ? 'כמות' : 'Quantity'}
                        </h3>
                        <QuantityStepper
                          value={quantity}
                          max={currentStock}
                          onChange={setQuantity}
                          language={lng === 'he' ? 'he' : 'en'}
                          disabled={isOutOfStock}
                        />
                      </div>
                      {!selectedSize && Object.keys(currentVariant.stockBySize).length > 0 && (
                        <p className="mt-[8px] font-ploni text-[10px] text-text-secondary lg:text-[12px]">
                          {lng === 'he' ? 'אנא בחרי מידה' : 'Please select a size'}
                        </p>
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
                  // 438:2703 gives the desktop bar an explicit 54px, taller than the
                  // shared 14px padding produces. Scoped with lg: rather than changing
                  // the sako size variant, which the product card also uses.
                  className="mt-[30px] duration-200 lg:h-[54px] lg:py-0"
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
                {/* gap, not space-x-4: space-x sets a physical margin that has to be
                    flipped by hand in RTL, and this row already reversed once. */}
                <div className="mt-[30px] flex gap-[8px]">
                  <button
                    type="button"
                    onClick={handleShare}
                    className={SECONDARY_ACTION_BUTTON}
                  >
                    <ShareIcon className="h-[14px] w-[14px]" aria-hidden="true" />
                    {lng === 'he' ? 'שיתוף' : 'Share'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleToggleFavorite(buildFavoriteKey(baseSku, colorSlug))
                    }}
                    aria-pressed={isFavorite(buildFavoriteKey(baseSku, colorSlug))}
                    className={SECONDARY_ACTION_BUTTON}
                  >
                    {/* The filled heart carries the state on its own. The design system
                        has no styling for a "saved" secondary button, and giving it the
                        dark fill it uses elsewhere for selection would have this
                        competing with the CTA directly above it. */}
                    {isFavorite(buildFavoriteKey(baseSku, colorSlug)) ? (
                      <HeartSolidIcon className="h-[14px] w-[14px]" aria-hidden="true" />
                    ) : (
                      <HeartIcon className="h-[14px] w-[14px]" aria-hidden="true" />
                    )}
                    {isFavorite(buildFavoriteKey(baseSku, colorSlug))
                      ? (lng === 'he' ? 'הסרה ממועדפים' : 'Remove from Favorites')
                      : (lng === 'he' ? 'הוספה למועדפים' : 'Add to Favorites')
                    }
                  </button>
                </div>

                {/* 438:2706 puts the description in the first accordion, open by
                    default, rather than as a loose heading above the others. */}
                {(lng === 'he' ? product.description_he : product.description_en) && (
                  // Wrapped because <Accordion> takes no className, and this is the
                  // first of the information sections, so it keeps their 30px gap.
                  <div className="mt-[30px]">
                    <Accordion title={lng === 'he' ? 'תיאור' : 'Description'} defaultOpen>
                      <p>{lng === 'he' ? product.description_he : product.description_en}</p>
                    </Accordion>
                  </div>
                )}
              </div>

              {/* Product Info */}
              <div className="border-t border-border-subtle pt-[30px]">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-ploni text-[16px] font-bold text-text-primary">
                      {lng === 'he' ? 'מידע נוסף' : 'Additional Information'}
                    </h4>
                    <div className="mt-2 space-y-2 font-ploni text-[13px] text-text-secondary">
                      {/* Availability and effective price as plain text. Both existed
                          only inside the JSON-LD before, so anything reading the page
                          as prose — a shopper skimming, or the sales assistant — had
                          no way to tell whether this colour was actually buyable. */}
                      <div className="flex justify-between">
                        <span>{lng === 'he' ? 'זמינות' : 'Availability'}:</span>
                        {/* The design system has no green; availability reads as the
                            error accent when it is out, plain ink when it is in. */}
                        <span className={isOutOfStock ? 'text-accent-error' : 'text-text-primary'}>
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
              {/* pt-0, and no spacing between the rows below: a disclosure is already
                  a fixed 62px band (100px from lg) with its label centred in it and a
                  rule closing it underneath, so the rows have to stack flush for that
                  centring to mean anything. Any gap here lands entirely ABOVE each
                  title — the rule above a row belongs to the row before it — which is
                  what made every header sit low in its own band, ~51px of air above
                  the label against ~21px below.
                  The 30px separating this block from the one above it is unaffected:
                  it is the sidebar's space-y, and it sits above this section's rule
                  rather than between the rule and the first row. */}
              <div className="border-t border-border-subtle">
                <div>
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
                            <span className="text-text-secondary">
                              {lng === 'he' ? 'חומר עליון:' : 'Upper Material:'}
                            </span>
                            <span className="text-text-primary">{upperMaterialText}</span>
                          </div>
                        )}
                        {insoleText && (
                          <div className="flex justify-between">
                            <span className="text-text-secondary">
                              {lng === 'he' ? 'מדרס:' : 'Insole:'}
                            </span>
                            <span className="text-text-primary">{insoleText}</span>
                          </div>
                        )}
                        {liningText && (
                          <div className="flex justify-between">
                            <span className="text-text-secondary">
                              {lng === 'he' ? 'בטנה:' : 'Lining:'}
                            </span>
                            <span className="text-text-primary">{liningText}</span>
                          </div>
                        )}
                        {outsoleText && (
                          <div className="flex justify-between">
                            <span className="text-text-secondary">
                              {lng === 'he' ? 'סוליה חיצונית:' : 'Outsole:'}
                            </span>
                            <span className="text-text-primary">{outsoleText}</span>
                          </div>
                        )}
                        {soleTypeText && (
                          <div className="flex justify-between">
                            <span className="text-text-secondary">
                              {lng === 'he' ? 'סוג סוליה:' : 'Sole Type:'}
                            </span>
                            <span className="text-text-primary">{soleTypeText}</span>
                          </div>
                        )}
                        {heelHeightText && (
                          <div className="flex justify-between">
                            <span className="text-text-secondary">
                              {lng === 'he' ? 'גובה עקב:' : 'Heel Height:'}
                            </span>
                            <span className="text-text-primary">{heelHeightText}</span>
                          </div>
                        )}
                        {/* Dimensions and weight: structured numbers when they exist,
                            otherwise the legacy free text, via buildMeasurementRows. */}
                        {measurementRows.map((row) => (
                          <div key={row.key} className="flex justify-between">
                            <span className="text-text-secondary">{row.label}:</span>
                            <span className="text-text-primary">{row.value}</span>
                          </div>
                        ))}
                        {closureTypeText && (
                          <div className="flex justify-between">
                            <span className="text-text-secondary">
                              {lng === 'he' ? 'סגירה:' : 'Closure:'}
                            </span>
                            <span className="text-text-primary">{closureTypeText}</span>
                          </div>
                        )}
                        {heelTypeText && (
                          <div className="flex justify-between">
                            <span className="text-text-secondary">
                              {lng === 'he' ? 'סוג עקב:' : 'Heel Type:'}
                            </span>
                            <span className="text-text-primary">{heelTypeText}</span>
                          </div>
                        )}
                        {toeShapeText && (
                          <div className="flex justify-between">
                            <span className="text-text-secondary">
                              {lng === 'he' ? 'צורת בהונות:' : 'Toe Shape:'}
                            </span>
                            <span className="text-text-primary">{toeShapeText}</span>
                          </div>
                        )}
                        {/* Bag attributes — empty for every non-bag product */}
                        {bagRows.map((row) => (
                          <div key={row.key} className="flex justify-between">
                            <span className="text-text-secondary">{row.label}:</span>
                            <span className="text-text-primary">{row.value}</span>
                          </div>
                        ))}
                        {(product.materialCare?.careInstructions_en || product.materialCare?.careInstructions_he) && (
                          <div className="mt-1 border-t border-border-subtle pt-2">
                            <span className="mb-1 block text-text-secondary">
                              {lng === 'he' ? 'הוראות טיפוח:' : 'Care Instructions:'}
                            </span>
                            <p className="leading-relaxed text-text-primary">
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
                              <span className="text-text-secondary">
                                {lng === 'he' ? 'התאמת מידה:' : 'Size Fit:'}
                              </span>
                              <span className="text-text-primary">
                                {getOptionLabel(SIZE_FIT_OPTIONS, shoeFit.sizeFit, lng as 'en' | 'he')}
                              </span>
                            </div>
                          )}
                          {!isUndefinedFitValue(shoeFit.footWidthFit) && (
                            <div className="flex justify-between">
                              <span className="text-text-secondary">
                                {lng === 'he' ? 'רוחב מומלץ:' : 'Recommended Foot Width:'}
                              </span>
                              <span className="text-text-primary">
                                {getOptionLabel(FOOT_WIDTH_FIT_OPTIONS, shoeFit.footWidthFit, lng as 'en' | 'he')}
                              </span>
                            </div>
                          )}
                          {!isUndefinedFitValue(shoeFit.archFit) && (
                            <div className="flex justify-between">
                              <span className="text-text-secondary">
                                {lng === 'he' ? 'קשת כף רגל:' : 'Arch Fit:'}
                              </span>
                              <span className="text-text-primary">
                                {getOptionLabel(ARCH_FIT_OPTIONS, shoeFit.archFit, lng as 'en' | 'he')}
                              </span>
                            </div>
                          )}
                          {adjustableFeatureLabels.length > 0 && (
                            <div className="flex justify-between">
                              <span className="text-text-secondary">
                                {lng === 'he' ? 'סגירה באמצעות:' : 'Adjustable Features:'}
                              </span>
                              <span className="text-text-primary">{adjustableFeatureLabels.join(', ')}</span>
                            </div>
                          )}
                          {notes && (
                            <p className="leading-relaxed text-text-secondary">{notes}</p>
                          )}
                        </div>
                      </Accordion>
                    )
                  })()}

                  {/* Shipping & Returns Section */}
                  <Accordion title={lng === 'he' ? 'משלוחים והחזרות' : 'Shipping & Returns'}>
                    <div className="leading-relaxed text-text-secondary">
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
      
      {/* Size Chart Sheet. Not mounted at all for non-footwear, so the dynamic
          chunk is never fetched for a bag or a belt either. */}
      {showSizeChart && (
        <SizeChart
          isOpen={isSizeChartOpen}
          onClose={() => setIsSizeChartOpen(false)}
          lng={lng as 'en' | 'he'}
        />
      )}

      {isMiniCartMounted && (
        <MiniCartDrawer
          open={isMiniCartOpen}
          onClose={() => setIsMiniCartOpen(false)}
          lng={lng}
        />
      )}
    </>
  )
}