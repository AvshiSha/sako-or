'use client'

import Image from 'next/image'
// ProductLink, not next/link: the PDP now has a loading boundary, and prefetching
// a dynamic route that has one intermittently renders an empty page instead of the
// skeleton. See ProductLink - do not swap this back. Enforced by eslint.
import ProductLink from '@/app/components/ProductLink'
import { useState, useEffect, useCallback, useMemo, type MouseEvent } from 'react'
import { Product, ColorVariant, productHelpers } from '@/lib/product-types'
import { ShoppingCartIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid'
import dynamic from 'next/dynamic'
import { useFavorites } from '@/app/hooks/useFavorites'
import { trackSelectItem } from '@/lib/dataLayer'
import { getColorName } from '@/lib/colors'
import type { CarouselApi } from '@/app/components/ui/carousel'
import { Button } from '@/app/components/ui/button'
import { ProductImageCarousel } from '@/app/components/ProductImageCarousel'
import { buildFavoriteKey } from '@/lib/favorites'
import { useProductCouponBadge } from '@/app/contexts/CouponBadgeContext'
import { ProductPromoRibbon } from './ProductPromoRibbon'
import { persistCollectionBrowseBeforeNavigate } from '@/lib/collectionBrowseStore'
import { snapshotBeforeLeavingForProduct } from '@/lib/collectionScrollRestore'
import { useCollectionBrowseContext } from '@/app/contexts/CollectionBrowseContext'
import {
  PRODUCT_CARD_IMAGE_SIZES,
  PRODUCT_SWATCH_IMAGE_SIZES,
} from '@/lib/product-image-sizes'
import {
  PRODUCT_CARD_IMAGE_ASPECT,
  PRODUCT_CARD_IMAGE_FIT,
  PRODUCT_CARD_INFO_MIN_H,
  PRODUCT_CARD_PRICE_MIN_H,
} from '@/lib/product-card-layout'

const QuickBuyDrawer = dynamic(() => import('./QuickBuyDrawer'), { ssr: false })

/**
 * Design system badge, Figma node 438:3941: Ploni DemiBold 14/18 with 3px tracking
 * on a square, fully opaque swatch. The old pill (rounded, 12px, 80% opacity) is
 * gone - this design system has no rounded corners outside pill badges.
 */
const STATUS_BADGE_CLASS =
  'font-ploni text-[12px] font-semibold leading-[18px] tracking-[3px] px-[14px] py-[5px] pointer-events-none lg:text-[14px] lg:py-[8px]'

/**
 * The exact union the pre-split component held for `activeVariant` via
 * `selectedVariant || defaultVariant`: the inline shape stored on
 * `Product.colorVariants` (which lacks `colorName`, `stock`, `sizes` and the
 * timestamps), or the richer standalone `ColorVariant`.
 *
 * Spelled out rather than narrowed to `ColorVariant`, so the `'x' in variant`
 * narrowing and the optional-property reads inside `ProductCardInner` resolve
 * exactly as they did before the split. Tightening it to `ColorVariant` fails to
 * type-check, because that is not the shape product documents actually hold -
 * previously the mismatch was hidden by `handleVariantSelect(variant: any)`, so
 * the swatch handler was writing the inline shape into state declared as
 * `ColorVariant`. The state below is now typed as what it really holds.
 */
type ProductCardVariant = Product['colorVariants'][string] | ColorVariant

interface ProductCardProps {
  product: Product
  language?: 'en' | 'he'
  selectedColors?: string[] // Color filter from collection page
  preselectedColorSlug?: string // Preselected color variant (for variant items from collection pages)
  disableImageCarousel?: boolean // Disable image carousel (e.g., when inside ProductCarousel)
  isAboveFold?: boolean // Whether product is above the fold (for lazy loading)
  /** When set, scroll position is saved before navigating to the product page. */
  browseStoreKey?: string
  /** Stable id for scroll restoration on browser Back. */
  collectionAnchorKey?: string
}

/**
 * Picks the variant to display, and renders either the placeholder or the card.
 *
 * ## Why this is split in two
 *
 * This used to be one component with an early `return` for "no active variant"
 * sitting *above* eight hooks (`useMemo` x4, `useProductCouponBadge`,
 * `useCallback` x3). That is a rules-of-hooks violation - eight ESLint errors -
 * and not a cosmetic one: if a single mounted instance ever rendered once with
 * no variant and once with one, React throws "Rendered more hooks than during
 * the previous render" and the error boundary takes out the whole grid, which is
 * a blank content area of exactly the kind LOADING_ARCHITECTURE.md exists to
 * prevent.
 *
 * It could not fire in practice only because every call site keys by product
 * identity (`variantKey`, `product.id ?? sku`, `favoriteKey`), so a different
 * product always gets a fresh instance and a fresh hook list. It would have
 * fired the moment someone keyed a product list by array index - the usual
 * reflex when React warns about duplicate keys.
 *
 * Moving the early return below the hooks was not an option: the derived values
 * between them (`currentPrice`, `salePercent`, `favoriteKey`, `primaryImage`)
 * dereference the variant unconditionally, so that swaps a latent crash for a
 * guaranteed null dereference. Splitting instead makes the hooks unconditional
 * by construction: this component owns the decision and calls exactly one hook,
 * `ProductCardInner` assumes a non-null variant and owns everything else.
 *
 * `selectedVariant` stays *here*, above the gate, so the condition remains
 * byte-identical to the original `selectedVariant || defaultVariant`. Keeping it
 * in the inner component would have changed behaviour in one edge case: a
 * product whose variants all go inactive while the shopper has a swatch
 * selected used to keep rendering their choice, and would instead have dropped
 * to the placeholder.
 */
export default function ProductCard({ product, language = 'en', selectedColors, preselectedColorSlug, disableImageCarousel = false, isAboveFold = false, browseStoreKey, collectionAnchorKey }: ProductCardProps) {
  const [selectedVariant, setSelectedVariant] = useState<ProductCardVariant | null>(null)

  // Get the default color variant for display
  // Priority: preselectedColorSlug > selectedColors filter > first active variant
  const getDefaultVariant = () => {
    if (!product.colorVariants) return null

    const activeVariants = Object.values(product.colorVariants).filter(variant => variant.isActive !== false)

    // If preselectedColorSlug is provided (from variant item), use that variant
    if (preselectedColorSlug) {
      const preselectedVariant = activeVariants.find(variant =>
        variant.colorSlug === preselectedColorSlug
      )
      if (preselectedVariant) {
        return preselectedVariant
      }
    }

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

  if (!activeVariant) {
    return (
      <div className="group relative border-b border-l border-sako-black bg-surface-secondary" aria-hidden>
        <div
          className={`relative ${PRODUCT_CARD_IMAGE_ASPECT} overflow-hidden bg-surface-secondary block`}
        />
        <div
          className={`mt-0 border-t border-sako-black bg-surface-secondary px-[16px] pt-[15px] pb-[14px] ${PRODUCT_CARD_INFO_MIN_H}`}
        />
      </div>
    )
  }

  return (
    <ProductCardInner
      product={product}
      language={language}
      activeVariant={activeVariant}
      onVariantSelect={setSelectedVariant}
      disableImageCarousel={disableImageCarousel}
      isAboveFold={isAboveFold}
      browseStoreKey={browseStoreKey}
      collectionAnchorKey={collectionAnchorKey}
    />
  )
}

interface ProductCardInnerProps {
  product: Product
  language: 'en' | 'he'
  /** Never null - that is the whole point of the split. See ProductCard. */
  activeVariant: ProductCardVariant
  onVariantSelect: (variant: ProductCardVariant) => void
  disableImageCarousel: boolean
  isAboveFold: boolean
  browseStoreKey?: string
  collectionAnchorKey?: string
}

/**
 * The card itself, for a variant that is known to exist.
 *
 * Every hook below is unconditional: there is no early return above them, and
 * `activeVariant` is non-null by contract, so the null guards the extracted
 * hooks used to carry are gone rather than merely unreachable.
 *
 * Rendered at a fixed position by `ProductCard`, so it stays mounted across its
 * parent's re-renders and keeps the quick-buy latch, the carousel api and the
 * shopper's swatch choice intact.
 */
function ProductCardInner({
  product,
  language,
  activeVariant,
  onVariantSelect,
  disableImageCarousel,
  isAboveFold,
  browseStoreKey,
  collectionAnchorKey,
}: ProductCardInnerProps) {
  const [isQuickBuyOpen, setIsQuickBuyOpen] = useState(false)
  /** Latches on first open so the drawer survives its own closing animation. */
  const [hasOpenedQuickBuy, setHasOpenedQuickBuy] = useState(false)
  const { isFavorite, toggleFavorite } = useFavorites()
  const collectionBrowse = useCollectionBrowseContext()

  const [api, setApi] = useState<CarouselApi>()

  // Get all images from active variant
  const variantImages = useMemo(() => activeVariant.images || [], [activeVariant])

  const totalImages = variantImages.length

  const imageUrls = useMemo(
    () =>
      variantImages.map((image) =>
        typeof image === 'string' ? image : image?.url || ''
      ),
    [variantImages]
  )

  // Find primary image index
  const primaryImageIndex = useMemo(() => {
    if (totalImages === 0) return 0
    const primaryImage = ('primaryImage' in activeVariant && activeVariant.primaryImage) || null
    if (!primaryImage) return 0

    // Find the index of the primary image in the images array
    // Images are always strings in product.colorVariants
    const index = variantImages.findIndex(img => img === primaryImage)

    return index >= 0 ? index : 0
  }, [activeVariant, variantImages, totalImages])

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
  const salePercent =
    hasSalePrice() && salePrice && originalPrice > 0 && salePrice < originalPrice
      ? Math.round((1 - salePrice / originalPrice) * 100)
      : null
  const productName = language === 'he' ? (product.title_he || product.title_en) : (product.title_en || product.title_he) || 'Unnamed Product'

  const favoriteKey = buildFavoriteKey(product.baseSku || product.sku || '', activeVariant?.colorSlug || '')
  const isWishlisted = isFavorite(favoriteKey)
  const wishlistAriaLabel = isWishlisted
    ? (language === 'he' ? 'הסר מרשימת המשאלות' : 'Remove product from wishlist')
    : (language === 'he' ? 'הוסף לרשימת המשאלות' : 'Add product to wishlist')

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

  const quickBuyAriaLabel = isOutOfStock
    ? (language === 'he' ? 'אזל מהמלאי' : 'Out of stock')
    : (language === 'he' ? 'קניה מהירה' : 'Quick buy')

  // Check if the active variant is in "last call" (stock between 1 and 4)
  const isLastCall = useMemo(() => {
    return totalStock > 0 && totalStock < 4
  }, [totalStock])

  const promoBadge = useProductCouponBadge(product.sku, product.baseSku)

  const statusBadge = useMemo(() => {
    // Only the sale badge is designed (438:3941, accent-sale). Out of stock is
    // accent-error by decision - it read as just another dark chip next to NEW,
    // which is the one state that must not look like an ordinary label. Last Call
    // still predates the redesign and needs design sign-off.
    if (isOutOfStock) {
      return {
        text: language === 'he' ? 'אזל מהמלאי' : 'Out of Stock',
        className: 'bg-accent-error',
      }
    }
    if (isLastCall) {
      return {
        text: language === 'he' ? 'Last Call' : 'Last Call',
        className: 'bg-sako-brown-500',
      }
    }
    if (hasSalePrice() && salePercent != null && salePercent > 0) {
      return {
        text: `${salePercent}% OFF`,
        className: 'bg-accent-sale',
        dir: 'ltr' as const,
      }
    }
    if (product.newProduct && !hasSalePrice()) {
      return {
        text: language === 'he' ? 'NEW' : 'NEW',
        className: 'bg-surface-dark',
      }
    }
    return null
  }, [isOutOfStock, isLastCall, salePercent, salePrice, product.newProduct, language])

  const renderStatusBadge = () => {
    if (!statusBadge) return null
    return (
      <div
        dir={statusBadge.dir}
        className={`${STATUS_BADGE_CLASS} ${statusBadge.className} text-text-inverse`}
      >
        {statusBadge.text}
      </div>
    )
  }

  // Handle color variant selection - just change the display
  const handleVariantSelect = (variant: ProductCardVariant, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent click from bubbling up to parent (e.g., SearchBar wrapper)
    // Lives on the parent, which owns the variant decision. See ProductCard.
    onVariantSelect(variant)
  }

  // Handle wishlist toggle
  const handleWishlistToggle = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    // Save favorite as product + specific displayed color (when available)
    if (favoriteKey) {
      void toggleFavorite(favoriteKey)
    }
  }

  // Handle quick buy
  const handleQuickBuy = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    // Prevent opening Quick Buy if the active variant is out of stock
    if (isOutOfStock) {
      return
    }
    
    setHasOpenedQuickBuy(true)
    setIsQuickBuyOpen(true)
  }

  const saveBrowseScroll = useCallback(() => {
    const key = collectionBrowse.browseKey ?? browseStoreKey
    const snap = collectionBrowse.snapshotRef?.current
    const anchor = collectionAnchorKey
    if (key) {
      snapshotBeforeLeavingForProduct(key, anchor)
      if (snap) {
        persistCollectionBrowseBeforeNavigate(key, snap)
      }
    }
  }, [browseStoreKey, collectionBrowse.browseKey, collectionBrowse.snapshotRef, collectionAnchorKey])

  const handleLinkClick = useCallback((e: MouseEvent<HTMLAnchorElement>) => {
    if (api && 'clickAllowed' in api && typeof api.clickAllowed === 'function' && !api.clickAllowed()) {
      e.preventDefault()
      return
    }

    saveBrowseScroll()

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
  }, [product, activeVariant, currentPrice, language, api, saveBrowseScroll])

  // Handle arrow navigation (desktop only)
  const handleArrowClick = useCallback((direction: 'prev' | 'next', e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!api || totalImages <= 1) return
    if (direction === 'prev') api.scrollPrev()
    else api.scrollNext()
  }, [api, totalImages])

  return (
    // flex h-full: with wrapping names the cards in a row differ in height, and
    // the grid stretches each cell. Filling it keeps the extra space on the
    // card's own surface instead of showing the page through as a white band.
    <div className="group relative flex h-full flex-col border-b border-l border-sako-black bg-surface-secondary">
      {/* Main Product Image Section - Clickable to go to selected variant */}
      <ProductLink
        href={`/${language}/product/${product.sku}/${activeVariant.colorSlug}`}
        // A new product page must open at the top. Back-to-collection is
        // restored from the snapshot the handlers below write before leaving
        // (lib/collectionScrollRestore.ts), not by suppressing scroll here -
        // `scroll` only governs this forward navigation, never popstate.
        scroll={true}
        className={`relative ${PRODUCT_CARD_IMAGE_ASPECT} overflow-hidden bg-surface-secondary block`}
        onPointerDown={saveBrowseScroll}
        onClick={handleLinkClick}
      >
        {/* Image Carousel Container */}
        <div className="w-full h-full relative">
          {!disableImageCarousel && totalImages > 1 ? (
            <>
              <ProductImageCarousel
                key={`${product.sku}-${activeVariant.colorSlug}`}
                images={imageUrls}
                alt={`${productName} - ${activeVariant.colorSlug}`}
                direction={language === 'he' ? 'rtl' : 'ltr'}
                variant="card"
                isAboveFold={isAboveFold}
                initialIndex={primaryImageIndex}
                setApi={setApi}
                className="w-full h-full"
              />

              {/* Desktop Arrow Navigation - Only show when more than 1 image */}
              {totalImages > 1 && (
                <>
                  {/* Left Arrow (Previous) */}
                  <button
                    onClick={(e) => handleArrowClick('prev', e)}
                    className="absolute left-0 top-1/2 z-20 hidden -translate-y-1/2 items-center justify-center bg-surface-secondary/90 p-2 opacity-0 transition-opacity duration-200 hover:bg-surface-secondary group-hover:opacity-100 md:flex"
                    aria-label={language === 'he' ? 'תמונה קודמת' : 'Previous image'}
                  >
                    <ChevronLeftIcon className="h-5 w-5 text-text-primary" aria-hidden="true" />
                  </button>

                  {/* Right Arrow (Next) */}
                  <button
                    onClick={(e) => handleArrowClick('next', e)}
                    className="absolute right-0 top-1/2 z-20 hidden -translate-y-1/2 items-center justify-center bg-surface-secondary/90 p-2 opacity-0 transition-opacity duration-200 hover:bg-surface-secondary group-hover:opacity-100 md:flex"
                    aria-label={language === 'he' ? 'תמונה הבאה' : 'Next image'}
                  >
                    <ChevronRightIcon className="h-5 w-5 text-text-primary" aria-hidden="true" />
                  </button>
                </>
              )}
            </>
          ) : primaryImage ? (
            <div className="relative h-full w-full">
              <Image
                src={typeof primaryImage === 'string' ? primaryImage : primaryImage?.url || ''}
                alt={`${productName} - ${activeVariant.colorSlug}`}
                width={500}
                height={500}
                className={`h-full w-full ${PRODUCT_CARD_IMAGE_FIT} object-center${disableImageCarousel ? '' : ' transition-transform duration-300 group-hover:scale-105 md:group-hover:scale-100'}`}
                sizes={PRODUCT_CARD_IMAGE_SIZES}
                priority={isAboveFold}
                loading={isAboveFold ? undefined : 'lazy'}
                draggable={false}
              />
            </div>
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-sako-gray-300">
              <span className="font-ploni text-[12px] text-text-secondary">No Image</span>
            </div>
          )}
        </div>

        {/* Mobile Icons - Heart and Quick Buy */}
        {/* Mobile controls. The heart now uses the same design asset as desktop
            (438:3980) instead of a heroicon in a white pill, so the favourite control
            no longer changes shape at the breakpoint. The cart is kept - the design's
            mobile card does not show it, but removing it would drop a function, not
            just a style - and restyled onto the system. */}
        <div className="absolute top-2 right-2 z-20 flex flex-col gap-3 md:hidden">
          {/* Wishlist Button */}
          <button
            type="button"
            onClick={handleWishlistToggle}
            aria-label={wishlistAriaLabel}
            className="flex items-center justify-center"
          >
            {isWishlisted ? (
              <HeartSolidIcon
                className="h-[15.4808px] w-[17.3943px] text-accent-sale"
                aria-hidden="true"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src="/icons/sako/heart-card.svg"
                width={17.3943}
                height={15.4808}
                alt=""
                aria-hidden="true"
              />
            )}
          </button>

          {/* Quick Buy Icon */}
          <button
            type="button"
            onClick={handleQuickBuy}
            disabled={isOutOfStock}
            aria-label={quickBuyAriaLabel}
            className={`flex items-center justify-center ${
              isOutOfStock ? 'cursor-not-allowed opacity-50' : ''
            }`}
          >
            <ShoppingCartIcon
              className={`h-[17px] w-[17px] ${isOutOfStock ? 'text-text-secondary' : 'text-text-primary'}`}
              aria-hidden="true"
            />
          </button>
        </div>

        {/* Desktop Wishlist Button — design system 438:3935. The heart is present at
            all times now: Default and Hover ship the same outline asset, so the old
            hover-revealed white pill is gone. */}
        <button
          type="button"
          onClick={handleWishlistToggle}
          aria-label={wishlistAriaLabel}
          className="absolute top-[12px] right-[13px] z-20 hidden md:block"
        >
          {isWishlisted ? (
            // GAP: the design has no selected/filled heart - both card states export
            // the identical outline. Falling back to the solid icon at the design's
            // dimensions so the favourite state stays legible. Needs a real asset.
            <HeartSolidIcon
              className="h-[15.4808px] w-[17.3943px] text-accent-sale"
              aria-hidden="true"
            />
          ) : (
            // A 578-byte static SVG icon: next/image would add an optimizer round
            // trip for no gain, and the design asset's intrinsic 17.3943x15.4808
            // dimensions must be preserved rather than overridden.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="/icons/sako/heart-card.svg"
              width={17.3943}
              height={15.4808}
              alt=""
              aria-hidden="true"
            />
          )}
        </button>

        {/* Status badge — flush to the top-left corner at every width (438:3978).
            The desktop frame insets it by 9/10px, but matching mobile was the call:
            one position, and the badge sits hard into the card's corner.
            The old mobile placement was bottom-left, which needed a conditional to
            dodge the promo ribbon; moving it to the top removes that collision. */}
        {statusBadge && (
          <div
            className="pointer-events-none absolute left-[-1px] top-0 z-10"
          >
            {renderStatusBadge()}
          </div>
        )}

        {/* Promo ribbon — bottom-left inside image */}
        {promoBadge && (
          <ProductPromoRibbon
            language={language}
            promoBadge={promoBadge}
            size="card"
            className="absolute bottom-3 left-3 z-20 max-w-[calc(100%-3.75rem)]"
          />
        )}

        {/* Desktop Quick Buy Button - Overlay at bottom of image (z-20 so it sits above badges on hover) */}
        {/* Design system 438:3916 — a full-bleed dark bar flush to the bottom of the
            image, not an inset outlined button. The label changes from "קניה מהירה"
            to the design's "בחרי מידה"; it opens the same size-picking drawer. */}
        {/* group-focus-within as well as group-hover: the bar is only faded out, not
            removed, so without this a keyboard user can tab to an invisible control. */}
        <div className="absolute bottom-0 left-0 right-0 z-20 hidden opacity-0 transition-opacity duration-200 group-focus-within:opacity-100 group-hover:opacity-100 md:block">
          {/* The shared CTA, so the card and the PDP cannot drift apart again - this
              copy had been missing the design's Bold weight since it was written. */}
          <Button
            type="button"
            variant="sako"
            size="sako"
            onClick={handleQuickBuy}
            disabled={isOutOfStock}
            className="duration-200"
          >
            {isOutOfStock
              ? (language === 'he' ? 'אזל מהמלאי' : 'Out of Stock')
              : (language === 'he' ? 'בחרי מידה' : 'Select size')
            }
          </Button>
        </div>
      </ProductLink>

      {/* Product information — design system 438:3943 (desktop) / 438:3981 (mobile).
          The frame sets this as one row with the swatches inline on the end edge.
          Stacked by decision: name, SKU, price, swatches. Anything sharing the row
          takes width from the name, and on a 195px card that is the difference
          between a readable product name and an ellipsis - which is what both the
          inline swatches and, after that, the end-aligned price turned out to do.
          text-start rather than text-right so the English storefront mirrors
          correctly instead of hardcoding RTL. */}
      <div
        className={`mt-0 flex flex-1 flex-col gap-[6px] border-t border-sako-black bg-surface-secondary px-[10px] pt-[15px] pb-[14px] product-card-info-block lg:px-[16px] ${PRODUCT_CARD_INFO_MIN_H}`}
      >
        <div className="min-w-0 text-start">
          {/* line-clamp-2 across the full width of the card. */}
          <h3 className="line-clamp-2 font-ploni text-[12px] font-black uppercase leading-[14px] text-text-primary lg:text-[18px] lg:leading-[20px]">
            {productName}
          </h3>

          <div className="truncate font-ploni text-[9px] text-text-primary lg:text-[12px]">{product.sku}</div>
        </div>

        {/* tabular-nums is required: Ploni's default figures are proportional, so
            prices in a grid column would not align without it. */}
        <div
          className={`text-start font-ploni text-[14px] tabular-nums text-text-primary product-card-price-block lg:text-[17px] ${PRODUCT_CARD_PRICE_MIN_H}`}
        >
          {hasSalePrice() && salePrice && salePrice < originalPrice ? (
              // flex-wrap so the struck original and the sale price drop to a second
              // line on a narrow card rather than running into each other.
              <div className="flex flex-wrap items-center gap-x-[8px] gap-y-[2px]">
                <span className="text-text-secondary line-through">
                  ₪{originalPrice.toFixed(2)}
                </span>
                <span className="text-accent-error">
                  ₪{salePrice.toFixed(2)}
                </span>
              </div>
          ) : (
            <span>₪{currentPrice.toFixed(2)}</span>
          )}
        </div>

        {/* Colour swatches on a row of their own, so they never compete with the
            name or the price for width. Full width and horizontally scrollable: a
            product with six colours swipes instead of crowding. */}
        <div className="flex gap-[6px] overflow-x-auto lg:gap-[8px]">
          {product.colorVariants &&
            Object.values(product.colorVariants)
              .filter(variant => variant.isActive !== false)
              .map((variant) => {
                const variantImage = variant.primaryImage || variant.images?.[0]
                const variantImageSrc =
                  typeof variantImage === 'string'
                    ? variantImage
                    : (variantImage as { url?: string } | undefined)?.url || ''
                const isSelected = variant.colorSlug === activeVariant.colorSlug

                return (
                  <button
                    type="button"
                    key={variant.colorSlug}
                    onClick={(e) => handleVariantSelect(variant, e)}
                    // Circular swatches: the design system draws these as rectangles,
                    // but a round thumbnail is what this storefront used before and
                    // what was asked for. 32px below lg, 45px above - the design's own
                    // 22px is the diameter for a 195px-wide card, and this card also
                    // renders much wider than that below lg (single column, carousels,
                    // search), where 22px reads as a speck and is an unusable tap
                    // target. 42px is close to the 47px of usable height the 76px bar
                    // leaves after its 15/14 padding, and is a real tap target.
                    className={`group relative flex h-[36px] w-[36px] shrink-0 items-center justify-center overflow-hidden rounded-full border bg-surface-secondary transition-colors lg:h-[45px] lg:w-[45px] ${
                      isSelected ? 'border-border-default' : 'border-border-subtle hover:border-text-secondary'
                    }`}
                    aria-label={getColorName(variant.colorSlug, language)}
                    aria-pressed={isSelected}
                  >
                    {variantImageSrc && (
                      <Image
                        src={variantImageSrc}
                        alt={variant.colorSlug}
                        width={45}
                        height={45}
                        sizes={PRODUCT_SWATCH_IMAGE_SIZES}
                        className="h-full w-full object-cover"
                      />
                    )}
                  </button>
                )
              })}
        </div>
      </div>

      {/* Quick Buy Drawer. Mounted from the first open onwards rather than only
          while open: the drawer slides out as well as in, and a card that
          unmounts it on close tears the panel off the screen mid-animation. The
          gate stays so the dynamic chunk is still only fetched on first use. */}
      {hasOpenedQuickBuy && (
        <QuickBuyDrawer
          isOpen={isQuickBuyOpen}
          onClose={() => setIsQuickBuyOpen(false)}
          product={product}
          language={language}
          initialColorSlug={activeVariant?.colorSlug}
        />
      )}
    </div>
  )
} 