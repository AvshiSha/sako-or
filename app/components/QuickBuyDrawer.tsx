'use client'

import { useState, useEffect } from 'react'
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid'
import Image from 'next/image'
import Link from 'next/link'
import { Product, productHelpers } from '@/lib/firebase'
import { useFavorites } from '@/app/hooks/useFavorites'
import { useCart } from '@/app/hooks/useCart'
import Toast, { useToast } from '@/app/components/Toast'
import QuantityStepper from '@/app/components/QuantityStepper'
import { trackAddToCart as trackAddToCartEvent } from '@/lib/dataLayer'
import { getColorName } from '@/lib/colors'
import { buildFavoriteKey } from '@/lib/favorites'
import {
  getProductSizeOptions,
  getSizeGridColumns,
  SIZE_GRID_COLUMN_CLASS,
} from '@/lib/product-size-options'
import SideDrawer from '@/app/components/ui/side-drawer'

/**
 * Quick Buy drawer — composed, not transcribed.
 *
 * The SAKO OR — Update file has no Quick Buy frame: all 34 artboards were
 * checked, and `search_design_system` finds no drawer component (the obsolete
 * "Drawer/Cart" was deleted at 0 instances). So this is built the way the other
 * unframed routes were — out of constructions that are already approved
 * elsewhere, each one cited, rather than invented from the raw tokens:
 *
 * - Drawer shell and ruled sections — Product Filter panel, 438:3094 / 438:3579.
 *   A 501px board whose sections are a Bold 16 label over the control, each
 *   closed by a full-bleed hairline.
 * - Product summary row — Cart drawer line item, 438:4600. Text column with the
 *   name at Bold 16, the "colour / size" line at Regular 12 on gray-800, and the
 *   price at Regular 13/16, against a 119px image column.
 * - Size grid — PDP, 438:4234 + 438:4240. An ink-900 ground showing through 1px
 *   gaps, which is also what draws the dividers.
 * - Colour swatches — PDP, 438:4224, at the frame's 47px.
 * - Quantity — the shared QuantityStepper, 438:4667.
 * - Summary bar + CTA — Cart drawer, 438:4656 / 438:4662. A 62px ruled total row
 *   over a 58px ink bar carrying the label and a turned arrow.
 *
 * Two states the design system explicitly does not provide, flagged in its own
 * audit (438:7670) as developer gaps, are taken from what the PDP already
 * shipped so the two screens agree: the selected size (ink fill, inverse label)
 * and the stepper's boundary states (the stepper owns those itself).
 */

/**
 * One entry of a product's colour map. Narrower than the exported `ColorVariant`
 * - same reason FavoritesClient declares it - so the values coming out of
 * `Object.values(product.colorVariants)` assign without a cast.
 */
type ProductColorVariant = Product['colorVariants'][string]

interface QuickBuyDrawerProps {
  isOpen: boolean
  onClose: () => void
  product: Product
  language?: 'en' | 'he'
  /** Color slug selected on the product card when Quick Buy was clicked; drawer opens with this variant. */
  initialColorSlug?: string
}

/** 438:3102 — content inset by 30px, the rule left to run edge to edge. */
const SECTION = 'border-b border-sako-black px-[16px] py-[20px] lg:px-[30px]'
const SECTION_LABEL = 'font-ploni text-[16px] font-bold text-text-primary'

export default function QuickBuyDrawer({ isOpen, onClose, product, language = 'en', initialColorSlug }: QuickBuyDrawerProps) {
  const [selectedVariant, setSelectedVariant] = useState<ProductColorVariant | null>(null)
  const [selectedSize, setSelectedSize] = useState<string>('')
  const [quantity, setQuantity] = useState(1)
  const [isAddingToCart, setIsAddingToCart] = useState(false)
  const { isFavorite, toggleFavorite } = useFavorites()
  const { addToCart } = useCart()
  const { toast, showToast, hideToast } = useToast()

  const isRTL = language === 'he'

  // When drawer opens, sync to the color variant selected on the product card
  useEffect(() => {
    if (!isOpen) return
    if (!product.colorVariants) return
    const activeVariants = Object.values(product.colorVariants).filter(v => v.isActive !== false)
    const initialVariant = initialColorSlug
      ? activeVariants.find(v => v.colorSlug === initialColorSlug) ?? null
      : null
    setSelectedVariant(initialVariant)
    setSelectedSize('')
    setQuantity(1)
  }, [isOpen, initialColorSlug, product.colorVariants])

  // Fallback when no variant is selected yet (e.g. drawer opened without initialColorSlug)
  const defaultVariant = product.colorVariants
    ? Object.values(product.colorVariants).find(v => v.isActive !== false) || null
    : null
  const activeVariant = selectedVariant || defaultVariant

  if (!activeVariant) {
    return null
  }

  // Get current price (variant price takes precedence)
  const getCurrentPrice = () => {
    if (activeVariant.salePrice) return activeVariant.salePrice
    if (product.salePrice) return product.salePrice
    if ('priceOverride' in activeVariant && activeVariant.priceOverride) return activeVariant.priceOverride
    return product.price
  }

  // Get original price (without any sale price)
  const getOriginalPrice = () => {
    if ('priceOverride' in activeVariant && activeVariant.priceOverride) return activeVariant.priceOverride
    return product.price
  }

  const currentPrice = getCurrentPrice()
  const originalPrice = getOriginalPrice()
  const salePrice = activeVariant.salePrice || product.salePrice
  const isOnSale = Boolean(salePrice && salePrice < originalPrice)
  const productName = productHelpers.getField(product, 'name', language) || product.title_en || product.title_he || ''

  // Get primary image from the active variant
  const primaryImage = ('primaryImage' in activeVariant && activeVariant.primaryImage) || activeVariant.images?.[0]

  const stockBySize: Record<string, number> =
    'stockBySize' in activeVariant && activeVariant.stockBySize ? activeVariant.stockBySize : {}

  // The offered range comes from the category, not from the stock table, so sizes
  // the house does not currently hold still get a cell and are drawn unavailable
  // (438:2692). The old drawer filtered them out, which meant its "unavailable"
  // state could never render and the grid silently changed width per colour.
  const sizeOptions = getProductSizeOptions(product, stockBySize)
  const sizeGridColumns = getSizeGridColumns(sizeOptions.length)
  const isVariantSoldOut = sizeOptions.every(option => !option.inStock)
  const selectedStock = sizeOptions.find(option => option.key === selectedSize)?.stock ?? 0
  const needsSize = !selectedSize
  const canAddToCart = !isVariantSoldOut && !needsSize && !isAddingToCart

  const favoriteKey = buildFavoriteKey(product.baseSku || product.sku || '', activeVariant.colorSlug || '')
  const isWishlisted = isFavorite(favoriteKey)

  const handleVariantSelect = (variant: ProductColorVariant) => {
    setSelectedVariant(variant)
    setSelectedSize('') // Reset size selection when color changes
    setQuantity(1)
  }

  const handleSizeSelect = (size: string) => {
    setSelectedSize(size)
    setQuantity(1) // Reset quantity when size changes
  }

  const handleWishlistToggle = () => {
    if (favoriteKey) {
      void toggleFavorite(favoriteKey)
    }
  }

  const handleAddToCart = async () => {
    if (isAddingToCart) return

    const sku = product.baseSku || product.sku || ''
    if (!sku) {
      console.error('No SKU found for product')
      return
    }

    if (isVariantSoldOut) {
      showToast(isRTL ? 'פריט זה אזל מהמלאי' : 'This item is out of stock', 'error')
      return
    }

    if (needsSize) {
      return
    }

    setIsAddingToCart(true)

    try {
      const resolvedSalePrice = salePrice && salePrice > 0 ? salePrice : undefined
      const cartItem = {
        sku: sku,
        name: {
          en: productHelpers.getField(product, 'name', 'en') || product.title_en || '',
          he: productHelpers.getField(product, 'name', 'he') || product.title_he || ''
        },
        price: originalPrice,
        salePrice: resolvedSalePrice && resolvedSalePrice < originalPrice ? resolvedSalePrice : undefined,
        currency: 'ILS',
        image: primaryImage,
        color: activeVariant.colorSlug,
        size: selectedSize || undefined,
        maxStock: selectedStock
      }

      // Track add_to_cart for GA4 data layer
      try {
        const categories = product.categories_path || [product.category || 'Unknown']
        trackAddToCartEvent(
          [{
            name: productName || 'Unknown Product',
            id: sku,
            price: currentPrice,
            brand: product.brand,
            categories: categories,
            variant: selectedSize ? `${selectedSize}-${activeVariant.colorSlug}` : activeVariant.colorSlug,
            quantity: quantity
          }],
          product.currency || 'ILS'
        )
      } catch (dataLayerError) {
        console.warn('Data layer tracking error:', dataLayerError)
      }

      addToCart(cartItem, quantity)

      const successMessage = isRTL
        ? `הוספת ${quantity} ${quantity === 1 ? 'פריט' : 'פריטים'} לעגלה`
        : `Added ${quantity} ${quantity === 1 ? 'item' : 'items'} to cart`
      showToast(successMessage, 'success')

      // Close the drawer without navigating away.
      // Quick Buy is an in-place overlay; keep the user on the same page.
      onClose()
    } catch (error: any) {
      console.error('Error adding to cart:', error)

      let errorMessage = isRTL ? 'שגיאה בהוספה לעגלה' : 'Error adding to cart'
      if (error?.message) {
        errorMessage = error.message
      } else if (error?.error && typeof error.error === 'string') {
        errorMessage = error.error
      }

      showToast(errorMessage, 'error')
    } finally {
      setIsAddingToCart(false)
    }
  }

  const unitPrice = isOnSale && salePrice ? salePrice : currentPrice
  const lineTotal = unitPrice * quantity

  // The CTA carries the instruction rather than a separate hint line: its label is
  // the same "בחרי מידה" the card's trigger uses (438:3916), so the drawer answers
  // the control that opened it.
  const ctaLabel = isAddingToCart
    ? (isRTL ? 'מוסיף לעגלה...' : 'Adding to bag…')
    : isVariantSoldOut
      ? (isRTL ? 'אזל מהמלאי' : 'Out of stock')
      : needsSize
        ? (isRTL ? 'בחרי מידה' : 'Select size')
        : (isRTL ? `הוספה לסל - ₪${lineTotal.toFixed(2)}` : `Add to bag - ₪${lineTotal.toFixed(2)}`)

  return (
    <>
      {/* The shell is the shared SideDrawer - the navigation drawer's Radix sheet -
          rather than the Headless UI dialog this drawer used to carry its own copy
          of. Its slide, scrim fade, outside-tap close and page-scroll lock now come
          from the same place as the navigation panel's and the filter drawers'. */}
      <SideDrawer
        open={isOpen}
        onOpenChange={(next) => {
          if (!next) onClose()
        }}
        lng={language}
        title={isRTL ? 'בחרי מידה' : 'Select size'}
      >
        <div className="flex h-full flex-col bg-surface-primary" data-quick-buy-drawer>
          {/* Heading, 438:3097 / 438:4595. Heading/H3 rather than the cart
              drawer's 40px display: the title sits above a product name,
              and two display sizes in 120px of drawer fight each other. */}
          <div className="flex shrink-0 items-center justify-between border-b border-sako-black px-[16px] py-[20px] lg:px-[30px]">
            <h2 className="font-ploni text-[20px] font-black leading-none text-text-primary">
              {isRTL ? 'בחרי מידה' : 'Select size'}
            </h2>

            <div className="flex items-center gap-[16px]">
              {/* The card's favourite control, 438:3980 — the same asset and
                  the same accent-sale fill, so the heart does not change
                  shape between the grid and the drawer it opens. */}
              <button
                type="button"
                onClick={handleWishlistToggle}
                aria-pressed={isWishlisted}
                aria-label={
                  isWishlisted
                    ? (isRTL ? 'הסר ממועדפים' : 'Remove from favorites')
                    : (isRTL ? 'הוסף למועדפים' : 'Add to favorites')
                }
                className="flex items-center justify-center transition-opacity hover:opacity-70"
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

              <button
                type="button"
                onClick={onClose}
                aria-label={isRTL ? 'סגירה' : 'Close'}
                className="font-ploni text-[20px] leading-none text-text-primary transition-opacity hover:opacity-70"
              >
                &#10005;
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* Product summary — cart line item, 438:4600. Text track first
                so it takes the inline start and the image the end, which is
                how the frame reads once mirrored out of its LTR artboard. */}
            <div className="flex items-stretch border-b border-sako-black">
              <div className="flex min-w-0 flex-1 flex-col px-[16px] pt-[17px] pb-[18px] lg:px-[30px]">
                <h3 className="font-ploni text-[16px] font-bold text-text-primary">
                  {productName}
                </h3>

                {/* "שחור / 38" in the frame — the size joins once chosen. */}
                <p className="mt-[2px] font-ploni text-[12px] text-sako-gray-800">
                  {[getColorName(activeVariant.colorSlug, language), selectedSize]
                    .filter(Boolean)
                    .join(' / ')}
                </p>

                {/* Struck original first, current second — the order the
                    card and the PDP both use, so all three agree. */}
                <div className="mt-[10px] flex items-center gap-[10px] font-ploni text-[13px] leading-[16px] tabular-nums">
                  {isOnSale && salePrice ? (
                    <>
                      <span className="text-text-secondary line-through">
                        ₪{originalPrice.toFixed(2)}
                      </span>
                      <span className="font-bold text-text-primary">
                        ₪{salePrice.toFixed(2)}
                      </span>
                    </>
                  ) : (
                    <span className="font-bold text-text-primary">
                      ₪{currentPrice.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>

              {/* 119px image column, 438:4618. */}
              {primaryImage && (
                <div className="relative w-[119px] shrink-0 self-stretch bg-surface-secondary">
                  <Image
                    src={primaryImage}
                    alt={productName}
                    fill
                    sizes="119px"
                    className="object-contain"
                  />
                </div>
              )}
            </div>

            {/* Colour, 438:4224. Shown whenever the product has more than
                one active colour - a single-colour product has nothing to
                choose, and the name is already on the summary row. */}
            {product.colorVariants &&
              Object.values(product.colorVariants).filter(v => v.isActive !== false).length > 1 && (
                <div className={SECTION}>
                  <h3 className={SECTION_LABEL}>
                    {isRTL ? 'צבע' : 'Colour'}
                  </h3>
                  <div className="mt-[16px] flex flex-wrap gap-[6px]">
                    {Object.values(product.colorVariants)
                      .filter(variant => variant.isActive !== false)
                      .map((variant) => {
                        const variantImage = variant.primaryImage || variant.images?.[0]
                        const isSelected = variant.colorSlug === activeVariant.colorSlug
                        const variantSoldOut = Object.values(variant.stockBySize ?? {}).every(
                          stock => stock <= 0
                        )
                        const colorLabel = getColorName(variant.colorSlug, language)

                        return (
                          <button
                            key={variant.colorSlug}
                            type="button"
                            onClick={() => {
                              if (!variantSoldOut) handleVariantSelect(variant)
                            }}
                            disabled={variantSoldOut}
                            aria-pressed={isSelected}
                            aria-label={
                              variantSoldOut
                                ? `${colorLabel} — ${isRTL ? 'אזל מהמלאי' : 'out of stock'}`
                                : colorLabel
                            }
                            title={colorLabel}
                            className={`relative flex size-[47px] shrink-0 items-center justify-center overflow-hidden rounded-full border bg-surface-secondary transition-colors ${
                              isSelected
                                ? 'border-border-default'
                                : 'border-border-subtle hover:border-text-secondary'
                            } ${variantSoldOut ? 'cursor-not-allowed opacity-50' : ''}`}
                          >
                            {variantImage ? (
                              <Image
                                src={variantImage}
                                alt={colorLabel}
                                width={47}
                                height={47}
                                className="size-full object-cover"
                              />
                            ) : (
                              <span className="px-1 font-ploni text-[9px] leading-none text-text-secondary">
                                {colorLabel}
                              </span>
                            )}
                          </button>
                        )
                      })}
                  </div>
                </div>
              )}

            {/* Size, 438:4234 + 438:4240. The dividers are the grid itself:
                an ink ground showing through 1px gaps inside a 1px border,
                which keeps the hairlines even when the run wraps. */}
            <div className={SECTION}>
              <h3 className={SECTION_LABEL}>
                {isRTL ? 'מידה' : 'Size'}
              </h3>
              <div
                className={`mt-[16px] grid gap-px border border-border-default bg-sako-ink-900 p-px ${SIZE_GRID_COLUMN_CLASS[sizeGridColumns]}`}
              >
                {sizeOptions.map((option) => {
                  const isSelected = selectedSize === option.key
                  return (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => handleSizeSelect(option.key)}
                      disabled={!option.inStock}
                      aria-pressed={isSelected}
                      aria-label={
                        option.inStock
                          ? option.label
                          : `${option.label} — ${isRTL ? 'אזל מהמלאי' : 'out of stock'}`
                      }
                      // Sold out, 438:2692: grey label ruled corner to
                      // corner. `to top right` expresses the frame's
                      // hard-coded 35.6deg so the rule stays on the
                      // diagonal whatever width the cell resolves to.
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

                {/* Only reachable for counts that divide by nothing (7, 11).
                    Without these the ink ground reads as a solid block. */}
                {Array.from({
                  length: (sizeGridColumns - (sizeOptions.length % sizeGridColumns)) % sizeGridColumns,
                }).map((_, index) => (
                  <div
                    key={`size-spacer-${index}`}
                    aria-hidden="true"
                    className="h-[46px] bg-surface-secondary"
                  />
                ))}
              </div>
            </div>

            {/* Quantity — the sidebar's ruled row: label on the inline
                start, control opposite. Sold out replaces the control with
                the PDP's accent-error notice rather than a disabled
                stepper, which would read as a bug. */}
            <div className={`${SECTION} flex items-center justify-between`}>
              <h3 className={SECTION_LABEL}>
                {isRTL ? 'כמות' : 'Quantity'}
              </h3>
              {isVariantSoldOut ? (
                <p className="font-ploni text-[12px] font-bold text-accent-error">
                  {isRTL ? 'אזל מהמלאי' : 'OUT OF STOCK'}
                </p>
              ) : (
                <QuantityStepper
                  value={quantity}
                  max={selectedStock || undefined}
                  onChange={setQuantity}
                  language={isRTL ? 'he' : 'en'}
                  disabled={needsSize}
                />
              )}
            </div>
          </div>

          {/* Summary bar, 438:4656 — a 62px ruled row carrying the total on
              the inline start and, where the cart puts "סיכום ההזמנה", the
              route out to the full product page. */}
          <div className="flex h-[62px] shrink-0 items-center justify-between border-t border-sako-black bg-surface-secondary px-[16px] lg:px-[30px]">
            <span className="font-ploni text-[16px] font-bold tabular-nums text-text-primary">
              ₪{lineTotal.toFixed(2)}
            </span>
            {/* `product.sku`, not `baseSku`. The route's [baseSku] segment
                is resolved by getProductByBaseSku, which queries Firestore
                `where('sku', '==', segment)` - so the segment has to carry
                the sku field, and ProductCard links the same way. Most
                product records have no baseSku at all, which is what used to
                put /product/undefined/ in this href. Order matters: baseSku
                first would break the lookup wherever the two differ. */}
            <Link
              href={`/${language}/product/${product.sku || product.baseSku}/${activeVariant.colorSlug}`}
              onClick={onClose}
              className="font-ploni text-[11px] text-text-primary underline transition-opacity hover:opacity-70"
            >
              {isRTL ? 'פרטים נוספים' : 'More details'}
            </Link>
          </div>

          {/* CTA, 438:4662. Label on the inline start, turned arrow
              opposite. Unavailable is a flat gray-500 fill, the treatment
              the shared sako button uses - not a faded ink bar. */}
          <button
            type="button"
            onClick={handleAddToCart}
            disabled={!canAddToCart}
            aria-busy={isAddingToCart}
            className="flex h-[58px] shrink-0 items-center justify-between bg-sako-ink-900 px-[19px] transition-colors hover:bg-sako-ink-800 disabled:cursor-not-allowed disabled:bg-sako-gray-500"
          >
            <span className="font-ploni text-[13px] font-bold tabular-nums text-text-inverse">
              {ctaLabel}
            </span>
            {/* U+2199 turned 90 degrees, as the frame builds it. Ploni
                carries the glyph, so it needs no icon asset. */}
            <span
              aria-hidden="true"
              className="flex h-[14px] w-[32px] items-center justify-center"
            >
              <span className="rotate-90 font-ploni text-[22px] font-black leading-none text-text-inverse">
                &#8601;
              </span>
            </span>
          </button>
        </div>
      </SideDrawer>

      {/* Outside the drawer, deliberately. The toast used to be mounted inside the
          Headless UI Transition.Root, which unmounts its subtree once `show` goes
          false - and the only thing that raises the success toast is the add that
          also closes the drawer, so "added to bag" was torn down in the same tick
          it was raised. */}
      <Toast
        message={toast.message}
        isVisible={toast.isVisible}
        onClose={hideToast}
        duration={5000}
        type={toast.type}
      />
    </>
  )
}
