import 'server-only'

import { cache } from 'react'
import { categoryService } from '@/lib/firebase'

/**
 * Per-request dedup for category lookups. The collection route resolves the
 * same category path/id independently in generateMetadata and the page
 * component — React.cache() collapses those into a single Firestore read
 * per request.
 */
export const getCachedCategoryIdsFromPath = cache(
  async (categoryPath: string, language: 'en' | 'he' = 'en') => {
    return categoryService.getCategoryIdsFromPath(categoryPath, language)
  }
)

export const getCachedCategoryById = cache(async (categoryId: string) => {
  return categoryService.getCategoryById(categoryId)
})
