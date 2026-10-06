'use client'

import { useEffect, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'

import { Sheet, SheetContent, SheetTitle } from '@/app/components/ui/sheet'
import QuantityStepper from '@/app/components/QuantityStepper'
import { useCart } from '@/app/hooks/useCart'
import { getColorName } from '@/lib/colors'

/**
 * Mini cart drawer — "סיכום ביניים", Figma 438:4594 (SAKO OR — Update).
 *
 * Opens on a successful add from the PDP and replaces the add-to-cart success
 * toast: the drawer *is* the confirmation, and it shows the whole cart rather
 * than just the line that was added.
 *
 * 438:4594 is drawn as the mobile **cart page**, not as a drawer, so only its
 * interior is taken from the frame — the heading band, the line item (438:4600),
 * the 62px ruled summary row (438:4656) and the 58px ink CTA (438:4662). The
 * shell around them is the mobile navigation panel's, by request.
 *
 * **Why `Sheet` directly and not the shared `SideDrawer`.** SideDrawer is the
 * inline-END family (filter, Quick Buy): it opens opposite the ☰, at 78%/501px,
 * behind a black/30 scrim. This drawer was specified to match the *navigation*
 * panel instead — same side, same proportional width, same scrim, same
 * keyframes — so it takes `Sheet` with the navigation drawer's own props rather
 * than bending a shell whose whole contract is the other side. Everything the
 * brief asks for behaviourally (slide + scrim fade from globals.css, Escape,
 * outside-tap close, page-scroll lock, focus trap, focus restored to the
 * add-to-cart button on close) is Radix's and is therefore identical to the
 * navigation panel's by construction.
 *
 * Two deliberate departures from the navigation drawer, both forced:
 *
 * - **`h-dvh`, not the variant's `calc(105vh - 1rem)`.** This panel ends in a
 *   pinned CTA, and 5vh of overshoot puts that bar below the bottom edge of the
 *   screen where nobody can press it. Same reason SideDrawer overrides it.
 * - **Ground is `surface-secondary`.** The frame's board is #f2f2f2, not white.
 *
 * **Stock hydration.** `useCart` rehydrates from localStorage with only
 * sku/size/colour/quantity — no name, no price, no image, `maxStock: 0`,
 * `stockStatus: 'checking'` — and its automatic revalidation is deliberately
 * restricted to /cart and /checkout so that every drawer using the hook doesn't
 * fire its own call. On the PDP that would draw every pre-existing line as a
 * nameless ₪0.00 row with a dead stepper, so the drawer calls the hook's
 * `revalidateCart()` escape hatch once per opening. The line just added carries
 * full data already and renders immediately; the rest fill in behind it.
 */

const CAPTION_CLASS = 'font-ploni text-[9px] tracking-[0.72px]'

const content = {
  en: {
    title: 'Cart summary',
    close: 'Close',
    empty: 'Your cart is empty',
    remove: 'Remove',
    summaryLabel: 'Order summary',
    viewCart: 'View cart',
    outOfStockLabel: 'OUT OF STOCK',
    checking: 'Checking availability…',
    dialogName: 'Cart summary'
  },
  he: {
    title: 'סיכום ביניים',
    close: 'סגירה',
    empty: 'הסל שלך ריק',
    remove: 'הסרה',
    summaryLabel: 'סיכום ההזמנה',
    viewCart: 'מעבר לסל הקניות',
    outOfStockLabel: 'אזל מהמלאי',
    checking: 'בודקים זמינות…',
    dialogName: 'סיכום ביניים'
  }
} as const

export interface MiniCartDrawerProps {
  open: boolean
  onClose: () => void
  lng: string
}

export default function MiniCartDrawer({ open, onClose, lng }: MiniCartDrawerProps) {
  const language: 'he' | 'en' = lng === 'he' ? 'he' : 'en'
  const isRTL = language === 'he'
  const t = content[language]

  const { items, removeFromCart, updateQuantity, getTotalPrice, loading, revalidateCart } = useCart()

  // `revalidateCart` closes over `items`, so its identity changes on every cart
  // edit. Held in a ref so the effect below can depend on the opening rather
  // than re-firing after every quantity change.
  const revalidateRef = useRef(revalidateCart)
  useEffect(() => {
    revalidateRef.current = revalidateCart
  }, [revalidateCart])

  /**
   * `useCart` is a hook, not a store: this drawer gets its own `items` state and
   * syncs with the page's instance only through the `cartUpdated` event. It
   * therefore mounts with `items === []`, hydrates from localStorage a tick
   * later, and `revalidateCart` no-ops on an empty cart — so firing on `open`
   * alone validated nothing and every line stayed a nameless ₪0.00 row with a
   * dead stepper. Wait for the cart to actually be there, then validate once per
   * opening.
   */
  const validatedForOpeningRef = useRef(false)
  useEffect(() => {
    if (!open) {
      validatedForOpeningRef.current = false
      return
    }
    if (loading || items.length === 0 || validatedForOpeningRef.current) return
    validatedForOpeningRef.current = true
    void revalidateRef.current()
  }, [open, loading, items.length])

  /**
   * Page-scroll lock. Radix sets `overflow: hidden` on `<body>`, but this
   * storefront's scrolling element is `<html>` — so the page behind every
   * Sheet-based drawer in the app still scrolls, the navigation panel included.
   * Locking the real scroller is done here rather than in `sheet.tsx` so the fix
   * stays inside this feature; `html` keeps its scrollTop under `overflow:
   * hidden`, which is also what returns the PDP to the same position on close.
   * The padding replaces the scrollbar's width so the page does not jump.
   */
  useEffect(() => {
    if (!open) return
    const html = document.documentElement
    const previousOverflow = html.style.overflow
    const previousPadding = html.style.paddingInlineEnd
    const scrollbar = window.innerWidth - html.clientWidth

    html.style.overflow = 'hidden'
    if (scrollbar > 0) html.style.paddingInlineEnd = `${scrollbar}px`

    return () => {
      html.style.overflow = previousOverflow
      html.style.paddingInlineEnd = previousPadding
    }
  }, [open])

  const formatMoney = (value: number) =>
    `₪${value.toLocaleString(isRTL ? 'he-IL' : 'en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`

  // Any line still awaiting the stock reply means the subtotal is counting only
  // part of the cart for a moment. The figure is shown anyway — right after an
  // add you want to see a number — but marked busy rather than presented as
  // settled.
  const isSyncing = items.some(item => item.stockStatus === 'checking')
  const subtotal = getTotalPrice()

  return (
    <Sheet
      open={open}
      onOpenChange={next => {
        if (!next) onClose()
      }}
    >
      <SheetContent
        // The navigation drawer's side exactly (Navigation.tsx): the panel
        // arrives from the inline start — physically the right on the Hebrew
        // storefront, mirrored on /en so the two openers never disagree.
        side={isRTL ? 'right' : 'left'}
        dir={isRTL ? 'rtl' : 'ltr'}
        // The floating default ✕ sits absolute in the inline-start corner, on
        // top of the heading. This panel lays out its own in the heading row.
        hideClose
        // Width is the variant default — w-[90%], capped at sm:max-w-sm — i.e.
        // the navigation panel's, unmodified, on both mobile and desktop.
        className="flex h-dvh flex-col gap-0 border-0 bg-surface-secondary p-0"
        onOpenAutoFocus={event => event.preventDefault()}
      >
        {/* Heading band, 438:4595: Ploni UltraBold 40/50 over a full-bleed
            hairline. `whitespace-nowrap` is dropped from the frame so a longer
            title than its "הסל שלך" wraps instead of overflowing the panel. */}
        <div className="flex shrink-0 items-start justify-between gap-[16px] border-b border-sako-black px-[16px] py-[20px]">
          <SheetTitle className="font-ploni text-[40px] font-black leading-[50px] text-text-primary">
            {t.title}
          </SheetTitle>

          <button
            type="button"
            onClick={onClose}
            aria-label={t.close}
            className="mt-[12px] shrink-0 font-ploni text-[20px] leading-none text-text-primary transition-opacity hover:opacity-70"
          >
            &#10005;
          </button>
        </div>

        {/* The list scrolls; the summary row and the CTA below it do not. */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {items.length === 0 ? (
            <p className="px-[16px] py-[40px] font-ploni text-[16px] text-text-primary">
              {t.empty}
            </p>
          ) : (
            <ul>
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
                    className={`flex border-b border-sako-black ${isOutOfStock ? 'opacity-60' : ''}`}
                  >
                    {/* 119px image column, 438:4618. First in the DOM so it
                        takes the inline start — the right in Hebrew, which is
                        where the frame draws it and where the cart page puts
                        it, so the drawer and the page it previews agree. */}
                    <Link
                      href={productHref}
                      onClick={onClose}
                      className="relative w-[119px] shrink-0 self-stretch"
                      aria-label={productName}
                    >
                      <Image
                        src={item.image || '/images/placeholder.svg'}
                        alt={productName}
                        fill
                        sizes="119px"
                        className="object-contain"
                      />
                    </Link>

                    {/* Text track, 438:4600. */}
                    <div className="flex min-w-0 flex-1 flex-col px-[14px] pt-[17px] pb-[18px] text-start">
                      <Link href={productHref} onClick={onClose} className="min-w-0">
                        <h3 className="truncate font-ploni text-[16px] font-bold uppercase text-text-primary transition-opacity hover:opacity-70">
                          {productName}
                        </h3>
                      </Link>

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
                            <span className="text-accent-error">
                              {formatMoney(item.salePrice)}
                            </span>
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

                      {/* 438:4607 — the frame's 60px bottom-aligned row. The
                          stepper takes the inline start and "הסרה" the end,
                          which is how the frame reads once mirrored out of its
                          LTR artboard, and is what the cart page already does. */}
                      <div className="mt-auto flex items-end justify-between gap-[12px] pt-[16px]">
                        <QuantityStepper
                          value={item.quantity}
                          max={item.maxStock}
                          onChange={next =>
                            updateQuantity(item.sku, next, item.size, item.color)
                          }
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
        </div>

        {/* Summary row, 438:4656 — 62px, ruled top and bottom, label on the
            inline start and the amount opposite. */}
        <div
          aria-busy={isSyncing}
          className="flex h-[62px] shrink-0 items-center justify-between border-t border-b border-sako-black bg-surface-secondary px-[16px]"
        >
          <span className="font-ploni text-[11px] text-text-primary">{t.summaryLabel}</span>
          <span
            className={`font-ploni text-[16px] font-bold tabular-nums text-text-primary transition-opacity ${
              isSyncing ? 'opacity-60' : 'opacity-100'
            }`}
          >
            {formatMoney(subtotal)}
          </span>
        </div>

        {/* CTA, 438:4662 — a 58px ink bar carrying the label on the inline
            start and the turned arrow opposite. The frame's label is checkout
            wording; the brief specifies the cart page instead, so this is a
            <Link> to /[lng]/cart rather than a checkout button. */}
        <div className="shrink-0 px-[16px] pt-[11px] pb-[16px]">
          <Link
            href={`/${lng}/cart`}
            onClick={onClose}
            className="flex h-[58px] items-center justify-between bg-sako-ink-900 px-[19px] transition-colors hover:bg-sako-ink-800"
          >
            <span className="font-ploni text-[13px] font-bold text-text-inverse">
              {t.viewCart}
            </span>
            {/* U+2199 turned 90 degrees, exactly as the frame builds it. Ploni
                carries the glyph, so it needs no icon asset. */}
            <span
              aria-hidden="true"
              className="flex h-[14px] w-[32px] items-center justify-center"
            >
              <span className="rotate-90 font-ploni text-[22px] font-black leading-none text-text-inverse">
                &#8601;
              </span>
            </span>
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  )
}
