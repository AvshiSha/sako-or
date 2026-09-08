import type { Product } from '@/lib/product-types'
import { expandFootWidth, heelHeightCm, type SpecFilterKey } from '@/lib/chatbase/product-api-enums'
import { purchasableVariants, resolveVariantPricing } from '@/lib/chatbase/product-availability'
import { identifyProduct, loadProductsBySkus } from '@/lib/chatbase/product-fetch'
import { buildColor, presentProduct } from '@/lib/chatbase/product-presenter'
import { findCandidateProducts, type ProductCandidate } from '@/lib/chatbase/product-query'
import { categoryKeyForPath, resolveCategoryScope } from '@/lib/chatbase/product-scope'
import { compareScored, scoreSimilarity, type ScoredItem } from '@/lib/chatbase/product-scoring'
import { loadCandidateBySku } from '@/lib/chatbase/product-candidate'
import type {
  FindSimilarRequest,
  FindSimilarResult,
} from '@/lib/chatbase/find-similar-schema'
import { STABLE_HEEL_TYPES } from '@/lib/chatbase/find-similar-schema'

export * from '@/lib/chatbase/find-similar-schema'

/**
 * Turn the customer's reason into mandatory constraints.
 *
 * Each reason narrows the search rather than merely nudging the ranking: asking
 * for a lower heel because the current one hurts is a requirement, not a
 * preference, and returning a taller lookalike would not be an answer.
 */
function applyReason(
  request: FindSimilarRequest,
  source: ProductCandidate
): { specs: Partial<Record<SpecFilterKey, string[]>>; maxHeelHeightCm?: number } {
  const specs = { ...request.specs }
  let maxHeelHeightCm = request.maxHeelHeightCm
  const sourceHeel = heelHeightCm(source.heelHeight)

  switch (request.reason) {
    case 'lower_heel':
      // Strictly lower than what they already have, or they have not been helped.
      if (sourceHeel !== null && sourceHeel > 0) {
        const ceiling = Math.max(0, sourceHeel - 1)
        maxHeelHeightCm = maxHeelHeightCm === undefined ? ceiling : Math.min(maxHeelHeightCm, ceiling)
      }
      break
    case 'more_stable_heel':
      if (!specs.heelTypes?.length) specs.heelTypes = [...STABLE_HEEL_TYPES]
      break
    case 'width_mismatch':
      // The source did not suit them, so its own width value must not be offered
      // back; default to the broadest accommodating set.
      if (!specs.footWidthFits?.length) specs.footWidthFits = expandFootWidth('wide')
      break
    case 'arch_mismatch':
      if (!specs.archFits?.length) specs.archFits = ['most_arch_types']
      break
    default:
      break
  }

  return { specs, maxHeelHeightCm }
}

export async function findSimilarShoes(
  request: FindSimilarRequest
): Promise<FindSimilarResult> {
  const he = request.locale === 'he'

  const identified = await identifyProduct({
    productId: request.sourceProductId,
    sku: request.sourceSku,
    productUrl: request.sourceProductUrl,
  })

  if (identified.status !== 'found') {
    return {
      sourceProduct: null,
      totalMatches: 0,
      products: [],
      message:
        identified.status === 'ambiguous'
          ? he
            ? 'נמצא יותר ממוצר אחד בקוד הזה. בקשו מהלקוח לאשר את הדגם.'
            : 'More than one product matches. Ask the customer which one they mean.'
          : he
            ? 'מוצר המקור לא נמצא.'
            : 'Source product not found.',
    }
  }

  const sourceProduct: Product = identified.product
  const sourceCandidate = await loadCandidateBySku(sourceProduct.sku)
  if (!sourceCandidate) {
    return {
      sourceProduct: { sku: sourceProduct.sku, title: sourceProduct.sku, found: false },
      totalMatches: 0,
      products: [],
      message: he ? 'מוצר המקור לא נמצא.' : 'Source product not found.',
    }
  }

  const sourceTitle =
    (he ? sourceCandidate.shortTitle_he : sourceCandidate.shortTitle_en) ||
    sourceCandidate.shortTitle_he ||
    sourceCandidate.shortTitle_en ||
    sourceCandidate.sku

  const { specs, maxHeelHeightCm } = applyReason(request, sourceCandidate)

  // Similarity starts from the source's own category unless the customer named
  // a different one. Gender comes from the source too - a men's shoe never
  // yields women's alternatives.
  const sourceCategory = categoryKeyForPath(sourceCandidate.categories_path)
  const gender = sourceCandidate.categories_path[0] === 'men' ? 'men' : 'women'
  const categories = request.categories.length > 0 ? request.categories : sourceCategory ? [sourceCategory] : []

  const candidates = await findCandidateProducts({
    gender,
    categoryPaths: categories.length > 0 ? categoryPathsFor(categories, gender) : undefined,
    colors: request.requestedColors.length > 0 ? request.requestedColors : undefined,
    sizes: request.requestedSize ? [request.requestedSize] : undefined,
    minPrice: request.minPrice,
    maxPrice: request.maxPrice,
    maxHeelHeightCm,
    specs,
    inStockOnly: true,
  })

  // The source product is never its own alternative.
  const others = candidates.filter((candidate) => candidate.sku !== sourceCandidate.sku)
  if (others.length === 0) {
    return {
      sourceProduct: { sku: sourceCandidate.sku, title: sourceTitle, found: true },
      totalMatches: 0,
      products: [],
      relaxationSuggestions: buildRelaxationSuggestions(request),
    }
  }

  const products = await loadProductsBySkus(others.map((candidate) => candidate.sku))
  const sourcePrice = resolveVariantPricing(
    sourceProduct,
    Object.values(sourceProduct.colorVariants ?? {})[0]
  ).price

  const scored: ScoredItem<{
    candidate: ProductCandidate
    product: Product
    variant: ReturnType<typeof purchasableVariants>[number]
    price: number
    matched: string[]
    differing: string[]
  }>[] = []

  for (const candidate of others) {
    const product = products.get(candidate.sku)
    if (!product) continue

    const variants = purchasableVariants(product, {
      colors: request.requestedColors,
      sizes: request.requestedSize ? [request.requestedSize] : undefined,
    })
    // One entry per product: three colours of the same shoe are one
    // recommendation, not three.
    const variant = variants[0]
    if (!variant) continue

    const { price } = resolveVariantPricing(product, variant)
    if (request.minPrice !== undefined && price < request.minPrice) continue
    if (request.maxPrice !== undefined && price > request.maxPrice) continue

    const similarity = scoreSimilarity({
      source: sourceCandidate,
      sourcePrice,
      candidate,
      candidatePrice: price,
    })

    scored.push({
      item: { candidate, product, variant, price, matched: similarity.matched, differing: similarity.differing },
      sku: candidate.sku,
      createdAt: candidate.createdAt,
      score: similarity.score,
      merchandisingRank: similarity.merchandisingRank,
    })
  }

  if (scored.length === 0) {
    return {
      sourceProduct: { sku: sourceCandidate.sku, title: sourceTitle, found: true },
      totalMatches: 0,
      products: [],
      relaxationSuggestions: buildRelaxationSuggestions(request),
    }
  }

  const ordered = scored.sort(compareScored).slice(0, request.limit)

  return {
    sourceProduct: { sku: sourceCandidate.sku, title: sourceTitle, found: true },
    totalMatches: scored.length,
    products: ordered.map((entry) =>
      presentProduct({
        candidate: entry.item.candidate,
        product: entry.item.product,
        variant: entry.item.variant,
        locale: request.locale,
        requestedSizes: request.requestedSize ? [request.requestedSize] : undefined,
        matchScore: entry.score,
        matchReasons: describe(entry.item.matched, request.locale, entry.item.variant.colorSlug, request.requestedSize),
        differences: describeDifferences(entry.item.differing, request.locale),
        warnings: [],
      })
    ),
  }
}

/** Same scope resolver as the search endpoint, so a category means one thing. */
function categoryPathsFor(categories: string[], gender: 'women' | 'men'): string[] {
  return resolveCategoryScope(categories, gender).paths
}

const MATCH_LABELS: Record<string, { he: string; en: string }> = {
  category: { he: 'אותה קטגוריית מוצר', en: 'Same product category' },
  heelHeight: { he: 'גובה עקב דומה', en: 'Similar heel height' },
  heelTypes: { he: 'סוג עקב דומה', en: 'Similar heel type' },
  soleTypes: { he: 'סוליה דומה', en: 'Similar sole' },
  toeShapes: { he: 'צורת חרטום דומה', en: 'Similar toe shape' },
  closureTypes: { he: 'סגירה דומה', en: 'Similar closure' },
  upperMaterials: { he: 'חומר עליון דומה', en: 'Similar upper material' },
}

const DIFFERENCE_LABELS: Record<string, { he: string; en: string }> = {
  category: { he: 'קטגוריה אחרת', en: 'Different category' },
  heelHeight: { he: 'גובה עקב שונה', en: 'Different heel height' },
  heelTypes: { he: 'סוג עקב שונה', en: 'Different heel type' },
  soleTypes: { he: 'סוליה שונה', en: 'Different sole' },
  toeShapes: { he: 'צורת חרטום שונה', en: 'Different toe shape' },
  closureTypes: { he: 'סגירה שונה', en: 'Different closure' },
  upperMaterials: { he: 'חומר עליון שונה', en: 'Different upper material' },
}

function describe(
  matched: string[],
  locale: 'he' | 'en',
  colorSlug: string,
  size?: string
): string[] {
  const reasons: string[] = []
  const color = buildColor(colorSlug, locale)
  reasons.push(
    locale === 'he'
      ? size
        ? `זמין בצבע ${color.label} במידה ${size}`
        : `זמין בצבע ${color.label}`
      : size
        ? `Available in ${color.label} in size ${size}`
        : `Available in ${color.label}`
  )
  for (const key of matched) {
    const label = MATCH_LABELS[key]
    if (label) reasons.push(locale === 'he' ? label.he : label.en)
  }
  return reasons
}

function describeDifferences(differing: string[], locale: 'he' | 'en'): string[] {
  return differing
    .map((key) => DIFFERENCE_LABELS[key])
    .filter(Boolean)
    .map((label) => (locale === 'he' ? label.he : label.en))
}

function buildRelaxationSuggestions(
  request: FindSimilarRequest
): Array<{ filter: string; message: string }> {
  const he = request.locale === 'he'
  const suggestions: Array<{ filter: string; message: string }> = []

  if (request.requestedColors.length > 0) {
    suggestions.push({
      filter: 'requestedColors',
      message: he
        ? 'ייתכן שיש חלופות מתאימות בצבעים אחרים.'
        : 'Suitable alternatives may exist in other colours.',
    })
  }
  if (request.requestedSize) {
    suggestions.push({
      filter: 'requestedSize',
      message: he
        ? 'ייתכן שיש חלופות מתאימות במידות אחרות.'
        : 'Suitable alternatives may exist in other sizes.',
    })
  }
  if (request.maxPrice !== undefined) {
    suggestions.push({
      filter: 'maxPrice',
      message: he
        ? 'ייתכן שיש חלופות מתאימות במחיר גבוה יותר.'
        : 'Suitable alternatives may exist above the requested price.',
    })
  }
  return suggestions
}
