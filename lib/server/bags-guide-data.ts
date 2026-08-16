import 'server-only'

import { unstable_cache } from 'next/cache'
import { categoryService, getFilteredProducts, type ProductFilters } from '@/lib/firebase'
import { serializeFirestoreValue } from '@/lib/serialize-firestore'
import { buildBagFactRows, buildMeasurementRows, type BagFactRow } from '@/lib/bag-facts'
import { resolveVariantHardwareColor } from '@/lib/product-types'
import { getColorName } from '@/lib/colors'
import type { Product } from '@/lib/product-types'

const BAGS_CATEGORY_PATH = 'women/accessories/bags'
/** Comfortably above the current bag count (tens), so the guide is complete. */
const MAX_BAGS = 200
const REVALIDATE_SECONDS = 60 * 30

export interface BagGuideColour {
  colorSlug: string
  colorName: string
  inStock: boolean
  quantity: number
  url: string
  image: string | null
}

export interface BagGuideEntry {
  sku: string
  title: string
  description: string
  price: number
  salePrice: number | null
  effectivePrice: number
  currency: string
  /** True when at least one colour of this bag can actually be bought. */
  anyInStock: boolean
  colours: BagGuideColour[]
  measurementRows: BagFactRow[]
  bagRows: BagFactRow[]
}

function variantQuantity(stockBySize: Record<string, number> | undefined): number {
  if (!stockBySize) return 0
  return Object.values(stockBySize).reduce(
    (total, quantity) => (typeof quantity === 'number' && quantity > 0 ? total + quantity : total),
    0
  )
}

function toGuideEntry(product: Product, locale: 'en' | 'he'): BagGuideEntry | null {
  const variants = Object.values(product.colorVariants || {}).filter(
    (variant) => variant && variant.isActive !== false
  )
  if (variants.length === 0) return null

  const colours: BagGuideColour[] = variants.map((variant) => {
    const quantity = variantQuantity(variant.stockBySize)
    return {
      colorSlug: variant.colorSlug,
      colorName: getColorName(variant.colorSlug, locale),
      inStock: quantity > 0,
      quantity,
      url: `/${locale}/product/${product.sku}/${variant.colorSlug}`,
      image: variant.primaryImage || variant.images?.[0] || null,
    }
  })

  // Hardware colour can differ per colour, so the guide's single spec row uses
  // the first in-stock variant's value — the one a reader is most likely to buy.
  const representativeVariant =
    variants.find((variant) => variantQuantity(variant.stockBySize) > 0) ?? variants[0]

  const salePrice = product.salePrice && product.salePrice > 0 ? product.salePrice : null

  return {
    sku: product.sku,
    title: (locale === 'he' ? product.title_he : product.title_en) || product.sku,
    description:
      (locale === 'he' ? product.shortDescription_he : product.shortDescription_en) ||
      (locale === 'he' ? product.description_he : product.description_en) ||
      '',
    price: product.price,
    salePrice,
    effectivePrice: salePrice ?? product.price,
    currency: product.currency || 'ILS',
    anyInStock: colours.some((colour) => colour.inStock),
    colours,
    measurementRows: buildMeasurementRows(product, locale),
    bagRows: buildBagFactRows(product, locale, {
      hardwareColor: resolveVariantHardwareColor(product, representativeVariant),
    }),
  }
}

async function loadBagsGuide(locale: 'en' | 'he'): Promise<BagGuideEntry[]> {
  const categoryInfo = await categoryService.getCategoryIdsFromPath(BAGS_CATEGORY_PATH, 'en')
  const filters: ProductFilters = categoryInfo?.categoryIds?.length
    ? { categoryIds: categoryInfo.categoryIds }
    : { categoryPath: BAGS_CATEGORY_PATH }

  const result = await getFilteredProducts(filters, 'newest', { page: 1, pageSize: MAX_BAGS })
  const products = serializeFirestoreValue(result.products ?? []) as Product[]

  return products
    .map((product) => toGuideEntry(product, locale))
    .filter((entry): entry is BagGuideEntry => entry !== null)
    // Buyable bags first; the guide exists to help someone choose one.
    .sort((a, b) => Number(b.anyInStock) - Number(a.anyInStock))
}

const getCachedBagsGuideHe = unstable_cache(() => loadBagsGuide('he'), ['bags-guide-he'], {
  revalidate: REVALIDATE_SECONDS,
})
const getCachedBagsGuideEn = unstable_cache(() => loadBagsGuide('en'), ['bags-guide-en'], {
  revalidate: REVALIDATE_SECONDS,
})

export function getCachedBagsGuide(locale: 'en' | 'he'): Promise<BagGuideEntry[]> {
  return locale === 'he' ? getCachedBagsGuideHe() : getCachedBagsGuideEn()
}
