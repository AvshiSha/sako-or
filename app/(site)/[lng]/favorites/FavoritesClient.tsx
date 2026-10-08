'use client'

/**
 * Favorites, Figma 438:4076 (SAKO OR — Update).
 *
 * The frame replaces the old product grid with the cart's line-item list: a
 * 60px Ploni Black heading over a full-bleed black hairline, then rows of
 * 185px image on the inline start and name / variant / price opposite, each
 * row closed by its own hairline. It is the same construction as Cart
 * (438:3991) minus the order-summary column, so this screen deliberately reads
 * the same as CartClient rather than re-deriving the row.
 *
 * Every side is logical (text-start, border-b, no left/right): Figma's
 * artboards are LTR with Hebrew copy in them, so the frame's visual right is
 * the logical start and the same markup mirrors for /en. Direction comes from
 * the `dir` the [lng] layout puts on <html>, never from dir="auto".
 *
 * Design gaps, resolved and noted rather than dropped:
 * - The frame draws a Quantity Stepper in each row, carried over from the cart
 *   line item it was duplicated from. Favorites hold no quantity — they are
 *   keyed by baseSku + colour — so that slot takes the "select size" control
 *   instead, at the stepper's exact 31px height and 12px type so the row's
 *   rhythm is unchanged. It opens the existing QuickBuyDrawer, because a size
 *   still has to be chosen before anything can reach the cart.
 * - The variant line reads "שחור / 38" in the frame. A favourite stores a
 *   colour and no size, so only the colour name is shown.
 * - The frame has no empty, loading or out-of-stock state. Those are built
 *   from the same tokens as the states it does draw.
 * - The frame's rows are 447px wide on a 1728 canvas with the rest of the
 *   page empty. The list is capped at 640px and hugs the inline start, which
 *   keeps the frame's proportions without stranding the remove link a
 *   thousand pixels from the price.
 */

import { useState, useEffect, useRef, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { useParams } from 'next/navigation'
import SavedLineRowsSkeleton from '@/app/components/SavedLineRowsSkeleton'
// ProductLink, not next/link: the PDP now has a loading boundary, and prefetching
// a dynamic route that has one intermittently renders an empty page instead of the
// skeleton. See ProductLink - do not swap this back. Enforced by eslint.
import Link from 'next/link'
import ProductLink from '@/app/components/ProductLink'
import Image from 'next/image'

import ProductCarousel from '@/app/components/ProductCarousel'
import { useFavorites } from '@/app/hooks/useFavorites'
import { parseFavoriteKey } from '@/lib/favorites'
import { getColorName } from '@/lib/colors'
import { productService, type Product } from '@/lib/firebase'

/** One entry of a product's colour map — the shape the rows actually read. */
type FavoriteVariant = Product['colorVariants'][string]

const QuickBuyDrawer = dynamic(() => import('@/app/components/QuickBuyDrawer'), { ssr: false })

/** Typography/Caption — 9px Ploni at 0.72px tracking, the frame's "הסרה". */
const CAPTION_CLASS = 'font-ploni text-[9px] tracking-[0.72px]'

/**
 * The stepper's box, reused for the action that replaces it: 31px tall, 1px
 * border on border-default, 12px Ploni. Matching its metrics is what keeps the
 * row's bottom edge where the frame puts it.
 */
const ROW_ACTION_CLASS =
  'inline-flex h-[31px] items-center border border-border-default px-[14px] font-ploni text-[12px] leading-none text-text-primary transition-colors hover:bg-btn-primary-bg hover:text-btn-primary-text disabled:cursor-not-allowed disabled:border-sako-gray-500 disabled:text-sako-gray-500 disabled:hover:bg-transparent disabled:hover:text-sako-gray-500'

const content = {
  en: {
    title: 'Favorites',
    itemsOne: 'item',
    itemsMany: 'items',
    emptyTitle: 'No favorites yet',
    emptyDescription: 'Start adding products to your favorites to see them here.',
    emptyButton: 'Browse Products',
    remove: 'Remove',
    removeAria: 'Remove from favorites',
    selectSize: 'Select size',
    outOfStockLabel: 'OUT OF STOCK',
    recommendationsTitle: 'You may also like',
    recommendationsEyebrow: 'YOU MAY ALSO LIKE'
  },
  he: {
    title: 'מועדפים',
    itemsOne: 'פריט',
    itemsMany: 'פריטים',
    emptyTitle: 'אין מועדפים עדיין',
    emptyDescription: 'התחילי להוסיף מוצרים למועדפים כדי לראות אותם כאן.',
    emptyButton: 'עיין במוצרים',
    remove: 'הסרה',
    removeAria: 'הסרה מהמועדפים',
    selectSize: 'בחרי מידה',
    outOfStockLabel: 'אזל מהמלאי',
    recommendationsTitle: 'אולי תאהבו גם',
    recommendationsEyebrow: 'YOU MAY ALSO LIKE'
  }
} as const

interface FavoriteItem extends Product {
  favoriteKey: string
  favoriteBaseSku: string
  favoriteColorSlug?: string
}

export interface FavoritesClientProps {
  /** Feeds the rail the frame instances below the list (438:4125). */
  recommendations?: Product[]
}

/**
 * A product only belongs on this page while it is still sellable. Mirrors the
 * storefront's own enabled/deleted precedence, with the legacy isActive flag
 * last for documents that predate isEnabled.
 */
function isProductStorefrontActive(product: Product | null): boolean {
  if (!product) return false
  const candidate = product as Product & { isDeleted?: boolean; isActive?: boolean }
  if (candidate.isDeleted === true) return false
  if (typeof candidate.isEnabled === 'boolean') return candidate.isEnabled
  if (typeof candidate.isActive === 'boolean') return candidate.isActive
  return true
}

export default function FavoritesClient({ recommendations = [] }: FavoritesClientProps) {
  const params = useParams()
  const lng = (params?.lng as string) || 'en'
  const language: 'he' | 'en' = lng === 'he' ? 'he' : 'en'
  const isRTL = language === 'he'
  const t = content[language]

  const { favorites: favoriteKeys, toggleFavorite, loading: favoritesLoading } = useFavorites()

  const [items, setItems] = useState<FavoriteItem[]>([])
  const [loading, setLoading] = useState(true)
  const [isClient, setIsClient] = useState(false)
  // The item outlives the open flag on purpose: the drawer slides out, and
  // clearing the item on close would unmount it mid-animation and leave the row
  // with nothing to animate. It stays set until another row is chosen.
  const [quickBuyItem, setQuickBuyItem] = useState<FavoriteItem | null>(null)
  const [isQuickBuyOpen, setIsQuickBuyOpen] = useState(false)

  // Prevents the auto-cleanup below from firing again for a key it already removed.
  const cleanedFavoriteKeysRef = useRef<Set<string>>(new Set())

  /**
   * toggleFavorite is held in a ref rather than listed as a dependency below.
   *
   * Its own deps are [mode, user], and `user` gets a new identity when Firebase
   * auth finishes initialising - about a second after first paint. That recreated
   * the callback, re-ran the loader, and put `setLoading(true)` back on the
   * screen: the empty favourites page rendered skeleton, then the empty state,
   * then the skeleton again, then the empty state. Measured at 408ms, 1355ms and
   * 1490ms. Only the cleanup branch calls it, and only for keys that are already
   * gone, so it never needs to be the reason this effect re-runs.
   */
  const toggleFavoriteRef = useRef(toggleFavorite)
  useEffect(() => {
    toggleFavoriteRef.current = toggleFavorite
  }, [toggleFavorite])

  /**
   * The identity of `favoriteKeys` is not stable across context re-renders, and
   * what this loader actually depends on is the set of keys, not the array that
   * carries them.
   */
  const favoriteKeysSignature = (favoriteKeys ?? []).join('|')

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (!isClient) return
    if (favoritesLoading) {
      setLoading(true)
      return
    }

    let cancelled = false

    const loadFavorites = async () => {
      try {
        setLoading(true)

        if (!favoriteKeys || favoriteKeys.length === 0) {
          if (!cancelled) setItems([])
          return
        }

        // One fetch per baseSku, however many colours of it are favourited - and
        // all of them at once. This loop used to await each product in turn, so a
        // list of ten saved pairs cost ten serial round trips from the browser
        // before anything rendered. They do not depend on each other.
        const parsed = (favoriteKeys ?? [])
          .map(favoriteKey => ({ favoriteKey, ...parseFavoriteKey(favoriteKey) }))
          .filter(entry => entry.baseSku)
        const uniqueBaseSkus = Array.from(new Set(parsed.map(entry => entry.baseSku)))

        const fetched = await Promise.all(
          uniqueBaseSkus.map(async baseSku => {
            try {
              let product = await productService.getProductByBaseSku(baseSku)
              if (!product) product = await productService.getProductBySku(baseSku)
              if (!product) {
                // Last resort, and the expensive one - kept for parity with the
                // previous behaviour, but now it can only ever run for a baseSku
                // the two targeted lookups both missed.
                const allProducts = await productService.getAllProducts()
                product = allProducts.find(p => p.baseSku === baseSku) || null
              }
              return [baseSku, product] as const
            } catch (error) {
              console.error(`Error fetching product ${baseSku}:`, error)
              return [baseSku, null] as const
            }
          })
        )

        if (cancelled) return

        const productCache = new Map<string, Product | null>(fetched)
        const resolved: FavoriteItem[] = []
        const inactiveFavoriteKeys: string[] = []

        for (const { favoriteKey, baseSku, colorSlug } of parsed) {
          const product = productCache.get(baseSku) ?? null

          if (product && isProductStorefrontActive(product)) {
            resolved.push({
              ...product,
              favoriteKey,
              favoriteBaseSku: baseSku,
              favoriteColorSlug: colorSlug || undefined
            })
          } else {
            // Missing or no longer sellable: drop it from the list and from the
            // stored favourites, so it does not come back on the next refresh.
            inactiveFavoriteKeys.push(favoriteKey)
          }
        }

        if (cancelled) return
        setItems(resolved)

        const toRemove = Array.from(new Set(inactiveFavoriteKeys)).filter(
          key => key && !cleanedFavoriteKeysRef.current.has(key)
        )
        if (toRemove.length > 0) {
          toRemove.forEach(key => cleanedFavoriteKeysRef.current.add(key))
          await Promise.all(
            toRemove.map(async key => {
              try {
                await toggleFavoriteRef.current(key)
              } catch {
                // Best effort — the list is already filtered either way.
              }
            })
          )
        }
      } catch (error) {
        console.error('Error loading favorites:', error)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadFavorites()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see the refs above:
    // favoriteKeysSignature stands in for favoriteKeys, and toggleFavorite is held
    // in a ref so an auth-driven identity change cannot restart the loader.
  }, [isClient, favoritesLoading, favoriteKeysSignature])

  const formatMoney = (value: number) =>
    `₪${value.toLocaleString(isRTL ? 'he-IL' : 'en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`

  if (!isClient || loading) return <FavoritesSkeleton title={t.title} />

  const isEmpty = items.length === 0

  return (
    <div className="min-h-screen bg-surface-secondary" dir={isRTL ? 'rtl' : 'ltr'}>
      <section>
        <div className="px-[16px] pt-[24px] pb-[24px] lg:px-[30px] lg:pt-[30px] lg:pb-[30px]">
          <h1 className="font-ploni text-[40px] font-black leading-[40px] text-start text-text-primary lg:text-[60px] lg:leading-[50px]">
            {t.title}
          </h1>
          {!isEmpty && (
            <p className={`${CAPTION_CLASS} mt-[12px] text-start tabular-nums text-sako-gray-800`}>
              {items.length} {items.length === 1 ? t.itemsOne : t.itemsMany}
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
          // The rule above the list runs the full width of the frame (438:4087);
          // the row rules below it only span the rows themselves (438:4088).
          <div className="border-t border-sako-black">
            <ul className="lg:max-w-[640px]">
              {items.map(item => (
                <FavoriteRow
                  key={item.favoriteKey}
                  item={item}
                  language={language}
                  labels={t}
                  formatMoney={formatMoney}
                  onRemove={() => void toggleFavorite(item.favoriteKey)}
                  onSelectSize={() => {
                    setQuickBuyItem(item)
                    setIsQuickBuyOpen(true)
                  }}
                />
              ))}
            </ul>
          </div>
        )}
      </section>

      {recommendations.length > 0 && (
        <ProductCarousel
          products={recommendations}
          title={t.recommendationsTitle}
          eyebrow={t.recommendationsEyebrow}
          language={language}
        />
      )}

      {quickBuyItem && (
        <QuickBuyDrawer
          isOpen={isQuickBuyOpen}
          onClose={() => setIsQuickBuyOpen(false)}
          product={quickBuyItem}
          language={language}
          initialColorSlug={quickBuyItem.favoriteColorSlug}
        />
      )}
    </div>
  )
}

/**
 * One line of the frame's list (438:4089 + 438:4101): image on the inline
 * start, then name, colour, price, and the bottom-aligned action row.
 */
function FavoriteRow({
  item,
  language,
  labels,
  formatMoney,
  onRemove,
  onSelectSize
}: {
  item: FavoriteItem
  language: 'he' | 'en'
  labels: (typeof content)['he'] | (typeof content)['en']
  formatMoney: (value: number) => string
  onRemove: () => void
  onSelectSize: () => void
}) {
  // The favourited colour, falling back to the first still-active one if that
  // colour has since been retired from the product.
  const variant = useMemo<FavoriteVariant | null>(() => {
    const variants = item.colorVariants
    if (!variants) return null

    const favorited = item.favoriteColorSlug ? variants[item.favoriteColorSlug] : undefined
    if (favorited && favorited.isActive !== false) return favorited

    return Object.values(variants).find(v => v.isActive !== false) || null
  }, [item.colorVariants, item.favoriteColorSlug])

  const totalStock = useMemo(() => {
    if (!variant?.stockBySize) return 0
    return Object.values(variant.stockBySize).reduce<number>(
      (total, stock) => total + (stock || 0),
      0
    )
  }, [variant])

  // Same precedence as ProductCard, so a row and its grid card never disagree
  // about what the product costs.
  const originalPrice = variant?.priceOverride || item.price
  const salePrice = variant?.salePrice || item.salePrice
  const currentPrice = salePrice || variant?.priceOverride || item.price

  const isOutOfStock = totalStock <= 0
  const colorSlug = variant?.colorSlug || item.favoriteColorSlug
  const productName =
    (language === 'he' ? item.title_he || item.title_en : item.title_en || item.title_he) || ''
  const imageSrc = variant?.primaryImage || variant?.images?.[0] || '/images/placeholder.svg'

  // sku first: the route's [baseSku] segment is resolved by getProductByBaseSku,
  // which queries Firestore `where('sku', '==', segment)`. baseSku-first happens to
  // work only because most records have no baseSku to prefer - it would miss on any
  // record where the two differ.
  const productHref = `/${language}/product/${item.sku || item.baseSku}/${colorSlug || 'default'}`

  return (
    <li
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
          src={imageSrc}
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

        {colorSlug && (
          <p className="mt-[2px] truncate font-ploni text-[12px] text-sako-gray-800">
            {getColorName(colorSlug, language)}
          </p>
        )}

        {/* tabular-nums: Ploni's default figures are proportional. */}
        <p className="pt-[10px] font-ploni text-[13px] leading-[16px] tabular-nums text-text-primary">
          {salePrice && salePrice < originalPrice ? (
            <>
              <span className="text-sako-gray-800 line-through">{formatMoney(originalPrice)}</span>{' '}
              <span className="text-accent-error">{formatMoney(salePrice)}</span>
            </>
          ) : (
            formatMoney(currentPrice)
          )}
        </p>

        {isOutOfStock && (
          <p
            className={`${CAPTION_CLASS} mt-[6px] inline-flex self-start bg-accent-error px-[8px] py-[4px] text-text-inverse`}
          >
            {labels.outOfStockLabel}
          </p>
        )}

        {/* The frame's bottom-aligned row: the stepper's slot on the inline
            start, the remove link at the far end. */}
        <div className="mt-auto flex items-end justify-between gap-[12px] pt-[16px]">
          <button
            type="button"
            onClick={onSelectSize}
            disabled={isOutOfStock}
            className={ROW_ACTION_CLASS}
          >
            {isOutOfStock ? labels.outOfStockLabel : labels.selectSize}
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label={labels.removeAria}
            className={`${CAPTION_CLASS} text-text-primary underline transition-opacity hover:opacity-60`}
          >
            {labels.remove}
          </button>
        </div>
      </div>
    </li>
  )
}

/**
 * Shown while favourites hydrate from storage or the account and their products
 * are fetched. Reserves the heading and the first rows so the list does not
 * push the page down once it paints.
 */
export function FavoritesSkeleton({ title }: { title?: string }) {
  return (
    <div
      className="min-h-screen bg-surface-secondary"
      role="status"
      aria-busy="true"
      aria-label={title ?? 'Loading favorites'}
    >
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
        <div className="lg:max-w-[640px]">
          <SavedLineRowsSkeleton rows={3} />
        </div>
      </div>
    </div>
  )
}
