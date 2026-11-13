import 'server-only'

import {
  isMcpContentType,
  readableFieldsFor,
  MCP_CONTENT_TYPES,
  type McpContentType,
} from '@/lib/mcp/field-allowlist'
import { McpValidationError } from '@/lib/mcp/validation'
import { getArticleAdmin } from '@/lib/server/blog-mutations'
import { getCategoryAdmin, listCategoriesAdmin, toIsoString } from '@/lib/server/category-seo-mutations'
import { adminDb } from '@/lib/firebase-admin'
import { cmsHtmlToPlainText } from '@/lib/cms-html-cleanup'
import type { McpToolResult } from '@/lib/mcp/responses'
import { articlePublicUrl, categoryPublicUrl } from '@/lib/mcp/urls'
import {
  countCollectionProducts,
  describeStoredCollection,
  listProductCollections,
} from '@/lib/server/blog-collection'

/**
 * search_content and get_content.
 *
 * Both are hard-scoped to the two permitted collections. The content type is a
 * closed enum checked before any query runs, so there is no parameter anywhere
 * in this file that could name `products`, `orders`, `users` or anything else
 * -- a caller asking for an unknown type gets a validation error, not an empty
 * result set that might have been a near miss.
 */

const BLOG_COLLECTION = 'blogArticles'
const MAX_SEARCH_RESULTS = 25

export interface SearchHit {
  contentId: string
  contentType: McpContentType
  title: string
  status?: string
  slug?: string
  path?: string
  url: string
  updatedAt: string
}

function parseTypes(raw: unknown): McpContentType[] {
  if (raw === undefined || raw === null) return [...MCP_CONTENT_TYPES]

  const list = Array.isArray(raw) ? raw : [raw]
  const parsed: McpContentType[] = []
  for (const entry of list) {
    if (!isMcpContentType(entry)) {
      throw new McpValidationError('INVALID_REQUEST', [
        `"${String(entry)}" is not a content type this integration can access. ` +
          `Valid values: ${MCP_CONTENT_TYPES.join(', ')}.`,
      ])
    }
    parsed.push(entry)
  }
  return parsed.length > 0 ? [...new Set(parsed)] : [...MCP_CONTENT_TYPES]
}

/** Case-insensitive substring match across Hebrew and English. */
function matches(query: string, ...candidates: (string | undefined)[]): boolean {
  if (!query) return true
  const needle = query.toLowerCase()
  return candidates.some((value) => value && value.toLowerCase().includes(needle))
}

export async function searchContent(input: Record<string, unknown>): Promise<McpToolResult> {
  const query = typeof input.query === 'string' ? input.query.trim() : ''
  const types = parseTypes(input.contentTypes)
  const statusFilter = typeof input.status === 'string' ? input.status : undefined

  if (statusFilter && !['draft', 'scheduled', 'published'].includes(statusFilter)) {
    throw new McpValidationError('INVALID_REQUEST', [
      'status must be one of draft, scheduled, published.',
    ])
  }

  const hits: SearchHit[] = []

  if (types.includes('blog_article')) {
    // Ordered by updatedAt and capped, then filtered in memory. Firestore
    // cannot do substring matching at all, and the collection is small enough
    // that a bounded scan is cheaper than standing up a search index for two
    // articles a day.
    let ref = adminDb.collection(BLOG_COLLECTION).orderBy('updatedAt', 'desc').limit(200)
    if (statusFilter) {
      ref = adminDb
        .collection(BLOG_COLLECTION)
        .where('status', '==', statusFilter)
        .orderBy('updatedAt', 'desc')
        .limit(200)
    }

    const snapshot = await ref.get()
    for (const doc of snapshot.docs) {
      const data = doc.data()
      const titleHe = cmsHtmlToPlainText(String(data.title?.he ?? ''))
      const titleEn = cmsHtmlToPlainText(String(data.title?.en ?? ''))
      const slug = String(data.slug ?? '')

      if (!matches(query, titleHe, titleEn, slug, String(data.sourceRef ?? ''))) continue

      hits.push({
        contentId: doc.id,
        contentType: 'blog_article',
        title: titleHe || titleEn || slug,
        status: String(data.status ?? ''),
        slug,
        url: articlePublicUrl(slug),
        updatedAt: String(data.updatedAt ?? ''),
      })
      if (hits.length >= MAX_SEARCH_RESULTS) break
    }
  }

  if (types.includes('category') && hits.length < MAX_SEARCH_RESULTS) {
    const categories = await listCategoriesAdmin()
    for (const category of categories) {
      const nameHe = String(category.name?.he ?? '')
      const nameEn = String(category.name?.en ?? '')
      const path = String(category.path ?? '')

      if (!matches(query, nameHe, nameEn, path)) continue

      hits.push({
        contentId: category.id,
        contentType: 'category',
        title: nameHe || nameEn || path,
        path,
        url: categoryPublicUrl(path),
        updatedAt: toIsoString(category.updatedAt),
      })
      if (hits.length >= MAX_SEARCH_RESULTS) break
    }
  }

  return {
    ok: true,
    data: {
      count: hits.length,
      truncated: hits.length >= MAX_SEARCH_RESULTS,
      results: hits,
    },
  }
}

/**
 * The collections an article may be pointed at, with a live product count.
 *
 * Separate from search_content's `category` results on purpose. Those exist so
 * a specialist can edit a collection page's own SEO text and are keyed to that
 * job; this answers a different question -- "which collection should this
 * article's product section draw from, and would it actually show anything?"
 * -- and returns the ancestor chain and both locales' titles and URLs, none of
 * which an SEO-editing result needs.
 *
 * The count is the only product data that crosses this boundary, and it is a
 * count. No id, name, price, stock level or image comes back, because nothing
 * here needs one and a browse tool is the wrong place to widen a read surface.
 */
const MAX_COLLECTION_RESULTS = 60

export async function listCollections(input: Record<string, unknown>): Promise<McpToolResult> {
  const query = typeof input.query === 'string' ? input.query.trim() : ''
  const withCounts = input.includeProductCounts !== false

  const collections = await listProductCollections({
    query,
    limit: MAX_COLLECTION_RESULTS,
  })

  // Counting is one query per collection, so it is capped rather than run
  // across the whole tree: a browse of 36 categories should not fan out into
  // 36 reads when the caller is only going to pick one. Past the cap the
  // entries still come back, without a count.
  const COUNT_BUDGET = 25
  const results = await Promise.all(
    collections.map(async (collection, index) => {
      if (!withCounts || index >= COUNT_BUDGET) {
        return { ...collection, liveProducts: undefined }
      }
      const { count, capped } = await countCollectionProducts(collection.categoryIds)
      return { ...collection, liveProducts: capped ? `${count}+` : count }
    })
  )

  return {
    ok: true,
    data: {
      count: results.length,
      truncated: results.length >= MAX_COLLECTION_RESULTS,
      results,
      usage:
        'Pass a collectionId to create_blog_draft or update_blog_content as ' +
        '{ "productCollection": { "collectionId": "..." } }. One selection serves both ' +
        'Hebrew and English. Selecting a collection does not change the collection itself, ' +
        'what is in it, or any product.',
      ...(withCounts && collections.length > COUNT_BUDGET
        ? {
            note:
              `Product counts were resolved for the first ${COUNT_BUDGET} results. ` +
              'Narrow the query to get a count for the rest.',
          }
        : {}),
    },
  }
}

/**
 * Return only allowlisted fields of one permitted record.
 *
 * The projection is built from the allowlist rather than by deleting unwanted
 * keys from the document. Deleting is a blocklist in disguise: the day somebody
 * adds a field to the Category model, a blocklist leaks it and an allowlist
 * does not.
 */
export async function getContent(input: Record<string, unknown>): Promise<McpToolResult> {
  const contentType = input.contentType
  const contentId = input.contentId

  if (!isMcpContentType(contentType)) {
    throw new McpValidationError('INVALID_REQUEST', [
      `contentType must be one of ${MCP_CONTENT_TYPES.join(', ')}.`,
    ])
  }
  if (typeof contentId !== 'string' || !contentId.trim()) {
    throw new McpValidationError('INVALID_REQUEST', ['contentId is required.'])
  }

  const allowed = readableFieldsFor(contentType)

  if (contentType === 'blog_article') {
    const article = await getArticleAdmin(contentId.trim())
    if (!article) {
      throw new McpValidationError('NOT_FOUND', [
        `No blog article with id "${contentId}". Use search_content to find it.`,
      ])
    }

    const projected: Record<string, unknown> = {}
    for (const field of allowed) {
      const value = (article as unknown as Record<string, unknown>)[field]
      if (value !== undefined) projected[field] = value
    }

    // Derived, not stored, so it is filled after the projection loop rather
    // than by it. Always present -- `null` when nothing is selected -- because
    // an absent key reads as "this integration cannot see that", which is the
    // thing that sent the editor to the admin panel in the first place.
    if ((allowed as readonly string[]).includes('productCollection')) {
      projected.productCollection = await describeStoredCollection(
        article.relatedProductsCarousel
      )
    }

    return {
      ok: true,
      contentId: article.id,
      contentType,
      status: article.status,
      url: articlePublicUrl(article.slug),
      updatedAt: article.updatedAt,
      ...(article.status === 'scheduled' ? { publishAt: article.publishedAt } : {}),
      data: { fields: projected },
    }
  }

  const category = await getCategoryAdmin(contentId.trim())
  if (!category) {
    throw new McpValidationError('NOT_FOUND', [
      `No category with id "${contentId}". Use search_content to find it.`,
    ])
  }

  const projected: Record<string, unknown> = {}
  for (const field of allowed) {
    const value = (category as unknown as Record<string, unknown>)[field]
    if (value === undefined) continue
    projected[field] = field === 'updatedAt' ? toIsoString(value) : value
  }

  return {
    ok: true,
    contentId: category.id,
    contentType,
    url: categoryPublicUrl(String(category.path ?? '')),
    updatedAt: toIsoString(category.updatedAt),
    data: {
      fields: projected,
      // Named explicitly so the model does not try to write them and get a
      // FORBIDDEN_FIELD it has to learn from.
      readOnlyFields: ['id', 'name', 'slug', 'path', 'level', 'updatedAt'],
    },
  }
}
