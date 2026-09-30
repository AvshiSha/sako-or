import { unstable_cache } from 'next/cache'

import {
  categoryService,
  getFilteredProducts,
  type Product,
  type ProductFilters,
} from '@/lib/firebase'
import { serializeFirestoreValue } from '@/lib/serialize-firestore'

/**
 * Products for the cart's "YOU MAY ALSO LIKE" rail (Figma 293:14026).
 *
 * Women's accessories rather than best sellers: the rail sits directly under a
 * cart that is almost always footwear, so an add-on is the useful suggestion
 * there - another pair of shoes is not. Belts and bags are drawn as two separate
 * category queries and interleaved, because a single query ordered by date would
 * front-load whichever category happened to be synced last and the rail would
 * read as "belts" or as "bags" rather than as accessories.
 *
 * Each category is looked up by id with a path fallback: getCategoryIdsFromPath
 * is the accurate filter, but it returns nothing while the taxonomy is mid-sync,
 * and categoryPath still matches in that window.
 */

const CART_RECOMMENDATIONS_REVALIDATE_SECONDS = 600

/** Total cards on the rail. The carousel shows ~4 at 1728px and scrolls the rest. */
const CART_RECOMMENDATIONS_LIMIT = 12

/**
 * Drawn from in order on every round of the interleave, so with enough stock the
 * rail alternates belt, bag, belt, bag. Listing belts first makes them the card
 * the rail opens on.
 */
const CART_RECOMMENDATION_CATEGORY_PATHS = [
  'women/accessories/belts',
  'women/accessories/bags',
] as const

/** Fetched per category — enough that one thin category never starves the rail. */
const PER_CATEGORY_PAGE_SIZE = CART_RECOMMENDATIONS_LIMIT

async function loadCategoryProducts(categoryPath: string): Promise<Product[]> {
  const categoryInfo = await categoryService.getCategoryIdsFromPath(categoryPath, 'en')
  const filters: ProductFilters = categoryInfo?.categoryIds?.length
    ? { categoryIds: categoryInfo.categoryIds }
    : { categoryPath }

  const result = await getFilteredProducts(filters, 'newest', {
    page: 1,
    pageSize: PER_CATEGORY_PAGE_SIZE,
  })

  return (result.products ?? []).map((product) => serializeFirestoreValue(product))
}

/**
 * Round-robin across the lists, skipping any that run out, so a short belt
 * catalogue is topped up with bags instead of leaving the rail half empty.
 */
function interleave(lists: Product[][], limit: number): Product[] {
  const merged: Product[] = []
  const seen = new Set<string>()
  const depth = Math.max(0, ...lists.map((list) => list.length))

  for (let index = 0; index < depth && merged.length < limit; index++) {
    for (const list of lists) {
      if (merged.length >= limit) break
      const product = list[index]
      if (!product) continue

      const key = product.sku || product.id
      if (!key || seen.has(key)) continue

      seen.add(key)
      merged.push(product)
    }
  }

  return merged
}

async function loadCartRecommendations(): Promise<Product[]> {
  // settled, not all: a failed or empty category must not take the whole rail
  // down with it - the other one is still a perfectly good suggestion.
  const results = await Promise.allSettled(
    CART_RECOMMENDATION_CATEGORY_PATHS.map((path) => loadCategoryProducts(path))
  )

  const lists = results.map((result, index) => {
    if (result.status === 'fulfilled') return result.value
    console.warn(
      `[CART_RECOMMENDATIONS] ${CART_RECOMMENDATION_CATEGORY_PATHS[index]} failed:`,
      result.reason
    )
    return []
  })

  return interleave(lists, CART_RECOMMENDATIONS_LIMIT)
}

const getCachedCartRecommendations = unstable_cache(
  loadCartRecommendations,
  ['cart-recommendations-women-accessories'],
  { revalidate: CART_RECOMMENDATIONS_REVALIDATE_SECONDS }
)

export async function fetchCartRecommendations(): Promise<Product[]> {
  return getCachedCartRecommendations()
}
