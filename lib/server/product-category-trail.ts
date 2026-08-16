import 'server-only'

import { getCachedCategoryById } from '@/lib/server/cached-category-data'
import type { Product } from '@/lib/product-types'

export type CategoryCrumb = { name: string; path: string }

/**
 * The product's category trail, root-first and localised, e.g.
 * [נשים, אקססוריז, תיקים] with each carrying its full collection path.
 *
 * Feeds three things. The deepest name gives the page title a keyword worth
 * ranking for — the stored product title is the brand ("IL BORGO FIRENZE",
 * "SAKO BAGS"), which nobody searches. The full trail becomes the breadcrumb,
 * which is how a product page stops being orphaned from the collection tree it
 * belongs to. And it is what the product page shows as "Category", instead of
 * the untranslated root slug (`women`) it used to print.
 *
 * Best-effort throughout: a product with no category path still renders, just
 * without a leading keyword and without breadcrumbs.
 *
 * Lives here rather than in the product layout because the layout (JSON-LD,
 * breadcrumbs) and the page (visible category line) both need the same trail,
 * and two copies would be free to disagree.
 */
export async function resolveCategoryTrail(
  product: Pick<Product, 'categories_path_id'>,
  locale: 'en' | 'he'
): Promise<CategoryCrumb[]> {
  const categoryIds = product.categories_path_id
  if (!Array.isArray(categoryIds) || categoryIds.length === 0) return []

  try {
    const categories = await Promise.all(
      categoryIds.map((id) => getCachedCategoryById(id).catch(() => null))
    )
    return categories.flatMap((category) => {
      const resolved = category as { name?: Record<string, string>; path?: string } | null
      const name = resolved?.name?.[locale] || resolved?.name?.en
      const path = resolved?.path
      return name && path ? [{ name, path }] : []
    })
  } catch (error) {
    console.error('Error resolving category trail for product:', error)
    return []
  }
}

/** The deepest (most specific) category name, e.g. "תיקים" — the part worth
 * putting in a title. Undefined when the trail couldn't be resolved. */
export function deepestCategoryName(trail: CategoryCrumb[]): string | undefined {
  return trail.length > 0 ? trail[trail.length - 1].name : undefined
}
