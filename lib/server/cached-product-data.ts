import 'server-only'

import { cache } from 'react'
import { productService } from '@/lib/firebase'

/**
 * Per-request dedup for product-by-baseSku lookups. The product PDP route
 * fetches the same baseSku independently in generateMetadata, the layout
 * (structured data/LCP preload), and the page component — React.cache()
 * collapses those into a single Firestore read per request.
 */
export const getCachedProductByBaseSku = cache(async (baseSku: string) => {
  return productService.getProductByBaseSku(baseSku)
})
