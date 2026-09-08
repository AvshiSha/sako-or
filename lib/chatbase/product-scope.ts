import {
  COLLECTION_CATEGORIES,
  resolveCategory,
  type ChatbaseGender,
  type CollectionCategory,
} from '@/lib/chatbase/collection-catalog'

/**
 * Footwear scope for the product-search API.
 *
 * Scope is decided from the real category hierarchy, never from keywords in a
 * product title. `categories_path` holds the English slugs of a product's
 * ancestors - ["women","shoes","pumps"] or ["women","outlet","outlet-pumps"] -
 * so the level-1 segment alone separates footwear from everything else:
 * `accessories` (bags, belts) is the only other level-1 section, and every
 * category under `outlet` is footwear.
 *
 * Level-1 rather than level-2 on purpose: a new shoe subcategory is in scope
 * the day it is created, without a code change, whereas a new accessory
 * subcategory stays out.
 */
export const FOOTWEAR_SECTIONS = ['shoes', 'outlet'] as const
export type FootwearSection = (typeof FOOTWEAR_SECTIONS)[number]

/** The level-1 segment, i.e. `shoes` in women/shoes/pumps. */
export function sectionOfPath(categoriesPath: readonly string[]): string | undefined {
  return categoriesPath[1]
}

export function isFootwearPath(categoriesPath: readonly string[]): boolean {
  const section = sectionOfPath(categoriesPath)
  return !!section && (FOOTWEAR_SECTIONS as readonly string[]).includes(section)
}

export function isOutletPath(categoriesPath: readonly string[]): boolean {
  return sectionOfPath(categoriesPath) === 'outlet'
}

/**
 * Category keys that are not footwear, and so are not selectable here even
 * though the collection catalogue knows about them. `accessories` covers bags
 * and belts; the bare `outlet` key is excluded because `outletOnly` expresses
 * the same intent without narrowing the product type.
 */
const NON_FOOTWEAR_KEYS = new Set(['bags', 'belts', 'accessories', 'outlet'])

function isFootwearCategory(category: CollectionCategory): boolean {
  if (NON_FOOTWEAR_KEYS.has(category.key)) return false
  const paths = [category.regularPath, category.outletPath].filter(
    (path): path is string => !!path
  )
  return paths.length > 0 && paths.every((path) => isFootwearPath(path.split('/')))
}

/** Selectable `categories` values for a gender, for schemas and error messages. */
export function footwearCategoryKeys(gender: ChatbaseGender): string[] {
  return COLLECTION_CATEGORIES.filter(
    (category) => category.gender === gender && isFootwearCategory(category)
  ).map((category) => category.key)
}

export type ResolvedCategoryScope = {
  /** Collection paths to search, regular and outlet together. */
  paths: string[]
  /** Category keys that could not be resolved for this gender. */
  unknown: string[]
}

/**
 * Turn requested category keys into the collection paths to search.
 *
 * A key expands to both its regular and its outlet path - a customer asking for
 * pumps means pumps, not "pumps except the discounted ones". A disabled regular
 * category is dropped, since the storefront never links to it. Unknown keys are
 * returned rather than ignored: silently dropping one would widen the search
 * past what the customer asked for.
 */
export function resolveCategoryScope(
  categoryKeys: readonly string[],
  gender: ChatbaseGender
): ResolvedCategoryScope {
  const paths = new Set<string>()
  const unknown: string[] = []

  for (const key of categoryKeys) {
    const category = resolveCategory(key, gender)
    if (!category || !isFootwearCategory(category)) {
      unknown.push(key)
      continue
    }
    if (category.regularPath && category.regularEnabled) paths.add(category.regularPath)
    if (category.outletPath) paths.add(category.outletPath)
  }

  return { paths: [...paths], unknown }
}

/**
 * The canonical category key for a product, derived from its path so the
 * response never leaks an internal id. Outlet and regular collapse to one key -
 * `outlet-pumps` and `pumps` are both "pumps" to a customer - and `source`
 * carries the outlet distinction separately.
 */
export function categoryKeyForPath(categoriesPath: readonly string[]): string | undefined {
  const leaf = categoriesPath[categoriesPath.length - 1]
  if (!leaf) return undefined
  return leaf.startsWith('outlet-') ? leaf.slice('outlet-'.length) : leaf
}
