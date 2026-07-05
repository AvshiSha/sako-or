import { getFilteredProducts, type Product, type RelatedProductsCarouselConfig } from '@/lib/firebase'
import { serializeFirestoreValue } from '@/lib/serialize-firestore'

const CANDIDATE_POOL_SIZE = 50
const DEFAULT_MAX_PRODUCTS = 8

function shuffle<T>(items: T[]): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

/**
 * Resolves the products for a blog article's Related Products Carousel.
 * Only 'random' selection is implemented today; other modes fall back to the
 * newest-first pool until they're built out (see RelatedProductsSelectionMode).
 */
export async function fetchRelatedProductsForArticle(
  config: RelatedProductsCarouselConfig | undefined
): Promise<Product[]> {
  if (!config?.enabled || config.categoryIds.length === 0) return []

  const { products } = await getFilteredProducts(
    { categoryIds: config.categoryIds },
    'newest',
    { page: 1, pageSize: CANDIDATE_POOL_SIZE }
  )
  if (products.length === 0) return []

  const maxProducts = config.maxProducts > 0 ? config.maxProducts : DEFAULT_MAX_PRODUCTS
  const selected = config.mode === 'random' ? shuffle(products).slice(0, maxProducts) : products.slice(0, maxProducts)

  return selected.map((product) => serializeFirestoreValue(product))
}
