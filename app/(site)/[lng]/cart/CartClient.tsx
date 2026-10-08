'use client'

/**
 * Cart, Figma 438:3991 (SAKO OR — Update).
 *
 * Two columns divided by a single black hairline: the line items run down the
 * inline-start side under a 60px Ploni Black heading, the order summary sits on
 * the inline-end side on gray-400 (#e7e3d7). Every side is expressed logically
 * so the English storefront mirrors rather than hardcoding RTL, and the columns
 * stack below lg where the 502px aside has no room.
 *
 * The summary aside and all of its arithmetic now live in OrderSummaryPanel and
 * useCartPricing, because checkout (438:2725 / 438:2836) draws the identical
 * panel and must not disagree with this screen about what the order costs.
 *
 * Design gaps, resolved and noted rather than dropped:
 * - The frame has no delivery-method control, but the storefront charges a
 *   different fee for self-pickup, so the radio pair is kept and restyled onto
 *   the system. It goes in the panel's slot, between points and totals.
 * - The frame shows no empty, loading or out-of-stock state. Those are built
 *   from the same tokens as the states it does draw.
 */

import { useState, useEffect, useRef, useTransition } from 'react'
import { useParams, useRouter } from 'next/navigation'
import SavedLineRowsSkeleton from '@/app/components/SavedLineRowsSkeleton'
// ProductLink, not next/link: the PDP now has a loading boundary, and prefetching
// a dynamic route that has one intermittently renders an empty page instead of the
// skeleton. See ProductLink - do not swap this back. Enforced by eslint.
import Link from 'next/link'
import ProductLink from '@/app/components/ProductLink'
import Image from 'next/image'

import QuantityStepper from '@/app/components/QuantityStepper'
import ProductCarousel from '@/app/components/ProductCarousel'
import OrderSummaryPanel from '@/app/components/checkout/OrderSummaryPanel'
import { useCart } from '@/app/hooks/useCart'
import { useCartPricing } from '@/app/hooks/useCartPricing'
import { useAuth } from '@/app/contexts/AuthContext'
import { trackViewCart } from '@/lib/dataLayer'
import { getColorName } from '@/lib/colors'
import { SHIPPING_METHOD_STORAGE_KEY, type ShippingMethod } from '@/lib/checkout-session'
import type { Product } from '@/lib/product-types'
import { SPLIT_SHELL_GRID } from '@/lib/split-shell-layout'

const CAPTION_CLASS = 'font-ploni text-[9px] tracking-[0.72px]'

/**
 * The cart is the same two-column shell as checkout and the auth pages, so the
 * grid and its dividing hairline come from one place — see lib/split-shell-layout
 * for why the rule is a pseudo-element on the container rather than a border on
 * the column, which is what made it stop partway down a short cart.
 */
const CART_GRID = SPLIT_SHELL_GRID

const content = {
  en: {
    title: 'Shopping Cart',
    emptyTitle: 'Your cart is empty',
    emptyDescription: "Looks like you haven't added any items to your cart yet.",
    emptyButton: 'Continue Shopping',
    remove: 'Remove',
    checkout: 'Proceed to Checkout',
    deliveryMethod: 'Delivery method',
    homeDelivery: 'Home delivery',
    selfPickup: 'Self pickup (free)',
    pickupNote: 'Pickup available at our store: Rothschild 51, Rishon Lezion',
    recommendationsTitle: 'You may also like',
    recommendationsEyebrow: 'YOU MAY ALSO LIKE',
    outOfStockLabel: 'OUT OF STOCK',
    checking: 'Checking availability…',
    stockDisclaimer: 'Items in your cart are not reserved until you complete your order.',
    cartInvalidMessage:
      'One or more products in your cart are no longer available. Please update your cart before continuing.'
  },
  he: {
    title: 'סל קניות',
    emptyTitle: 'הסל שלך ריק',
    emptyDescription: 'נראה שעדיין לא הוספת פריטים לסל.',
    emptyButton: 'המשך לקנות',
    remove: 'הסרה',
    checkout: 'המשך לתשלום',
    deliveryMethod: 'אופן קבלת ההזמנה',
    homeDelivery: 'משלוח עד הבית',
    selfPickup: 'איסוף עצמי (חינם)',
    pickupNote: 'האיסוף מתבצע מהחנות ברחוב רוטשילד 51, ראשון לציון',
    recommendationsTitle: 'אולי תאהבו גם',
    recommendationsEyebrow: 'YOU MAY ALSO LIKE',
    outOfStockLabel: 'אזל מהמלאי',
    checking: 'בודקים זמינות…',
    stockDisclaimer: 'המוצרים בסל אינם שמורים עבורך עד להשלמת ההזמנה',
    cartInvalidMessage: 'אחד או יותר מהמוצרים בסל אינם זמינים יותר. נא לעדכן את הסל לפני שממשיכים.'
  }
} as const

export interface CartClientProps {
  /** Feeds the "YOU MAY ALSO LIKE" rail below the cart. */
  recommendations?: Product[]
}

export default function CartClient({ recommendations = [] }: CartClientProps) {
  const params = useParams()
  const router = useRouter()
  const lng = (params?.lng as string) || 'en'
  const language: 'he' | 'en' = lng === 'he' ? 'he' : 'en'
  const isRTL = language === 'he'
  const t = content[language]

  const { items, removeFromCart, updateQuantity, loading, revalidateCart } = useCart()
  const { user } = useAuth()

  const [isClient, setIsClient] = useState(false)
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>('delivery')
  const [isRevalidating, setIsRevalidating] = useState(false)
  /**
   * The navigation half of the checkout handoff. router.push resolves as soon as
   * it is called, so without a transition there is nothing to hold a pending
   * state against - and isRevalidating is already false by then, which is why the
   * CTA used to go live again at the exact moment the ~1.5s wait began.
   */
  const [isNavigatingToCheckout, startCheckoutNavigation] = useTransition()
  const isCheckingOut = isRevalidating || isNavigatingToCheckout
  /** Guards the synchronous double-click window, before any state has committed. */
  const checkoutInFlightRef = useRef(false)

  const pricing = useCartPricing({ items, loading, lng, shippingMethod })
  const { purchasableItems, subtotal } = pricing

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const stored = localStorage.getItem(SHIPPING_METHOD_STORAGE_KEY)
      if (stored === 'delivery' || stored === 'pickup') setShippingMethod(stored)
    } catch (e) {
      console.warn('Failed to load shipping method from storage:', e)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(SHIPPING_METHOD_STORAGE_KEY, shippingMethod)
    } catch (e) {
      console.warn('Failed to persist shipping method:', e)
    }
  }, [shippingMethod])

  useEffect(() => {
    if (!isClient || loading || purchasableItems.length === 0) return
    try {
      trackViewCart(
        purchasableItems.map(item => ({
          name: item.name[language] || 'Unknown Product',
          id: item.sku,
          price: item.salePrice || item.price,
          brand: undefined,
          categories: undefined,
          variant: [item.size, item.color].filter(Boolean).join('-') || undefined,
          quantity: item.quantity
        })),
        'ILS'
      )
    } catch (dataLayerError) {
      console.warn('Data layer tracking error:', dataLayerError)
    }
  }, [isClient, loading, language, purchasableItems])

  const formatMoney = (value: number) =>
    `₪${value.toLocaleString(isRTL ? 'he-IL' : 'en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`

  /**
   * Stock is re-checked against live inventory before leaving the cart, so a
   * sold-out line is caught here rather than after the address form.
   */
  const handleCheckout = async () => {
    if (checkoutInFlightRef.current) return
    checkoutInFlightRef.current = true
    setIsRevalidating(true)
    let freshItems: typeof items | null = null
    try {
      freshItems = await revalidateCart()
    } finally {
      setIsRevalidating(false)
    }

    const stillPurchasable = (freshItems ?? items).filter(
      item =>
        !(
          item.stockStatus === 'out_of_stock' ||
          item.isOutOfStock ||
          item.maxStock <= 0 ||
          item.quantity <= 0
        )
    )

    // Sold out while they were looking at it: stay put and let them try again.
    if (stillPurchasable.length === 0) {
      checkoutInFlightRef.current = false
      return
    }

    // Inside a transition so isNavigatingToCheckout stays true until the checkout
    // route actually commits, which is the window the CTA has to keep answering for.
    startCheckoutNavigation(() => {
      router.push(`/${lng}/checkout`)
    })
  }

  /**
   * Both halves finished and this component is still mounted, so the handoff did
   * not happen - the navigation was interrupted, or revalidateCart threw. Release
   * the guard so the CTA is clickable again rather than stuck pending.
   */
  useEffect(() => {
    if (!isCheckingOut) {
      checkoutInFlightRef.current = false
    }
  }, [isCheckingOut])

  if (!isClient || loading) return <CartSkeleton title={t.title} />

  const isEmpty = items.length === 0

  return (
    <div className="min-h-screen bg-surface-secondary" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className={CART_GRID}>
        {/* ── Line items ─────────────────────────────────────────────── */}
        {/* No lg:border-e here any more — the divider is drawn by CART_GRID so its
            height follows the row rather than this column's content. */}
        <section>
          <div className="px-[16px] pt-[24px] pb-[24px] lg:px-[30px] lg:pt-[30px] lg:pb-[30px]">
            <h1 className="font-ploni text-[40px] font-black leading-[40px] text-start text-text-primary lg:text-[60px] lg:leading-[50px]">
              {t.title}
            </h1>
            {!isEmpty && (
              <p className={`${CAPTION_CLASS} mt-[12px] text-start text-sako-gray-800`}>
                {t.stockDisclaimer}
              </p>
            )}
          </div>

          {isEmpty ? (
            <div className="border-t border-sako-black px-[16px] py-[60px] text-start lg:px-[30px]">
              <h2 className="font-ploni text-[20px] font-black text-text-primary">{t.emptyTitle}</h2>
              <p className="mt-[10px] font-ploni text-[13px] leading-[16px] text-sako-gray-800">
                {t.emptyDescription}
              </p>
              <Link
                href={`/${lng}`}
                className="mt-[24px] inline-flex border border-btn-primary-bg bg-btn-primary-bg px-[32px] py-[14px] font-ploni text-[16px] font-bold leading-none text-btn-primary-text transition-colors hover:bg-sako-ink-800"
              >
                {t.emptyButton}
              </Link>
            </div>
          ) : (
            <ul className="border-t border-sako-black">
              {items.map((item, index) => {
                const isChecking = item.stockStatus === 'checking'
                const isOutOfStock =
                  !isChecking &&
                  (item.stockStatus === 'out_of_stock' ||
                    item.isOutOfStock ||
                    item.maxStock <= 0 ||
                    item.quantity <= 0)
                const productHref = `/${lng}/product/${item.sku}${item.color ? `/${item.color}` : ''}`
                const productName = item.name[language]
                // "שחור / 38" — the frame joins colour and size with a slash.
                const variantLine = [
                  item.color ? getColorName(item.color, language) : null,
                  item.size
                ]
                  .filter(Boolean)
                  .join(' / ')

                return (
                  <li
                    key={`${item.sku}-${item.size}-${item.color}-${index}`}
                    className={`flex min-h-[150px] border-b border-sako-black lg:min-h-[178px] ${
                      isOutOfStock ? 'opacity-60' : ''
                    }`}
                  >
                    <ProductLink
                      href={productHref}
                      className="relative w-[120px] shrink-0 self-stretch lg:w-[185px]"
                      aria-label={productName}
                    >
                      <Image
                        src={item.image || '/images/placeholder.svg'}
                        alt={productName}
                        fill
                        sizes="(min-width: 1024px) 185px, 120px"
                        className="object-contain"
                      />
                    </ProductLink>

                    <div className="flex min-w-0 flex-1 flex-col px-[14px] pt-[17px] pb-[18px] text-start">
                      <ProductLink href={productHref} className="min-w-0">
                        <h2 className="truncate font-ploni text-[16px] font-black uppercase text-text-primary transition-opacity hover:opacity-70 lg:text-[20px]">
                          {productName}
                        </h2>
                      </ProductLink>

                      {variantLine && (
                        <p className="mt-[2px] truncate font-ploni text-[12px] text-sako-gray-800">
                          {variantLine}
                        </p>
                      )}

                      {/* tabular-nums: Ploni's default figures are proportional. */}
                      <p className="pt-[10px] font-ploni text-[13px] leading-[16px] tabular-nums text-text-primary">
                        {item.salePrice && item.salePrice < item.price ? (
                          <>
                            <span className="text-sako-gray-800 line-through">
                              {formatMoney(item.price)}
                            </span>{' '}
                            <span className="text-accent-error">{formatMoney(item.salePrice)}</span>
                          </>
                        ) : (
                          formatMoney(item.salePrice || item.price)
                        )}
                      </p>

                      {isChecking && (
                        <p className={`${CAPTION_CLASS} mt-[6px] text-sako-gray-800`}>
                          {t.checking}
                        </p>
                      )}

                      {isOutOfStock && (
                        <p
                          className={`${CAPTION_CLASS} mt-[6px] inline-flex self-start bg-accent-error px-[8px] py-[4px] text-text-inverse`}
                        >
                          {t.outOfStockLabel}
                        </p>
                      )}

                      {/* Stepper under the price on the inline start, remove link at
                          the far end — the frame's 60px bottom-aligned row. */}
                      <div className="mt-auto flex items-end justify-between gap-[12px] pt-[16px]">
                        <QuantityStepper
                          value={item.quantity}
                          max={item.maxStock}
                          onChange={(next) => updateQuantity(item.sku, next, item.size, item.color)}
                          language={language}
                          disabled={isOutOfStock || isChecking}
                        />
                        <button
                          type="button"
                          onClick={() => removeFromCart(item.sku, item.size, item.color)}
                          className={`${CAPTION_CLASS} text-text-primary underline transition-opacity hover:opacity-60`}
                        >
                          {t.remove}
                        </button>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {/* ── Order summary ──────────────────────────────────────────── */}
        <OrderSummaryPanel
          pricing={pricing}
          language={language}
          shippingMethod={shippingMethod}
          showPoints={!!user}
          ctaLabel={t.checkout}
          onCta={handleCheckout}
          // isRevalidating moved out of `disabled`: a greyed-out button reads as
          // unavailable, where this one is working. ctaPending carries it instead,
          // and handleCheckout refuses re-entry on its own.
          ctaDisabled={purchasableItems.length === 0 || subtotal <= 0}
          ctaPending={isCheckingOut}
          notice={
            !isEmpty && (purchasableItems.length === 0 || subtotal <= 0)
              ? t.cartInvalidMessage
              : null
          }
          className="lg:sticky lg:top-0"
        >
          {/* Not in the frame, but the fee depends on it. */}
          <fieldset className="flex flex-col gap-[10px]">
            <legend className="mb-[10px] font-ploni text-[16px] font-bold leading-none text-start text-sako-ink-800">
              {t.deliveryMethod}
            </legend>
            {(['delivery', 'pickup'] as const).map(method => (
              <label
                key={method}
                className="flex cursor-pointer items-start gap-[10px] text-start font-ploni text-[13px] leading-[16px] text-sako-ink-800"
              >
                <input
                  type="radio"
                  name="shippingMethod"
                  value={method}
                  checked={shippingMethod === method}
                  onChange={() => setShippingMethod(method)}
                  className="mt-[1px] size-[14px] shrink-0 accent-sako-ink-900"
                />
                <span>
                  {method === 'delivery' ? t.homeDelivery : t.selfPickup}
                  {method === 'pickup' && (
                    <span className={`${CAPTION_CLASS} mt-[4px] block text-sako-gray-800`}>
                      {t.pickupNote}
                    </span>
                  )}
                </span>
              </label>
            ))}
          </fieldset>
        </OrderSummaryPanel>
      </div>

      {recommendations.length > 0 && (
        <ProductCarousel
          products={recommendations}
          title={t.recommendationsTitle}
          eyebrow={t.recommendationsEyebrow}
          language={language}
        />
      )}
    </div>
  )
}

/**
 * Shown while the cart hydrates from storage and revalidates stock. Reserves the
 * frame's two columns so the heading does not jump sideways once the real cart
 * paints.
 */
export function CartSkeleton({ title }: { title?: string }) {
  return (
    <div
      className="min-h-screen bg-surface-secondary"
      role="status"
      aria-busy="true"
      aria-label={title ?? 'Loading cart'}
    >
      <div className={CART_GRID}>
        {/* No lg:border-e here any more — the divider is drawn by CART_GRID so its
            height follows the row rather than this column's content. */}
        <section>
          <div className="px-[16px] pt-[24px] pb-[24px] lg:px-[30px] lg:pt-[30px] lg:pb-[30px]">
            {title ? (
              <h1 className="font-ploni text-[40px] font-black leading-[40px] text-start text-text-primary lg:text-[60px] lg:leading-[50px]">
                {title}
              </h1>
            ) : (
              <div className="sako-skeleton h-[50px] w-[240px]" />
            )}
          </div>
          <div className="border-t border-sako-black">
            <SavedLineRowsSkeleton rows={2} />
          </div>
        </section>
        <aside className="sako-skeleton min-h-[400px]" />
      </div>
    </div>
  )
}
