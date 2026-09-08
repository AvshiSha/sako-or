import type { Product } from '@/lib/product-types'
import { normalizeSizeKey } from '@/lib/product-size'
import { getPrimaryColorSlug } from '@/lib/product-seo'
import {
  activeVariants,
  purchasableVariants,
  resolveVariantPricing,
  type ProductVariant,
} from '@/lib/chatbase/product-availability'
import { loadProductsBySkus } from '@/lib/chatbase/product-fetch'
import {
  buildColor,
  buildMatchReasons,
  presentProduct,
  type PublicProduct,
} from '@/lib/chatbase/product-presenter'
import {
  CANDIDATE_LIMIT,
  findCandidateProducts,
  type ProductCandidate,
  type ProductQueryFilters,
} from '@/lib/chatbase/product-query'
import { compareScored, scoreSearchMatch, type ScoredItem } from '@/lib/chatbase/product-scoring'
import type { ValidatedSearchRequest } from '@/lib/chatbase/search-shoes-schema'

export type RelaxationSuggestion = {
  filter: string
  message: string
}

export type SearchShoesResult = {
  /**
   * Confirmed matches among the candidates examined - not a catalogue-wide
   * count. Availability is only knowable per product, so this counts products
   * actually verified purchasable, never a cheaper SQL estimate.
   */
  totalMatches: number
  /**
   * True when the candidate scan hit its ceiling, so more matches may exist
   * beyond `totalMatches`. Lets the agent say "and more" without quoting a
   * number that would be wrong.
   */
  moreAvailable: boolean
  appliedFilters: Record<string, unknown>
  products: PublicProduct[]
  relaxationSuggestions?: RelaxationSuggestion[]
}

type Match = {
  candidate: ProductCandidate
  product: Product
  variant: ProductVariant
  price: number
  originalPrice: number | null
  matchedSizes: string[]
}

function toQueryFilters(request: ValidatedSearchRequest): ProductQueryFilters {
  return {
    gender: request.gender,
    categoryPaths: request.categoryPaths.length > 0 ? request.categoryPaths : undefined,
    colors: request.colors.length > 0 ? request.colors : undefined,
    sizes: request.sizes.length > 0 ? request.sizes : undefined,
    minPrice: request.minPrice,
    maxPrice: request.maxPrice,
    onSaleOnly: request.onSaleOnly,
    outletOnly: request.outletOnly,
    minHeelHeightCm: request.minHeelHeightCm,
    maxHeelHeightCm: request.maxHeelHeightCm,
    specs: request.specs,
    inStockOnly: request.inStockOnly,
  }
}

/**
 * Variants that satisfy the colour and size request together.
 *
 * With `inStockOnly` false the customer has asked to see products regardless of
 * stock, so only the colour constrains the variant; with it true (the default)
 * the size must be in stock on that same variant.
 */
function matchingVariants(
  product: Product,
  request: ValidatedSearchRequest
): ProductVariant[] {
  if (request.inStockOnly) {
    return purchasableVariants(product, { colors: request.colors, sizes: request.sizes })
  }
  const colors = request.colors.length > 0 ? new Set(request.colors) : null
  return activeVariants(product).filter(
    (variant) => !!variant.colorSlug && (!colors || colors.has(variant.colorSlug))
  )
}

/**
 * One result per product, not per colour.
 *
 * A product offered three times in three colours would eat a five-result budget
 * that should have shown three different shoes. The chosen variant is the one
 * that best answers the request: most of the requested sizes in stock, then the
 * product's own primary colour, then alphabetical so the choice is stable.
 */
function chooseVariant(
  product: Product,
  variants: ProductVariant[],
  requestedSizes: string[]
): ProductVariant | undefined {
  if (variants.length <= 1) return variants[0]
  const primary = getPrimaryColorSlug(product)
  const wanted = requestedSizes.map(normalizeSizeKey)

  const sizesInStock = (variant: ProductVariant): number => {
    const stock = variant.stockBySize || {}
    return wanted.filter((size) =>
      Object.entries(stock).some(
        ([key, qty]) => normalizeSizeKey(key) === size && typeof qty === 'number' && qty > 0
      )
    ).length
  }

  return [...variants].sort((a, b) => {
    const depth = sizesInStock(b) - sizesInStock(a)
    if (depth !== 0) return depth
    if (a.colorSlug === primary) return -1
    if (b.colorSlug === primary) return 1
    return a.colorSlug.localeCompare(b.colorSlug)
  })[0]
}

function sizesMatchedByVariant(variant: ProductVariant, requestedSizes: string[]): string[] {
  const stock = variant.stockBySize || {}
  return requestedSizes
    .map(normalizeSizeKey)
    .filter((size) =>
      Object.entries(stock).some(
        ([key, qty]) => normalizeSizeKey(key) === size && typeof qty === 'number' && qty > 0
      )
    )
}

function withinPriceRange(price: number, request: ValidatedSearchRequest): boolean {
  if (request.minPrice !== undefined && price < request.minPrice) return false
  if (request.maxPrice !== undefined && price > request.maxPrice) return false
  return true
}

function sortMatches(matches: Match[], request: ValidatedSearchRequest): Match[] {
  if (request.sortBy === 'price_asc' || request.sortBy === 'price_desc') {
    const direction = request.sortBy === 'price_asc' ? 1 : -1
    return [...matches].sort(
      (a, b) => (a.price - b.price) * direction || a.candidate.sku.localeCompare(b.candidate.sku)
    )
  }

  if (request.sortBy === 'newest') {
    return [...matches].sort(
      (a, b) =>
        b.candidate.createdAt.getTime() - a.candidate.createdAt.getTime() ||
        a.candidate.sku.localeCompare(b.candidate.sku)
    )
  }

  if (request.sortBy === 'discount_desc') {
    const discount = (match: Match) =>
      match.originalPrice && match.originalPrice > 0
        ? (match.originalPrice - match.price) / match.originalPrice
        : 0
    return [...matches].sort(
      (a, b) => discount(b) - discount(a) || a.candidate.sku.localeCompare(b.candidate.sku)
    )
  }

  const scored: ScoredItem<Match>[] = matches.map((match) => {
    const { score, merchandisingRank } = scoreSearchMatch({
      candidate: match.candidate,
      variant: match.variant,
      requestedSizes: request.sizes,
      requestedCategories: request.categoryKeys,
      minPrice: request.minPrice,
      maxPrice: request.maxPrice,
      fitRequested: request.fitRequested,
      price: match.price,
    })
    return {
      item: match,
      sku: match.candidate.sku,
      createdAt: match.candidate.createdAt,
      score,
      merchandisingRank,
    }
  })

  return scored.sort(compareScored).map((entry) => entry.item)
}

function scoreFor(match: Match, request: ValidatedSearchRequest): number {
  return scoreSearchMatch({
    candidate: match.candidate,
    variant: match.variant,
    requestedSizes: request.sizes,
    requestedCategories: request.categoryKeys,
    minPrice: request.minPrice,
    maxPrice: request.maxPrice,
    fitRequested: request.fitRequested,
    price: match.price,
  }).score
}

/**
 * Which single filter, dropped, would have produced candidates.
 *
 * Each probe is a SQL-only re-run with one filter removed, so the wording stays
 * hedged ("may be available") - the probe proves a candidate exists in Postgres,
 * not that Firestore would confirm it purchasable. The API only ever suggests;
 * whether to ask the customer to relax anything is Chatbase's decision.
 */
async function buildRelaxationSuggestions(
  request: ValidatedSearchRequest
): Promise<RelaxationSuggestion[]> {
  const base = toQueryFilters(request)
  const he = request.locale === 'he'

  const probes: Array<{ filter: string; applies: boolean; filters: ProductQueryFilters; message: string }> = [
    {
      filter: 'colors',
      applies: request.colors.length > 0,
      filters: { ...base, colors: undefined },
      message: he
        ? 'ייתכן שיש דגמים מתאימים בצבעים אחרים.'
        : 'Matching products may be available in other colours.',
    },
    {
      filter: 'sizes',
      applies: request.sizes.length > 0,
      filters: { ...base, sizes: undefined },
      message: he
        ? 'ייתכן שיש דגמים מתאימים במידות אחרות.'
        : 'Matching products may be available in other sizes.',
    },
    {
      filter: 'maxPrice',
      applies: request.maxPrice !== undefined,
      filters: { ...base, maxPrice: undefined },
      message: he
        ? 'ייתכן שיש דגמים מתאימים במחיר גבוה יותר.'
        : 'Matching products may be available above the requested price.',
    },
    {
      filter: 'maxHeelHeightCm',
      applies: request.maxHeelHeightCm !== undefined,
      filters: { ...base, maxHeelHeightCm: undefined },
      message: he
        ? 'ייתכן שיש דגמים מתאימים עם עקב גבוה יותר.'
        : 'Matching products may be available with a higher heel.',
    },
    {
      filter: 'specifications',
      applies: Object.keys(request.specs).length > 0,
      filters: { ...base, specs: undefined },
      message: he
        ? 'ייתכן שיש דגמים מתאימים עם מפרט טכני אחר.'
        : 'Matching products may be available with different specifications.',
    },
  ]

  const active = probes.filter((probe) => probe.applies)
  const results = await Promise.all(
    active.map((probe) => findCandidateProducts({ ...probe.filters }))
  )

  return active
    .map((probe, index) => ({ probe, hits: results[index].length }))
    .filter((entry) => entry.hits > 0)
    .map((entry) => ({ filter: entry.probe.filter, message: entry.probe.message }))
}

function buildAppliedFilters(request: ValidatedSearchRequest): Record<string, unknown> {
  const applied: Record<string, unknown> = {
    gender: request.gender,
    inStockOnly: request.inStockOnly,
    sortBy: request.sortBy,
    limit: request.limit,
  }
  if (request.categoryKeys.length > 0) applied.categories = request.categoryKeys
  if (request.sizes.length > 0) applied.sizes = request.sizes
  if (request.colors.length > 0) applied.colors = request.colors
  if (request.minPrice !== undefined) applied.minPrice = request.minPrice
  if (request.maxPrice !== undefined) applied.maxPrice = request.maxPrice
  if (request.onSaleOnly) applied.onSaleOnly = true
  if (request.outletOnly) applied.outletOnly = true
  if (request.minHeelHeightCm !== undefined) applied.minHeelHeightCm = request.minHeelHeightCm
  if (request.maxHeelHeightCm !== undefined) applied.maxHeelHeightCm = request.maxHeelHeightCm
  for (const [key, values] of Object.entries(request.specs)) {
    if (values?.length) applied[key] = values
  }
  return applied
}

export async function searchShoes(
  request: ValidatedSearchRequest
): Promise<SearchShoesResult> {
  const candidates = await findCandidateProducts(toQueryFilters(request))
  const appliedFilters = buildAppliedFilters(request)
  const moreAvailable = candidates.length >= CANDIDATE_LIMIT

  if (candidates.length === 0) {
    return {
      totalMatches: 0,
      moreAvailable: false,
      appliedFilters,
      products: [],
      relaxationSuggestions: await buildRelaxationSuggestions(request),
    }
  }

  // Postgres proposed; Firestore decides. Anything the mirror offered that
  // Firestore cannot confirm as purchasable is dropped here.
  const products = await loadProductsBySkus(candidates.map((candidate) => candidate.sku))

  const matches: Match[] = []
  for (const candidate of candidates) {
    const product = products.get(candidate.sku)
    if (!product) continue

    const variants = matchingVariants(product, request)
    const variant = chooseVariant(product, variants, request.sizes)
    if (!variant) continue

    const { price, originalPrice } = resolveVariantPricing(product, variant)
    if (!withinPriceRange(price, request)) continue

    matches.push({
      candidate,
      product,
      variant,
      price,
      originalPrice,
      matchedSizes: sizesMatchedByVariant(variant, request.sizes),
    })
  }

  if (matches.length === 0) {
    return {
      totalMatches: 0,
      moreAvailable: false,
      appliedFilters,
      products: [],
      relaxationSuggestions: await buildRelaxationSuggestions(request),
    }
  }

  const ordered = sortMatches(matches, request)
  const page = ordered.slice(0, request.limit)

  return {
    totalMatches: matches.length,
    moreAvailable,
    appliedFilters,
    products: page.map((match) =>
      presentProduct({
        candidate: match.candidate,
        product: match.product,
        variant: match.variant,
        locale: request.locale,
        requestedSizes: request.sizes,
        matchScore: request.sortBy === 'relevance' ? scoreFor(match, request) : undefined,
        matchReasons: buildMatchReasons({
          candidate: match.candidate,
          color: buildColor(match.variant.colorSlug, request.locale),
          matchedSizes: match.matchedSizes,
          locale: request.locale,
          price: match.price,
        }),
        warnings: buildWarnings(match, request),
      })
    ),
  }
}

/**
 * Caveats the agent should voice. Only ever about the returned product, and
 * never a stock quantity.
 */
function buildWarnings(match: Match, request: ValidatedSearchRequest): string[] {
  const he = request.locale === 'he'
  const warnings: string[] = []

  if (request.sizes.length > 0 && match.matchedSizes.length < request.sizes.length) {
    const missing = request.sizes.filter((size) => !match.matchedSizes.includes(size))
    warnings.push(
      he
        ? `לא זמין במידות: ${missing.join(', ')}`
        : `Not available in size(s): ${missing.join(', ')}`
    )
  }

  if (!request.inStockOnly && match.matchedSizes.length === 0 && request.sizes.length > 0) {
    warnings.push(he ? 'לא במלאי כרגע.' : 'Not currently in stock.')
  }

  return warnings
}
