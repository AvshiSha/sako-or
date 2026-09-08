import { buildAbsoluteUrl } from '@/lib/seo'
import { getColorName } from '@/lib/colors'
import { getBaseSku } from '@/lib/sku-parser'
import { normalizeProductImages } from '@/lib/product-images'
import type { Product } from '@/lib/product-types'
import {
  heelHeightCm,
  isUndefinedFitValue,
  labelFor,
  labelsFor,
} from '@/lib/chatbase/product-api-enums'
import {
  availableSizesForColor,
  resolveVariantPricing,
  type ProductVariant,
} from '@/lib/chatbase/product-availability'
import { categoryKeyForPath, isOutletPath } from '@/lib/chatbase/product-scope'
import type { ProductCandidate } from '@/lib/chatbase/product-query'

/**
 * Turns an internal product + confirmed variant into the JSON Chatbase sees.
 *
 * Two sources, on purpose:
 *  - Specifications come from the Postgres candidate row, the same row the SQL
 *    filter matched on, so what is returned can never disagree with what was
 *    filtered.
 *  - Price, stock, images and the variant URL come from Firestore, the
 *    authority the storefront reads.
 *
 * Everything not fit to leave the building is dropped here: Firestore document
 * ids, category ids, empty strings, nulls, and the `'undefined'` sentinel that
 * means "nobody filled this in". Stock quantities are never included - only
 * which sizes exist.
 */

export type PublicColor = {
  value: string
  label: string
}

export type PublicSpecifications = Partial<{
  upperMaterial: string[]
  liningMaterial: string
  insoleMaterial: string
  outsoleMaterial: string
  soleType: string
  heelHeightCm: number
  heelType: string
  closureType: string
  toeShape: string
  sizeFit: string
  footWidthFit: string
  archFit: string
  adjustableFeatures: string[]
}>

export type PublicProduct = {
  /** Public identifier: SKU and colour, the two parts already in the page URL. */
  productId: string
  sku: string
  title: string
  category: string
  isOutlet: boolean
  color: PublicColor
  availableSizes: string[]
  price: number
  originalPrice: number | null
  currency: string
  url: string
  imageUrl: string | null
  specifications: PublicSpecifications
  matchScore?: number
  matchReasons: string[]
  differences?: string[]
  warnings: string[]
}

/** Drops null, undefined, '' and the `'undefined'` sentinel. */
function clean<T>(value: T | null | undefined): T | undefined {
  if (value === null || value === undefined) return undefined
  if (typeof value === 'string' && (value === '' || isUndefinedFitValue(value))) return undefined
  return value
}

function cleanList(values: readonly string[] | null | undefined): string[] | undefined {
  if (!values?.length) return undefined
  const kept = values.filter((value) => clean(value) !== undefined)
  return kept.length > 0 ? kept : undefined
}

/** Only defined keys survive, so a missing spec is absent rather than null. */
export function buildSpecifications(candidate: ProductCandidate): PublicSpecifications {
  const specs: PublicSpecifications = {}
  const set = <K extends keyof PublicSpecifications>(
    key: K,
    value: PublicSpecifications[K] | undefined
  ) => {
    if (value !== undefined) specs[key] = value
  }

  set('upperMaterial', cleanList(candidate.upperMaterial))
  set('liningMaterial', clean(candidate.lining))
  set('insoleMaterial', clean(candidate.insole))
  set('outsoleMaterial', clean(candidate.outsole))
  set('soleType', clean(candidate.soleType))
  set('heelType', clean(candidate.heelType))
  set('closureType', clean(candidate.closureType))
  set('toeShape', clean(candidate.toeShape))
  set('sizeFit', clean(candidate.sizeFit))
  set('footWidthFit', clean(candidate.footWidthFit))
  set('archFit', clean(candidate.archFit))
  set('adjustableFeatures', cleanList(candidate.adjustableFeatures))

  const heel = heelHeightCm(clean(candidate.heelHeight))
  if (heel !== null) specs.heelHeightCm = heel

  return specs
}

/**
 * Display title.
 *
 * `title_he`/`title_en` hold the brand ("SAKO SANDALS 3516"), not a product
 * name, so they are never used alone. `shortTitle_*` is the real name and is
 * set on almost every product; the category name is the fallback, and the brand
 * is the last resort.
 */
export function buildTitle(
  candidate: ProductCandidate,
  locale: 'en' | 'he'
): string {
  const shortTitle = locale === 'he' ? candidate.shortTitle_he : candidate.shortTitle_en
  const cleaned = clean(shortTitle?.trim())
  if (cleaned) return cleaned

  const categoryName =
    locale === 'he' ? clean(candidate.subSubCategory_he) : clean(candidate.subSubCategory_en)
  const brand = clean((locale === 'he' ? candidate.title_he : candidate.title_en)?.trim())

  return [categoryName, brand].filter(Boolean).join(' – ') || brand || candidate.sku
}

export function buildProductUrl(sku: string, colorSlug: string, locale: string): string {
  return buildAbsoluteUrl(`/${locale}/product/${getBaseSku(sku)}/${colorSlug}`)
}

/** The image belonging to this colour variant, never the product's first image. */
export function buildVariantImageUrl(variant: ProductVariant): string | null {
  if (variant.primaryImage) return variant.primaryImage
  const images = normalizeProductImages(variant.images, variant.imageDetails)
  return images[0]?.url ?? null
}

export function buildColor(colorSlug: string, locale: 'en' | 'he'): PublicColor {
  return { value: colorSlug, label: getColorName(colorSlug, locale) }
}

export type PresentOptions = {
  candidate: ProductCandidate
  product: Product
  variant: ProductVariant
  locale: 'en' | 'he'
  /** Restricts availableSizes to what the customer asked for, when they asked. */
  requestedSizes?: string[]
  matchScore?: number
  matchReasons?: string[]
  differences?: string[]
  warnings?: string[]
}

export function presentProduct(options: PresentOptions): PublicProduct {
  const { candidate, product, variant, locale } = options
  const colorSlug = variant.colorSlug
  const { price, originalPrice } = resolveVariantPricing(product, variant)

  const sizes = availableSizesForColor(product, colorSlug)
  const requested = options.requestedSizes?.length ? new Set(options.requestedSizes) : null
  const availableSizes = requested ? sizes.filter((size) => requested.has(size)) : sizes

  return {
    productId: `${candidate.sku}:${colorSlug}`,
    sku: candidate.sku,
    title: buildTitle(candidate, locale),
    category: categoryKeyForPath(candidate.categories_path) ?? '',
    isOutlet: isOutletPath(candidate.categories_path),
    color: buildColor(colorSlug, locale),
    availableSizes,
    price,
    originalPrice,
    currency: product.currency || 'ILS',
    url: buildProductUrl(candidate.sku, colorSlug, locale),
    imageUrl: buildVariantImageUrl(variant),
    specifications: buildSpecifications(candidate),
    ...(options.matchScore === undefined ? {} : { matchScore: options.matchScore }),
    matchReasons: options.matchReasons ?? [],
    ...(options.differences ? { differences: options.differences } : {}),
    warnings: options.warnings ?? [],
  }
}

/**
 * Localised one-line reasons the product matched. Built from stored enum labels
 * so nothing is fabricated: a spec with no translation contributes no reason
 * rather than an English string in a Hebrew reply.
 */
export function buildMatchReasons(options: {
  candidate: ProductCandidate
  color: PublicColor
  matchedSizes: string[]
  locale: 'en' | 'he'
  price: number
}): string[] {
  const { candidate, color, matchedSizes, locale, price } = options
  const he = locale === 'he'
  const reasons: string[] = []

  if (matchedSizes.length > 0) {
    reasons.push(
      he
        ? `זמין בצבע ${color.label} במידה ${matchedSizes.join(', ')}`
        : `Available in ${color.label} in size ${matchedSizes.join(', ')}`
    )
  } else {
    reasons.push(he ? `זמין בצבע ${color.label}` : `Available in ${color.label}`)
  }

  const width = labelFor('footWidthFits', candidate.footWidthFit, locale)
  if (width) reasons.push(width)

  const arch = labelFor('archFits', candidate.archFit, locale)
  if (arch) reasons.push(arch)

  const heel = heelHeightCm(clean(candidate.heelHeight))
  const heelType = labelFor('heelTypes', candidate.heelType, locale)
  if (heel !== null && heelType) {
    reasons.push(he ? `${heelType}, ${heel} ס"מ` : `${heelType}, ${heel} cm`)
  } else if (heel !== null) {
    reasons.push(he ? `גובה עקב ${heel} ס"מ` : `${heel} cm heel`)
  } else if (heelType) {
    reasons.push(heelType)
  }

  const materials = labelsFor('upperMaterials', candidate.upperMaterial, locale)
  if (materials) reasons.push(materials)

  reasons.push(he ? `מחיר: ₪${price}` : `Price: ₪${price}`)

  return reasons
}
