import { normalizeSizeKey } from '@/lib/product-size'
import { heelHeightCm, isUndefinedFitValue } from '@/lib/chatbase/product-api-enums'
import type { ProductCandidate } from '@/lib/chatbase/product-query'
import type { ProductVariant } from '@/lib/chatbase/product-availability'

/**
 * Deterministic relevance scoring.
 *
 * The important thing to understand first: every filter in this API is a hard
 * AND. By the time a product is scored it already satisfies every requirement
 * the customer stated, and anything unavailable has already been removed. The
 * score therefore answers "how well", never "whether" - it only decides the
 * order of results that are all valid answers.
 *
 * Components are weighted out of 100 and normalised over the components that
 * actually apply to the request, so a search with two filters and a search with
 * eight both produce comparable scores.
 *
 * Merchandising - featured, new, recency - is deliberately NOT part of the
 * score. It is a separate tie-break applied only between products with an equal
 * score, which is what makes it structurally impossible for a promoted shoe to
 * outrank a better-fitting one.
 */

export const SCORE_WEIGHTS = {
  /** How much of what was asked for is actually in stock on the matched variant. */
  inventoryDepth: 40,
  /** How close the payable price sits to the cheap end of the requested range. */
  priceFit: 15,
  /** Whether the fit values accommodate broadly or narrowly. */
  fitConfidence: 20,
  /** Exactly the category asked for, rather than a related one. */
  categoryMatch: 15,
  /** How completely the product is specified - a documented shoe is a safer recommendation. */
  specCompleteness: 10,
} as const

export type ScoreComponent = keyof typeof SCORE_WEIGHTS

/**
 * Fit values that suit more feet rather than fewer. When a customer has told us
 * about their foot, a shoe declared to suit most widths is objectively a better
 * answer than one declared merely regular-to-wide, even though both passed the
 * filter.
 */
const ACCOMMODATING_FIT_VALUES = new Set([
  'most_widths',
  'adjustable',
  'most_arch_types',
  'true_to_size',
])

const SPEC_COMPLETENESS_FIELDS = [
  'lining',
  'insole',
  'outsole',
  'soleType',
  'toeShape',
  'heelType',
  'closureType',
  'heelHeight',
  'sizeFit',
  'footWidthFit',
  'archFit',
] as const

export type ScoreInput = {
  candidate: ProductCandidate
  variant: ProductVariant
  requestedSizes: string[]
  requestedCategories: string[]
  minPrice?: number
  maxPrice?: number
  /** True when the request carried any fit filter, making fit confidence relevant. */
  fitRequested: boolean
  price: number
}

function inventoryDepth(variant: ProductVariant, requestedSizes: string[]): number {
  const stock = variant.stockBySize || {}
  const inStock = new Set(
    Object.entries(stock)
      .filter(([, qty]) => typeof qty === 'number' && qty > 0)
      .map(([size]) => normalizeSizeKey(size))
  )
  if (requestedSizes.length === 0) {
    // No size asked for: having any stock at all is full marks, and a variant
    // with none never reaches scoring.
    return inStock.size > 0 ? 1 : 0
  }
  const matched = requestedSizes.filter((size) => inStock.has(normalizeSizeKey(size)))
  return matched.length / requestedSizes.length
}

function priceFit(price: number, minPrice?: number, maxPrice?: number): number {
  if (maxPrice === undefined) return 1
  const floor = minPrice ?? 0
  if (maxPrice <= floor) return 1
  // Cheaper within the stated range scores higher: the customer named a ceiling,
  // so distance below it is value to them.
  const position = (price - floor) / (maxPrice - floor)
  return Math.min(1, Math.max(0, 1 - position))
}

function fitConfidence(candidate: ProductCandidate): number {
  const values = [candidate.footWidthFit, candidate.archFit, candidate.sizeFit]
  const known = values.filter((value) => !isUndefinedFitValue(value))
  if (known.length === 0) return 0
  const accommodating = known.filter((value) => ACCOMMODATING_FIT_VALUES.has(value!)).length
  return accommodating / known.length
}

function categoryMatch(candidate: ProductCandidate, requestedCategories: string[]): number {
  if (requestedCategories.length === 0) return 1
  const leaf = candidate.categories_path[candidate.categories_path.length - 1] ?? ''
  const key = leaf.startsWith('outlet-') ? leaf.slice('outlet-'.length) : leaf
  return requestedCategories.includes(key) ? 1 : 0
}

function specCompleteness(candidate: ProductCandidate): number {
  const filled = SPEC_COMPLETENESS_FIELDS.filter((field) => {
    const value = candidate[field] as string | null
    return !isUndefinedFitValue(value)
  }).length
  const materials = candidate.upperMaterial?.length ? 1 : 0
  return (filled + materials) / (SPEC_COMPLETENESS_FIELDS.length + 1)
}

export type ScoreResult = {
  /** 0-100, normalised over the components that applied to this request. */
  score: number
  /** Ordering tie-break only; never folded into `score`. */
  merchandisingRank: number
}

export function scoreSearchMatch(input: ScoreInput): ScoreResult {
  const { candidate, variant, requestedSizes, requestedCategories, price } = input

  // A component counts towards the total only when the request made it relevant.
  const components: Array<{ key: ScoreComponent; value: number; applies: boolean }> = [
    {
      key: 'inventoryDepth',
      value: inventoryDepth(variant, requestedSizes),
      applies: true,
    },
    {
      key: 'priceFit',
      value: priceFit(price, input.minPrice, input.maxPrice),
      applies: input.maxPrice !== undefined,
    },
    {
      key: 'fitConfidence',
      value: fitConfidence(candidate),
      applies: input.fitRequested,
    },
    {
      key: 'categoryMatch',
      value: categoryMatch(candidate, requestedCategories),
      applies: requestedCategories.length > 0,
    },
    {
      key: 'specCompleteness',
      value: specCompleteness(candidate),
      applies: true,
    },
  ]

  let earned = 0
  let total = 0
  for (const component of components) {
    if (!component.applies) continue
    const weight = SCORE_WEIGHTS[component.key]
    total += weight
    earned += weight * component.value
  }

  const score = total === 0 ? 100 : Math.round((earned / total) * 100)

  return { score, merchandisingRank: merchandisingRank(candidate) }
}

/**
 * How close an alternative is to a source product.
 *
 * Weighted towards what a customer actually notices about a shoe - what type it
 * is, how high the heel is, what shape the toe is - rather than what is easiest
 * to compare. Like the search score, this only ORDERS: the customer's stated
 * requirements are hard filters applied before anything is scored, so a closer
 * lookalike can never displace a shoe that actually fits.
 */
export const SIMILARITY_WEIGHTS = {
  category: 30,
  heelHeight: 20,
  heelType: 12,
  soleType: 8,
  toeShape: 10,
  closureType: 5,
  upperMaterial: 10,
  priceProximity: 5,
} as const

/** Comparable specification pairs, with the label used in `differences`. */
const COMPARED_SPECS = [
  ['heelType', 'heelTypes'],
  ['soleType', 'soleTypes'],
  ['toeShape', 'toeShapes'],
  ['closureType', 'closureTypes'],
] as const

export type SimilarityInput = {
  source: ProductCandidate
  sourcePrice: number
  candidate: ProductCandidate
  candidatePrice: number
}

export type SimilarityResult = {
  /** 0-100. */
  score: number
  /** Stored keys that matched, for building localised reasons. */
  matched: string[]
  /** Stored keys that differ, for building localised differences. */
  differing: string[]
  merchandisingRank: number
}

function categoryKey(candidate: ProductCandidate): string {
  const leaf = candidate.categories_path[candidate.categories_path.length - 1] ?? ''
  return leaf.startsWith('outlet-') ? leaf.slice('outlet-'.length) : leaf
}

export function scoreSimilarity(input: SimilarityInput): SimilarityResult {
  const { source, candidate, sourcePrice, candidatePrice } = input
  const matched: string[] = []
  const differing: string[] = []
  let earned = 0
  let total = 0

  const award = (weight: number, value: number, applies: boolean) => {
    if (!applies) return
    total += weight
    earned += weight * value
  }

  const sameCategory = categoryKey(source) === categoryKey(candidate)
  award(SIMILARITY_WEIGHTS.category, sameCategory ? 1 : 0, true)
  if (sameCategory) matched.push('category')
  else differing.push('category')

  // Heel height is the difference a customer feels most, so proximity counts
  // rather than equality: 5 cm against 6 cm is close, against 10 cm is not.
  const sourceHeel = heelHeightCm(source.heelHeight)
  const candidateHeel = heelHeightCm(candidate.heelHeight)
  if (sourceHeel !== null && candidateHeel !== null) {
    const distance = Math.abs(sourceHeel - candidateHeel)
    award(SIMILARITY_WEIGHTS.heelHeight, Math.max(0, 1 - distance / 6), true)
    if (distance <= 1) matched.push('heelHeight')
    else differing.push('heelHeight')
  }

  for (const [field, labelKey] of COMPARED_SPECS) {
    const sourceValue = source[field]
    const candidateValue = candidate[field]
    // An unknown value on either side is not evidence of similarity, so it is
    // left out of the total rather than scored as a mismatch.
    if (isUndefinedFitValue(sourceValue) || isUndefinedFitValue(candidateValue)) continue
    const same = sourceValue === candidateValue
    award(SIMILARITY_WEIGHTS[field as keyof typeof SIMILARITY_WEIGHTS] ?? 0, same ? 1 : 0, true)
    if (same) matched.push(labelKey)
    else differing.push(labelKey)
  }

  const sourceMaterials = source.upperMaterial ?? []
  const candidateMaterials = candidate.upperMaterial ?? []
  if (sourceMaterials.length > 0 && candidateMaterials.length > 0) {
    const shared = candidateMaterials.filter((material) => sourceMaterials.includes(material))
    award(SIMILARITY_WEIGHTS.upperMaterial, shared.length > 0 ? 1 : 0, true)
    if (shared.length > 0) matched.push('upperMaterials')
    else differing.push('upperMaterials')
  }

  if (sourcePrice > 0) {
    const distance = Math.abs(candidatePrice - sourcePrice) / sourcePrice
    award(SIMILARITY_WEIGHTS.priceProximity, Math.max(0, 1 - distance), true)
  }

  return {
    score: total === 0 ? 0 : Math.round((earned / total) * 100),
    matched,
    differing,
    merchandisingRank: merchandisingRank(candidate),
  }
}

/** 0-2. Featured and new are worth one point each; nothing else promotes. */
export function merchandisingRank(candidate: ProductCandidate): number {
  return (candidate.featured ? 1 : 0) + (candidate.isNew ? 1 : 0)
}

export type ScoredItem<T> = {
  item: T
  sku: string
  createdAt: Date
  score: number
  merchandisingRank: number
}

/**
 * Score first, merchandising second, newest third, SKU last. The final SKU
 * comparison makes the order total, so the same request always returns the same
 * list in the same order.
 */
export function compareScored<T>(a: ScoredItem<T>, b: ScoredItem<T>): number {
  if (a.score !== b.score) return b.score - a.score
  if (a.merchandisingRank !== b.merchandisingRank) return b.merchandisingRank - a.merchandisingRank
  const timeDiff = b.createdAt.getTime() - a.createdAt.getTime()
  if (timeDiff !== 0) return timeDiff
  return a.sku.localeCompare(b.sku)
}
