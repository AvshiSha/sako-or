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
