import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { SPEC_FILTERS, type SpecFilterKey } from '@/lib/chatbase/product-api-enums'
import { FOOTWEAR_SECTIONS } from '@/lib/chatbase/product-scope'
import type { ChatbaseGender } from '@/lib/chatbase/collection-catalog'

/**
 * Stage A of the search: narrow the catalogue in Postgres.
 *
 * This is the only module in the Chatbase API that writes SQL, and every value
 * reaches the database as a bound parameter through `Prisma.sql` - no Chatbase
 * input is ever concatenated into a statement.
 *
 * Postgres holds the structured specification columns and is the right place to
 * filter on them. It is NOT the authority on stock: its `colorVariants` mirror
 * is refreshed from Firestore by cron every three hours. The colour/size
 * predicate here is therefore a *prefilter* - deliberately inclusive, so it can
 * never drop a product that Firestore would have confirmed. Availability is
 * decided in product-availability.ts against Firestore, and nowhere else.
 */

/** Candidate ceiling. The live catalogue is ~265 products, so this only ever
 *  bites on a filterless search, and leaves ample headroom for the availability
 *  pass to reject rows and still fill a page of results. */
export const CANDIDATE_LIMIT = 120

export type SpecFilterValues = Partial<Record<SpecFilterKey, string[]>>

export type ProductQueryFilters = {
  gender?: ChatbaseGender
  /** Full collection paths from resolveCategoryScope(), e.g. women/shoes/pumps. */
  categoryPaths?: string[]
  colors?: string[]
  sizes?: string[]
  minPrice?: number
  maxPrice?: number
  onSaleOnly?: boolean
  outletOnly?: boolean
  minHeelHeightCm?: number
  maxHeelHeightCm?: number
  specs?: SpecFilterValues
  inStockOnly?: boolean
}

/** One candidate row. Only the columns the presenter and scorer actually read. */
export type ProductCandidate = {
  sku: string
  categories_path: string[]
  price: number
  salePrice: number | null
  featured: boolean
  isNew: boolean
  createdAt: Date
  upperMaterial: string[]
  lining: string | null
  insole: string | null
  outsole: string | null
  soleType: string | null
  toeShape: string | null
  heelType: string | null
  closureType: string | null
  heelHeight: string | null
  sizeFit: string | null
  footWidthFit: string | null
  archFit: string | null
  adjustableFeatures: string[]
  shortTitle_en: string | null
  shortTitle_he: string | null
  title_en: string
  title_he: string
  subSubCategory_en: string | null
  subSubCategory_he: string | null
}

/**
 * The columns every candidate read selects, shared so the search query and the
 * single-product lookup in product-candidate.ts can never drift apart and
 * compare different fields. Static SQL - no caller input reaches it.
 */
export const CANDIDATE_COLUMNS = Prisma.sql`
  p.sku,
  p.categories_path,
  p.price,
  p."salePrice",
  p.featured,
  p."isNew",
  p."createdAt",
  p."upperMaterial",
  p.lining,
  p.insole,
  p.outsole,
  p."soleType",
  p."toeShape",
  p."heelType",
  p."closureType",
  p."heelHeight",
  p."sizeFit",
  p."footWidthFit",
  p."archFit",
  p."adjustableFeatures",
  p."shortTitle_en",
  p."shortTitle_he",
  p.title_en,
  p.title_he,
  p."subSubCategory" AS "subSubCategory_en",
  p."subSubCategory_he"
`

/**
 * Matches one active colour variant that carries the requested colour AND the
 * requested size, on the same variant. Two separate EXISTS clauses would let a
 * black variant and a size-39 variant satisfy the query between them, which is
 * precisely the false positive the brief forbids.
 */
function variantPredicate(filters: ProductQueryFilters): Prisma.Sql | null {
  const { colors, sizes, inStockOnly } = filters
  const wantsColor = !!colors?.length
  const wantsSize = !!sizes?.length
  const wantsStock = inStockOnly !== false

  if (!wantsColor && !wantsSize && !wantsStock) return null

  const conditions: Prisma.Sql[] = [
    // An absent isActive means active, matching variantHasSizeInStock().
    Prisma.sql`(v.value->>'isActive' IS NULL OR (v.value->>'isActive')::boolean = true)`,
  ]

  if (wantsColor) {
    conditions.push(
      Prisma.sql`(v.key = ANY(${colors}::text[]) OR v.value->>'colorSlug' = ANY(${colors}::text[]))`
    )
  }

  if (wantsSize) {
    // Size keys are stored as strings and are not consistently normalised
    // ("40" vs "40.0"), so compare textually and, when both sides are numeric,
    // numerically as well. normalizeSizeKey() does the exact match in stage B.
    const sizeNumbers = sizes
      .map((size) => Number(size))
      .filter((size) => Number.isFinite(size))
    const sizeMatch = sizeNumbers.length
      ? Prisma.sql`(
          btrim(s.key) = ANY(${sizes}::text[])
          OR (btrim(s.key) ~ '^[0-9]+(\\.[0-9]+)?$' AND btrim(s.key)::numeric = ANY(${sizeNumbers}::numeric[]))
        )`
      : Prisma.sql`btrim(s.key) = ANY(${sizes}::text[])`

    conditions.push(
      Prisma.sql`EXISTS (
        SELECT 1 FROM jsonb_each_text(v.value->'stockBySize') AS s
        WHERE ${sizeMatch}
          AND s.value ~ '^-?[0-9]+(\\.[0-9]+)?$'
          AND s.value::numeric > 0
      )`
    )
  } else if (wantsStock) {
    conditions.push(
      Prisma.sql`EXISTS (
        SELECT 1 FROM jsonb_each_text(v.value->'stockBySize') AS s
        WHERE s.value ~ '^-?[0-9]+(\\.[0-9]+)?$' AND s.value::numeric > 0
      )`
    )
  }

  return Prisma.sql`EXISTS (
    SELECT 1 FROM jsonb_each(p."colorVariants") AS v
    WHERE ${Prisma.join(conditions, ' AND ')}
  )`
}

function specConditions(specs: SpecFilterValues | undefined): Prisma.Sql[] {
  if (!specs) return []
  const conditions: Prisma.Sql[] = []

  for (const [key, values] of Object.entries(specs) as [SpecFilterKey, string[]][]) {
    if (!values?.length) continue
    const { column, kind } = SPEC_FILTERS[key]
    const columnSql = Prisma.raw(`p."${column}"`)

    if (kind === 'array') {
      // Overlap: an empty stored array matches nothing, so an unfilled spec is
      // never a positive match.
      conditions.push(Prisma.sql`${columnSql} && ${values}::text[]`)
    } else {
      // `NULL = ANY(...)` is NULL, not true, so a NULL column is excluded on its
      // own. The stored sentinel 'undefined' can never appear in `values` -
      // product-api-enums.ts rejects it as a filter value.
      conditions.push(Prisma.sql`${columnSql} = ANY(${values}::text[])`)
    }
  }

  return conditions
}

export async function findCandidateProducts(
  filters: ProductQueryFilters
): Promise<ProductCandidate[]> {
  const conditions: Prisma.Sql[] = [
    Prisma.sql`p."isEnabled" = true`,
    Prisma.sql`p."isDeleted" = false`,
    // Footwear only, decided on the hierarchy rather than on title keywords.
    Prisma.sql`p.categories_path[2] = ANY(${[...FOOTWEAR_SECTIONS]}::text[])`,
  ]

  if (filters.gender) {
    conditions.push(Prisma.sql`p.categories_path[1] = ${filters.gender}`)
  }

  if (filters.categoryPaths?.length) {
    conditions.push(
      Prisma.sql`array_to_string(p.categories_path, '/') = ANY(${filters.categoryPaths}::text[])`
    )
  }

  if (filters.outletOnly) {
    conditions.push(Prisma.sql`p.categories_path[2] = 'outlet'`)
  }

  if (filters.onSaleOnly) {
    conditions.push(Prisma.sql`p."salePrice" IS NOT NULL AND p."salePrice" > 0 AND p."salePrice" < p.price`)
  }

  // Inclusive price bounds. The payable price per variant is resolved exactly in
  // stage B; these bounds only have to avoid excluding a row stage B would keep,
  // so they compare against the cheapest and dearest price the product could have.
  if (filters.maxPrice !== undefined) {
    conditions.push(
      Prisma.sql`LEAST(COALESCE(NULLIF(p."salePrice", 0), p.price), p.price) <= ${filters.maxPrice}`
    )
  }
  if (filters.minPrice !== undefined) {
    conditions.push(Prisma.sql`p.price >= ${filters.minPrice}`)
  }

  // heelHeight is a whole-centimetre string enum ('0'..'12'); the regex guard
  // stops a non-numeric legacy value from aborting the cast for the whole query.
  if (filters.maxHeelHeightCm !== undefined) {
    conditions.push(
      Prisma.sql`(p."heelHeight" ~ '^[0-9]+$' AND p."heelHeight"::int <= ${Math.floor(filters.maxHeelHeightCm)})`
    )
  }
  if (filters.minHeelHeightCm !== undefined) {
    conditions.push(
      Prisma.sql`(p."heelHeight" ~ '^[0-9]+$' AND p."heelHeight"::int >= ${Math.ceil(filters.minHeelHeightCm)})`
    )
  }

  conditions.push(...specConditions(filters.specs))

  const variants = variantPredicate(filters)
  if (variants) conditions.push(variants)

  const rows = await prisma.$queryRaw<ProductCandidate[]>`
    SELECT ${CANDIDATE_COLUMNS}
    FROM products p
    WHERE ${Prisma.join(conditions, ' AND ')}
    ORDER BY p."createdAt" DESC, p.sku ASC
    LIMIT ${CANDIDATE_LIMIT}
  `

  return rows
}
