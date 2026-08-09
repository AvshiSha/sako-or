import type { Product } from './product-types'

/**
 * Colour-variant URLs are near-duplicates of one another: same product, same
 * copy, same specs, differing only by a colour word and the photography. Over
 * half the catalogue is these siblings (530 published product URLs across 254
 * base SKUs), and Google was clustering them and indexing none - Search
 * Console reported "Duplicate without user-selected canonical" across the
 * range.
 *
 * So one colour per product is the canonical, indexable URL and the others
 * point at it. Every place that has an opinion about which URL represents a
 * product - the canonical tag, the hreflang cluster, the sitemap and the base
 * SKU redirect - has to agree, or we trade a duplicate-content problem for a
 * contradictory-signals one. That agreement is what this module is for.
 */

/**
 * Derived from Product rather than the exported `ColorVariant` interface:
 * Product declares its own inline, narrower shape for `colorVariants`
 * (no colorName/stock/sizes/timestamps), and the two are not assignable.
 */
type ProductColorVariants = NonNullable<Product['colorVariants']>
type ProductColorVariant = ProductColorVariants[string]
type ColorVariantEntry = { colorSlug: string; variant: ProductColorVariant }

/** Active colour variants, ordered deterministically by slug. */
function activeColorVariants(
  colorVariants: Product['colorVariants'] | undefined
): ColorVariantEntry[] {
  return Object.entries(colorVariants || {})
    .map(([key, variant]) => ({ colorSlug: variant?.colorSlug || key, variant }))
    .filter((entry) => !!entry.colorSlug && entry.variant?.isActive !== false)
    .sort((a, b) => a.colorSlug.localeCompare(b.colorSlug))
}

/**
 * The one colour whose URL represents this product in search.
 *
 * Sorted by slug rather than taking the first key: object key order comes out
 * of Firestore and is not guaranteed stable across reads, and a canonical that
 * changes between renders is worse than no canonical at all.
 */
export function getPrimaryColorSlug(
  colorVariants: Product['colorVariants'] | undefined
): string | undefined {
  return activeColorVariants(colorVariants)[0]?.colorSlug
}

/** True when this colour is the one that represents the product in search. */
export function isPrimaryColorSlug(
  colorVariants: Product['colorVariants'] | undefined,
  colorSlug: string
): boolean {
  const primary = getPrimaryColorSlug(colorVariants)
  return !!primary && primary === colorSlug
}

/**
 * Composes a product page title that leads with words people actually search.
 *
 * `title_he` / `title_en` in Firestore hold the *brand* ("IL BORGO FIRENZE",
 * "STELIO MALORI Italy"), not a product name, so titles carried no searchable
 * keyword and collided outright between different SKUs of the same brand.
 * Leading with the category ("סנדלי עקב") puts a real keyword in the first 40
 * characters and keeps the brand as the trailing differentiator.
 *
 * The ` | SAKO-OR` suffix is NOT added here - buildMetadata() appends it, and
 * adding it in both places is how titles end up double-branded.
 */
export function buildProductTitle(options: {
  /** Admin override from `product.seo.title_*`. Used verbatim when present. */
  seoTitleOverride?: string
  /** `product.title_he` / `title_en` - in practice the brand name. */
  productTitle?: string
  /** Localised deepest-category name, e.g. "סנדלי עקב". Absent is fine. */
  categoryName?: string
  /** Localised colour name from getColorName(), e.g. "בז'". */
  colorName?: string
}): string {
  const { seoTitleOverride, productTitle, categoryName, colorName } = options

  // An admin who typed a title meant it - never recompose over the top of it.
  const override = seoTitleOverride?.trim()
  if (override) return override

  const brand = productTitle?.trim()
  const category = categoryName?.trim()
  const color = colorName?.trim()

  // Lead with category + colour (the searchable part), trail with brand.
  const lead = [category, color].filter(Boolean).join(' ')
  const composed = [lead, brand].filter(Boolean).join(' – ')

  // Fall back to whatever we do have rather than returning an empty string.
  const title = composed || brand || category || color || ''

  // Anti-pattern #12: titles beyond ~65 characters get truncated in the SERP
  // and are rewritten by Google more often. buildMetadata() still has to fit
  // " | SAKO-OR" (10 chars) after this, so budget for it.
  const MAX = 55
  if (title.length <= MAX) return title

  // Drop the brand before truncating mid-word - the keyword matters more.
  if (lead && lead.length <= MAX) return lead
  return title.slice(0, MAX).trimEnd()
}
