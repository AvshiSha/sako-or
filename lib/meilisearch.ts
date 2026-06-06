import {
  extractColorsSearchNorm,
  normalizeHebrewForSearch,
} from '@/lib/hebrew-normalize'
import type { SearchProductsResult } from '@/lib/search-types'

const MEILI_INDEX = process.env.MEILISEARCH_INDEX || 'products'

interface MeiliProductDocument {
  id: string
  sku: string
  title_en: string
  title_he: string
  description_en: string
  description_he: string
  brand: string
  category: string
  subCategory: string | null
  subSubCategory: string | null
  category_he: string | null
  subCategory_he: string | null
  subSubCategory_he: string | null
  searchKeywords: string[]
  tags: string[]
  colors: string
  isActive: boolean
  isDeleted: boolean
}

function getMeiliConfig(): { host: string; apiKey: string } | null {
  const host = process.env.MEILISEARCH_HOST
  const apiKey = process.env.MEILISEARCH_API_KEY
  if (!host || !apiKey) {
    return null
  }
  return { host: host.replace(/\/$/, ''), apiKey }
}

async function meiliFetch(path: string, init?: RequestInit): Promise<Response> {
  const config = getMeiliConfig()
  if (!config) {
    throw new Error('Meilisearch is not configured (MEILISEARCH_HOST / MEILISEARCH_API_KEY)')
  }

  return fetch(`${config.host}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
      ...(init?.headers || {}),
    },
  })
}

export function isMeilisearchConfigured(): boolean {
  return getMeiliConfig() !== null
}

export function buildMeiliProductDocument(product: {
  id: string
  sku: string
  title_en: string
  title_he: string
  description_en: string
  description_he: string
  brand: string
  category: string
  subCategory?: string | null
  subSubCategory?: string | null
  category_he?: string | null
  subCategory_he?: string | null
  subSubCategory_he?: string | null
  searchKeywords?: string[]
  tags?: string[]
  colorVariants?: unknown
  isActive?: boolean
  isDeleted?: boolean
}): MeiliProductDocument {
  return {
    id: product.id,
    sku: normalizeHebrewForSearch(product.sku),
    title_en: normalizeHebrewForSearch(product.title_en),
    title_he: normalizeHebrewForSearch(product.title_he),
    description_en: normalizeHebrewForSearch(product.description_en),
    description_he: normalizeHebrewForSearch(product.description_he),
    brand: normalizeHebrewForSearch(product.brand),
    category: normalizeHebrewForSearch(product.category),
    subCategory: product.subCategory
      ? normalizeHebrewForSearch(product.subCategory)
      : null,
    subSubCategory: product.subSubCategory
      ? normalizeHebrewForSearch(product.subSubCategory)
      : null,
    category_he: product.category_he
      ? normalizeHebrewForSearch(product.category_he)
      : null,
    subCategory_he: product.subCategory_he
      ? normalizeHebrewForSearch(product.subCategory_he)
      : null,
    subSubCategory_he: product.subSubCategory_he
      ? normalizeHebrewForSearch(product.subSubCategory_he)
      : null,
    searchKeywords: (product.searchKeywords || []).map(normalizeHebrewForSearch),
    tags: (product.tags || []).map(normalizeHebrewForSearch),
    colors: extractColorsSearchNorm(product.colorVariants),
    isActive: product.isActive ?? true,
    isDeleted: product.isDeleted ?? false,
  }
}

export async function ensureMeilisearchIndex(): Promise<void> {
  if (!isMeilisearchConfigured()) return

  const response = await meiliFetch(`/indexes/${MEILI_INDEX}/settings`, {
    method: 'PATCH',
    body: JSON.stringify({
      searchableAttributes: [
        'title_he',
        'title_en',
        'category_he',
        'subCategory_he',
        'subSubCategory_he',
        'category',
        'subCategory',
        'subSubCategory',
        'sku',
        'colors',
        'description_he',
        'description_en',
        'tags',
        'searchKeywords',
        'brand',
      ],
      filterableAttributes: ['isActive', 'isDeleted'],
      rankingRules: [
        'words',
        'typo',
        'proximity',
        'attribute',
        'sort',
        'exactness',
      ],
      typoTolerance: { enabled: true },
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Failed to configure Meilisearch index: ${body}`)
  }
}

export async function upsertMeilisearchProduct(
  product: Parameters<typeof buildMeiliProductDocument>[0]
): Promise<void> {
  if (!isMeilisearchConfigured()) return

  const document = buildMeiliProductDocument(product)
  const response = await meiliFetch(`/indexes/${MEILI_INDEX}/documents`, {
    method: 'POST',
    body: JSON.stringify([document]),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Failed to upsert Meilisearch document: ${body}`)
  }
}

export async function deleteMeilisearchProduct(productId: string): Promise<void> {
  if (!isMeilisearchConfigured()) return

  const response = await meiliFetch(`/indexes/${MEILI_INDEX}/documents/${productId}`, {
    method: 'DELETE',
  })

  if (!response.ok && response.status !== 404) {
    const body = await response.text()
    throw new Error(`Failed to delete Meilisearch document: ${body}`)
  }
}

export async function searchProductsMeilisearch(
  query: string,
  page: number = 1,
  limit: number = 24
): Promise<SearchProductsResult> {
  const searchQuery = query.trim()
  const validatedPage = Number.isInteger(page) && page > 0 ? page : 1

  if (!isMeilisearchConfigured()) {
    console.error('SEARCH_BACKEND=meilisearch but Meilisearch is not configured')
    return { items: [], total: 0, page: 1, limit, query: searchQuery }
  }

  const response = await meiliFetch(`/indexes/${MEILI_INDEX}/search`, {
    method: 'POST',
    body: JSON.stringify({
      q: searchQuery,
      filter: 'isActive = true AND isDeleted = false',
      limit,
      offset: (validatedPage - 1) * limit,
      attributesToRetrieve: ['id'],
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Meilisearch search failed: ${body}`)
  }

  const data = (await response.json()) as {
    hits: Array<{ id: string }>
    estimatedTotalHits?: number
    totalHits?: number
  }

  const ids = data.hits.map((hit) => hit.id)
  if (ids.length === 0) {
    return {
      items: [],
      total: data.estimatedTotalHits ?? data.totalHits ?? 0,
      page: validatedPage,
      limit,
      query: searchQuery,
    }
  }

  const { prisma } = await import('@/lib/prisma')
  const products = await prisma.product.findMany({
    where: { id: { in: ids } },
  })

  const productMap = new Map(products.map((p) => [p.id, p]))
  const items = ids
    .map((id) => productMap.get(id))
    .filter(Boolean)
    .map((product) => ({
      id: product!.id,
      sku: product!.sku,
      title_en: product!.title_en,
      title_he: product!.title_he,
      description_en: product!.description_en,
      description_he: product!.description_he,
      brand: product!.brand,
      price: product!.price,
      salePrice: product!.salePrice,
      currency: product!.currency,
      category: product!.category,
      subCategory: product!.subCategory,
      subSubCategory: product!.subSubCategory,
      categories_path: product!.categories_path,
      categories_path_id: product!.categories_path_id,
      categoryId: product!.categoryId,
      isEnabled: product!.isEnabled,
      isDeleted: product!.isDeleted,
      featured: product!.featured,
      isNew: product!.isNew,
      isActive: product!.isActive,
      seo: {
        title_en: product!.seo_title_en,
        title_he: product!.seo_title_he,
        description_en: product!.seo_description_en,
        description_he: product!.seo_description_he,
        slug: product!.seo_slug,
      },
      searchKeywords: product!.searchKeywords,
      colorVariants: product!.colorVariants,
      createdAt: product!.createdAt,
      updatedAt: product!.updatedAt,
    }))

  return {
    items,
    total: data.estimatedTotalHits ?? data.totalHits ?? items.length,
    page: validatedPage,
    limit,
    query: searchQuery,
  }
}
