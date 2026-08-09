'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { HeartIcon } from '@heroicons/react/24/outline'
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid'
import { useFavorites } from '@/app/hooks/useFavorites'
import { productService, Product } from '@/lib/firebase'
import { parseFavoriteKey } from '@/lib/favorites'
import ProductCard from '@/app/components/ProductCard'

interface FavoriteItem extends Product {
  favoriteKey: string
  favoriteBaseSku: string
  favoriteColorSlug?: string
}

const translations = {
  en: {
    pageTitle: 'My Favorites',
    loading: 'Loading...',
    emptyTitle: 'No favorites yet',
    emptyDescription: 'Start adding products to your favorites to see them here.',
    browseProducts: 'Browse Products',
    totalItems: 'items'
  },
  he: {
    pageTitle: 'המועדפים שלי',
    loading: 'טוען...',
    emptyTitle: 'אין מועדפים עדיין',
    emptyDescription: 'התחל להוסיף מוצרים למועדפים שלך כדי לראות אותם כאן.',
    browseProducts: 'עיין במוצרים',
    totalItems: 'פריטים'
  }
} as const

export default function ProfileFavoritesPage() {
  const params = useParams()
  const lng = (params?.lng as string) || 'en'
  const t = (translations as any)[lng] || translations.en
  const isRTL = lng === 'he'

  const { favorites: favoriteKeys, toggleFavorite, loading: favoritesLoading } = useFavorites()
  const [favorites, setFavorites] = useState<FavoriteItem[]>([])
  const [loading, setLoading] = useState(true)
  const [isClient, setIsClient] = useState(false)
  
  // Prevent repeated auto-cleanup calls across re-renders
  const cleanedFavoriteKeysRef = useRef<Set<string>>(new Set())

  const isProductStorefrontActive = (product: any): boolean => {
    if (!product) return false
    if (typeof product.isDeleted === 'boolean' && product.isDeleted) return false
    if (typeof product.isEnabled === 'boolean') return product.isEnabled
    // Legacy fallback
    if (typeof product.isActive === 'boolean') return product.isActive
    return true
  }

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (!isClient) return
    if (favoritesLoading) {
      setLoading(true)
      return
    }

    // Cancellation flag to prevent race conditions
    let cancelled = false

    const loadFavorites = async () => {
      try {
        setLoading(true)

        if (!favoriteKeys || favoriteKeys.length === 0) {
          if (!cancelled) setFavorites([])
          return
        }

        // Cache by baseSku to avoid refetching the same product for multiple colors
        const productCache = new Map<string, Product | null>()
        const favoriteItems: FavoriteItem[] = []
        const inactiveFavoriteKeysToRemove: string[] = []

        for (const favoriteKey of favoriteKeys) {
          // Early exit if this effect has been cancelled
          if (cancelled) return

          const { baseSku, colorSlug } = parseFavoriteKey(favoriteKey)
          if (!baseSku) continue

          let product = productCache.get(baseSku)
          if (product === undefined) {
            try {
              // Get product directly (color variants are already in the document)
              product = await productService.getProductByBaseSku(baseSku)

              // If not found, try legacy method (using sku field)
              if (!product) {
                product = await productService.getProductBySku(baseSku)
              }
            } catch (error) {
              console.error(`Error fetching product ${baseSku}:`, error)
              product = null
            }

            productCache.set(baseSku, product)
          }

          if (product && isProductStorefrontActive(product)) {
            favoriteItems.push({
              ...product,
              favoriteKey,
              favoriteBaseSku: baseSku,
              favoriteColorSlug: colorSlug || undefined
            })
          } else {
            // Product is missing or inactive/deleted -> don't show it in favorites,
            // and auto-remove it so it won't come back on refresh
            inactiveFavoriteKeysToRemove.push(favoriteKey)
          }
        }

        // Only update state if not cancelled
        if (!cancelled) {
          setFavorites(favoriteItems)
        }

        // Best-effort cleanup (avoid loops by tracking keys we've already cleaned)
        const uniqueToRemove = Array.from(new Set(inactiveFavoriteKeysToRemove))
          .filter((k) => k && !cleanedFavoriteKeysRef.current.has(k))
        if (uniqueToRemove.length > 0 && !cancelled) {
          uniqueToRemove.forEach((k) => cleanedFavoriteKeysRef.current.add(k))
          await Promise.all(
            uniqueToRemove.map(async (k) => {
              try {
                await toggleFavorite(k)
              } catch {
                // ignore cleanup failures (UI is already filtered)
              }
            })
          )
        }
      } catch (error) {
        console.error('[ProfileFavoritesPage] Error loading favorites:', error)
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadFavorites()

    // Cleanup function to cancel ongoing operations
    return () => {
      cancelled = true
    }
  }, [isClient, favoritesLoading, favoriteKeys])

  // Show loading state
  if (!isClient || loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#856D55] mx-auto"></div>
          <p className="mt-4 text-gray-600">{t.loading}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="pt-6 pb-20 md:pb-6 mt-4" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-3">
          <HeartSolidIcon className="h-7 w-7 md:h-8 md:w-8 text-red-500" />
          {t.pageTitle}
        </h1>
        {favorites.length > 0 && (
          <p className="text-gray-600 mt-3 text-sm md:text-base">
            {favorites.length} {t.totalItems}
          </p>
        )}
      </div>

      {/* Favorites Grid */}
      {favorites.length === 0 ? (
        /* Empty State */
        <div className="bg-white rounded-xl shadow-sm p-8 md:p-12 text-center">
          <HeartIcon className="h-14 w-14 md:h-16 md:w-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-2">
            {t.emptyTitle}
          </h2>
          <p className="text-sm md:text-base text-gray-600 mb-6 max-w-md mx-auto">
            {t.emptyDescription}
          </p>
          <Link
            href={`/${lng}`}
            className="inline-flex items-center px-5 py-2.5 md:px-6 md:py-3 border border-transparent text-sm md:text-base font-medium rounded-md text-white bg-[#856D55] hover:bg-[#856D55]/90 transition-colors"
          >
            {t.browseProducts}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4 lg:gap-5">
          {favorites.map((product) => {
            // Pass selectedColors to prioritize the favorited color
            const selectedColors = product.favoriteColorSlug ? [product.favoriteColorSlug] : undefined
            
            return (
              <ProductCard
                key={product.favoriteKey}
                product={product}
                language={lng as 'en' | 'he'}
                selectedColors={selectedColors}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

