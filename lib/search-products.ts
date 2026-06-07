import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import {
  buildSearchQueryTerms,
  expandHebrewQuery,
  normalizeHebrewForSearch,
} from '@/lib/hebrew-normalize'
import {
  enrichSearchItemWithMatchedColor,
  extractSearchColorTerms,
} from '@/lib/match-search-color-variant'
import type { SearchProductsResult } from '@/lib/search-types'

export type { SearchProductsResult } from '@/lib/search-types'

function sanitizeFtsToken(token: string): string {
  return token.replace(/[&|!():*'"]/g, ' ').replace(/\s+/g, ' ').trim()
}

function toTsqueryFragment(term: string): string | null {
  const cleaned = sanitizeFtsToken(term)
  if (!cleaned) return null

  const words = cleaned.split(/\s+/).filter((w) => w.length > 0)
  if (words.length === 0) return null
  if (words.length === 1) return words[0]

  return `(${words.join(' & ')})`
}

function buildFtsQuery(terms: string[]): string {
  const seen = new Set<string>()
  const parts: string[] = []

  for (const term of terms) {
    const fragment = toTsqueryFragment(term)
    if (fragment && !seen.has(fragment)) {
      seen.add(fragment)
      parts.push(fragment)
    }
    if (parts.length >= 8) break
  }

  return parts.join(' | ')
}

function extractCategoryPhrase(searchQuery: string): string {
  const sizeWords = ['מידה', 'size', 'מידות', 'sizes']
  const categoryWords = searchQuery.split(/\s+/).filter((word) => {
    if (/^\d{2,3}$/.test(word)) return false
    const lowerWord = word.toLowerCase()
    if (
      sizeWords.some(
        (sizeWord) => word === sizeWord || lowerWord === sizeWord.toLowerCase()
      )
    ) {
      return false
    }
    return word.length > 0
  })
  return categoryWords.join(' ').trim()
}

function buildCategoryMatchSql(categoryPhraseVariations: string[]): {
  categoryMatchRankSql: Prisma.Sql
  categoryMatchWhereSql: Prisma.Sql
} {
  const categoryConditions: Prisma.Sql[] = []

  for (const phrase of categoryPhraseVariations) {
    if (phrase?.trim()) {
      const trimmedPhrase = phrase.trim()
      categoryConditions.push(
        Prisma.sql`(
          p."subSubCategory_he" ILIKE ${`%${trimmedPhrase}%`}
          OR p."subCategory_he" ILIKE ${`%${trimmedPhrase}%`}
          OR p."category_he" ILIKE ${`%${trimmedPhrase}%`}
          OR LOWER(p."subSubCategory") LIKE ${`%${trimmedPhrase.toLowerCase()}%`}
          OR LOWER(p."subCategory") LIKE ${`%${trimmedPhrase.toLowerCase()}%`}
          OR LOWER(p.category) LIKE ${`%${trimmedPhrase.toLowerCase()}%`}
        )`
      )
    }
  }

  if (categoryConditions.length === 0) {
    return {
      categoryMatchRankSql: Prisma.sql`0`,
      categoryMatchWhereSql: Prisma.sql`false`,
    }
  }

  const joinedConditions = categoryConditions.reduce((acc, condition, index) => {
    if (index === 0) return condition
    return Prisma.sql`${acc} OR ${condition}`
  }, categoryConditions[0])

  return {
    categoryMatchRankSql: Prisma.sql`
      CASE WHEN (${joinedConditions}) THEN 200 ELSE 0 END
    `,
    categoryMatchWhereSql: Prisma.sql`(${joinedConditions})`,
  }
}

function buildColorMatchSql(colorKeywords: string[]): Prisma.Sql {
  if (colorKeywords.length === 0) {
    return Prisma.sql`false`
  }

  const lowerKeywords = colorKeywords.map((c) => c.toLowerCase())

  return Prisma.sql`EXISTS (
    SELECT 1
    FROM jsonb_each(p."colorVariants") AS variant(color_slug, variant_data)
    WHERE (variant_data->>'isActive' IS NULL OR (variant_data->>'isActive')::boolean = true)
      AND (
        color_slug = ANY(${colorKeywords}::text[])
        OR (variant_data->>'colorSlug')::text = ANY(${colorKeywords}::text[])
        OR (variant_data->>'colorName')::text = ANY(${colorKeywords}::text[])
        OR LOWER(color_slug) = ANY(${lowerKeywords}::text[])
        OR LOWER((variant_data->>'colorSlug')::text) = ANY(${lowerKeywords}::text[])
        OR LOWER((variant_data->>'colorName')::text) = ANY(${lowerKeywords}::text[])
      )
  )`
}

function buildSizeMatchSql(sizeNumbers: string[]): Prisma.Sql {
  if (sizeNumbers.length === 0) {
    return Prisma.sql`false`
  }

  return Prisma.sql`EXISTS (
    SELECT 1
    FROM jsonb_each(p."colorVariants") AS variant(color_slug, variant_data),
         jsonb_each(variant_data->'stockBySize') AS size_entry(size_key, stock_value)
    WHERE size_key = ANY(${sizeNumbers}::text[])
      AND (stock_value::text)::int > 0
  )`
}

export async function searchProducts(
  query: string,
  page: number = 1,
  limit: number = 24
): Promise<SearchProductsResult> {
  if (!query || query.trim().length === 0) {
    return { items: [], total: 0, page: 1, limit, query: '' }
  }

  if (process.env.SEARCH_BACKEND === 'meilisearch') {
    const { searchProductsMeilisearch } = await import('@/lib/meilisearch')
    return searchProductsMeilisearch(query, page, limit)
  }

  return searchProductsPostgres(query, page, limit)
}

async function searchProductsPostgres(
  query: string,
  page: number,
  limit: number
): Promise<SearchProductsResult> {
  const searchQuery = query.trim()
  const validatedPage = Number.isInteger(page) && page > 0 ? page : 1
  const offset = (validatedPage - 1) * limit

  const columnCheck = await prisma.$queryRaw<Array<{ column_name: string }>>`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'products'
      AND column_name IN ('search_vector', 'search_blob_norm', 'generated_search_keywords')
  `

  const hasSearchVector = columnCheck.some((c) => c.column_name === 'search_vector')
  const hasTrigramSearch = columnCheck.some((c) => c.column_name === 'search_blob_norm')
  const hasGeneratedKeywords = columnCheck.some(
    (c) => c.column_name === 'generated_search_keywords'
  )

  if (!hasSearchVector) {
    console.error('search_vector column does not exist. Please run the migration.')
    return { items: [], total: 0, page: 1, limit, query: searchQuery }
  }

  const searchTerms = buildSearchQueryTerms(searchQuery)
  const normQuery = normalizeHebrewForSearch(searchQuery)
  const ftsQueryString = buildFtsQuery(searchTerms)
  const ftsFallbackQuery = normQuery || searchQuery

  const sizeMatch = searchQuery.match(/\b(\d{2,3})\b/)
  const sizeNumbers = sizeMatch ? [sizeMatch[1]] : []
  const colorKeywords = extractSearchColorTerms(searchQuery)
  const categoryPhrase = extractCategoryPhrase(searchQuery)
  const categoryPhraseVariations = expandHebrewQuery(categoryPhrase).filter(
    (v) => v && typeof v === 'string' && v.trim().length > 0
  )

  const useCategoryFallback = categoryPhrase.split(/\s+/).filter(Boolean).length <= 2
  const { categoryMatchRankSql, categoryMatchWhereSql } = useCategoryFallback
    ? buildCategoryMatchSql(categoryPhraseVariations)
    : { categoryMatchRankSql: Prisma.sql`0`, categoryMatchWhereSql: Prisma.sql`false` }

  const colorMatchSql = buildColorMatchSql(colorKeywords)
  const sizeMatchSql = buildSizeMatchSql(sizeNumbers)

  const ftsQuerySql =
    ftsQueryString.length > 0
      ? Prisma.sql`to_tsquery('simple', ${ftsQueryString})`
      : Prisma.sql`plainto_tsquery('simple', ${ftsFallbackQuery})`

  const trigramMatchSql = hasTrigramSearch
    ? Prisma.sql`p.search_blob_norm % normalize_hebrew_search(${normQuery || searchQuery})`
    : Prisma.sql`false`

  const generatedKeywordsMatchSql = hasGeneratedKeywords
    ? Prisma.sql`EXISTS (
        SELECT 1
        FROM unnest(p.generated_search_keywords) AS kw
        WHERE normalize_hebrew_search(kw) = normalize_hebrew_search(${normQuery || searchQuery})
          OR normalize_hebrew_search(kw) LIKE '%' || normalize_hebrew_search(${normQuery || searchQuery}) || '%'
      )`
    : Prisma.sql`false`

  const generatedKeywordsRankSql = hasGeneratedKeywords
    ? Prisma.sql`
        + GREATEST(
            similarity(
              normalize_hebrew_search(immutable_text_array_flat(p.generated_search_keywords)),
              normalize_hebrew_search(${normQuery || searchQuery})
            ),
            0
          ) * 850
        + CASE
            WHEN EXISTS (
              SELECT 1
              FROM unnest(p.generated_search_keywords) AS kw
              WHERE normalize_hebrew_search(kw) = normalize_hebrew_search(${normQuery || searchQuery})
                OR normalize_hebrew_search(kw) LIKE '%' || normalize_hebrew_search(${normQuery || searchQuery}) || '%'
            )
            THEN 350
            ELSE 0
          END
      `
    : Prisma.sql``

  const rankingSql = hasTrigramSearch
    ? Prisma.sql`
        GREATEST(similarity(p.title_search_norm, normalize_hebrew_search(${normQuery || searchQuery})), 0) * 1000
        + CASE
            WHEN p.title_search_norm LIKE normalize_hebrew_search(${normQuery || searchQuery}) || '%'
            THEN 200
            ELSE 0
          END
        + GREATEST(similarity(p.category_search_norm, normalize_hebrew_search(${normQuery || searchQuery})), 0) * 800
        + GREATEST(similarity(p.sku_search_norm, normalize_hebrew_search(${normQuery || searchQuery})), 0) * 900
        + CASE
            WHEN p.sku_search_norm = normalize_hebrew_search(${normQuery || searchQuery})
            THEN 100
            ELSE 0
          END
        + GREATEST(similarity(COALESCE(p.colors_search_norm, ''), normalize_hebrew_search(${normQuery || searchQuery})), 0) * 500
        + GREATEST(similarity(p.description_search_norm, normalize_hebrew_search(${normQuery || searchQuery})), 0) * 200
        + CASE WHEN p.search_vector @@ q THEN ts_rank(p.search_vector, q) * 300 ELSE 0 END
        + GREATEST(
            similarity(
              normalize_hebrew_search(immutable_text_array_flat(p."searchKeywords")),
              normalize_hebrew_search(${normQuery || searchQuery})
            ),
            0
          ) * 900
        + CASE
            WHEN EXISTS (
              SELECT 1
              FROM unnest(p."searchKeywords") AS kw
              WHERE normalize_hebrew_search(kw) = normalize_hebrew_search(${normQuery || searchQuery})
                OR normalize_hebrew_search(kw) LIKE '%' || normalize_hebrew_search(${normQuery || searchQuery}) || '%'
            )
            THEN 400
            ELSE 0
          END
        + GREATEST(
            similarity(
              normalize_hebrew_search(immutable_text_array_flat(p.tags)),
              normalize_hebrew_search(${normQuery || searchQuery})
            ),
            0
          ) * 200
        + ${categoryMatchRankSql}
        + CASE WHEN ${sizeMatchSql} THEN 20 ELSE 0 END
        + CASE WHEN ${colorMatchSql} THEN 500 ELSE 0 END
        ${generatedKeywordsRankSql}
      `
    : Prisma.sql`
        ${categoryMatchRankSql}
        + CASE WHEN p.search_vector @@ q THEN ts_rank(p.search_vector, q) * 1000 ELSE 0 END
        + CASE WHEN ${sizeMatchSql} THEN 20 ELSE 0 END
        + CASE WHEN ${colorMatchSql} THEN 500 ELSE 0 END
      `

  const whereMatchSql = Prisma.sql`
    (
      p.search_vector @@ q
      OR ${trigramMatchSql}
      OR ${sizeMatchSql}
      OR ${colorMatchSql}
      OR ${categoryMatchWhereSql}
      OR ${generatedKeywordsMatchSql}
    )
    AND p."isActive" = true
    AND p."isDeleted" = false
  `

  const results = await prisma.$transaction(async (tx) => {
    if (hasTrigramSearch) {
      await tx.$executeRaw`SET LOCAL pg_trgm.similarity_threshold = 0.25`
    }

    return tx.$queryRaw<
      Array<{
        id: string
        sku: string
        title_en: string
        title_he: string
        description_en: string
        description_he: string
        brand: string
        price: number
        salePrice: number | null
        currency: string
        category: string
        subCategory: string | null
        subSubCategory: string | null
        categories_path: string[]
        categories_path_id: string[]
        categoryId: string
        isEnabled: boolean
        isDeleted: boolean
        featured: boolean
        isNew: boolean
        isActive: boolean
        seo_title_en: string | null
        seo_title_he: string | null
        seo_description_en: string | null
        seo_description_he: string | null
        seo_slug: string | null
        searchKeywords: string[]
        colorVariants: any
        createdAt: Date
        updatedAt: Date
        rank: number
      }>
    >(Prisma.sql`
      SELECT
        p.id,
        p.sku,
        p."title_en",
        p."title_he",
        p."description_en",
        p."description_he",
        p.brand,
        p.price,
        p."salePrice",
        p.currency,
        p.category,
        p."subCategory",
        p."subSubCategory",
        p."categories_path",
        p."categories_path_id",
        p."categoryId",
        p."isEnabled",
        p."isDeleted",
        p.featured,
        p."isNew",
        p."isActive",
        p."seo_title_en",
        p."seo_title_he",
        p."seo_description_en",
        p."seo_description_he",
        p."seo_slug",
        p."searchKeywords",
        p."colorVariants",
        p."createdAt",
        p."updatedAt",
        (${rankingSql}) AS rank
      FROM products p,
           ${ftsQuerySql} q
      WHERE ${whereMatchSql}
      ORDER BY rank DESC, p."createdAt" DESC
      LIMIT ${limit} OFFSET ${offset}
    `)
  })

  const totalResult = await prisma.$transaction(async (tx) => {
    if (hasTrigramSearch) {
      await tx.$executeRaw`SET LOCAL pg_trgm.similarity_threshold = 0.25`
    }

    return tx.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::int AS count
      FROM products p,
           ${ftsQuerySql} q
      WHERE ${whereMatchSql}
    `)
  })

  const total = totalResult[0]?.count ? Number(totalResult[0].count) : 0

  const items = results.map((product) =>
    enrichSearchItemWithMatchedColor(
      {
        id: product.id,
        sku: product.sku,
        title_en: product.title_en,
        title_he: product.title_he,
        description_en: product.description_en,
        description_he: product.description_he,
        brand: product.brand,
        price: product.price,
        salePrice: product.salePrice,
        currency: product.currency,
        category: product.category,
        subCategory: product.subCategory,
        subSubCategory: product.subSubCategory,
        categories_path: product.categories_path,
        categories_path_id: product.categories_path_id,
        categoryId: product.categoryId,
        isEnabled: product.isEnabled,
        isDeleted: product.isDeleted,
        featured: product.featured,
        isNew: product.isNew,
        isActive: product.isActive,
        seo: {
          title_en: product.seo_title_en,
          title_he: product.seo_title_he,
          description_en: product.seo_description_en,
          description_he: product.seo_description_he,
          slug: product.seo_slug,
        },
        searchKeywords: product.searchKeywords,
        colorVariants: product.colorVariants,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
      },
      searchQuery
    )
  )

  return {
    items,
    total,
    page: validatedPage,
    limit,
    query: searchQuery,
  }
}
