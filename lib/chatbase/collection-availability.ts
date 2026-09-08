import { getCollectionProducts } from '@/lib/firebase'
import {
  buildCollectionUrl,
  type ChatbaseGender,
  type CollectionCategory,
} from '@/lib/chatbase/collection-catalog'

export type AvailabilitySource = 'regular' | 'outlet' | 'none'

export type CheckedCollection = {
  source: 'regular' | 'outlet'
  categoryPath: string
  productCount: number
  url: string
}

export type CollectionAvailability = {
  /** True only when a collection page with these filters has something on it. */
  available: boolean
  source: AvailabilitySource
  /**
   * Number of cards the collection page renders, which is one per matching
   * colour variant - not one per product. That is what the customer counts.
   */
  productCount: number
  /** Canonical URL to send, or null when nothing matched anywhere. */
  url: string | null
  gender: ChatbaseGender
  category: string
  locale: string
  filters: { colors: string[]; sizes: string[] }
  /** Every collection consulted, in order, so a wrong link is auditable. */
  checked: CheckedCollection[]
  /**
   * Colours and sizes that exist in the collections consulted, ignoring the
   * requested colour/size. On a zero result these are the recovery options -
   * "no white pumps, but we have nude and off-white" instead of a dead end.
   */
  availableColors: string[]
  availableSizes: string[]
}

export type AvailabilityInput = {
  category: CollectionCategory
  gender: ChatbaseGender
  locale: string
  colors: string[]
  sizes: string[]
}

function sortSizes(sizes: string[]): string[] {
  return [...sizes].sort((a, b) => {
    const aNum = parseFloat(a)
    const bNum = parseFloat(b)
    if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) return aNum - bNum
    return a.localeCompare(b)
  })
}

/**
 * Count what the collection page would show, by calling the exact function the
 * page itself calls. `total` is the full match count across the collection, not
 * just the first page, so one call answers "is this page empty".
 */
async function countCollection(
  categoryPath: string,
  locale: string,
  colors: string[],
  sizes: string[]
): Promise<{ productCount: number; colors: string[]; sizes: string[] }> {
  const searchParams: Record<string, string> = {}
  if (colors.length > 0) searchParams.colors = colors.join(',')
  if (sizes.length > 0) searchParams.sizes = sizes.join(',')

  const result = await getCollectionProducts(
    categoryPath,
    searchParams,
    locale === 'he' ? 'he' : 'en'
  )

  return {
    productCount: result.total ?? 0,
    // Facets are collected with the colour and size filters removed, so they
    // describe the whole collection even when the filtered count is zero.
    colors: result.availableFilterOptions?.colors ?? [],
    sizes: result.availableFilterOptions?.sizes ?? [],
  }
}

/**
 * Regular collection first, outlet second, nothing third.
 *
 * Stops at the first collection that has products, so a healthy regular
 * category costs exactly one scan. A disabled regular category is skipped
 * outright, and a gender with no outlet section (men) simply has one target.
 */
export async function checkCollectionAvailability(
  input: AvailabilityInput
): Promise<CollectionAvailability> {
  const { category, gender, locale, colors, sizes } = input

  const targets: Array<{ source: 'regular' | 'outlet'; categoryPath: string }> = []
  if (category.regularPath && category.regularEnabled) {
    targets.push({ source: 'regular', categoryPath: category.regularPath })
  }
  if (category.outletPath) {
    targets.push({ source: 'outlet', categoryPath: category.outletPath })
  }

  const checked: CheckedCollection[] = []
  const colorOptions = new Set<string>()
  const sizeOptions = new Set<string>()

  for (const target of targets) {
    const counted = await countCollection(target.categoryPath, locale, colors, sizes)
    counted.colors.forEach((color) => colorOptions.add(color))
    counted.sizes.forEach((size) => sizeOptions.add(size))

    const url = buildCollectionUrl(locale, target.categoryPath, { colors, sizes })
    checked.push({
      source: target.source,
      categoryPath: target.categoryPath,
      productCount: counted.productCount,
      url,
    })

    if (counted.productCount > 0) {
      return {
        available: true,
        source: target.source,
        productCount: counted.productCount,
        url,
        gender,
        category: category.key,
        locale,
        filters: { colors, sizes },
        checked,
        availableColors: [...colorOptions].sort(),
        availableSizes: sortSizes([...sizeOptions]),
      }
    }
  }

  return {
    available: false,
    source: 'none',
    productCount: 0,
    url: null,
    gender,
    category: category.key,
    locale,
    filters: { colors, sizes },
    checked,
    availableColors: [...colorOptions].sort(),
    availableSizes: sortSizes([...sizeOptions]),
  }
}
