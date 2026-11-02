import 'server-only'

import {
  BLOG_WRITABLE_FIELDS,
  CATEGORY_WRITABLE_FIELDS,
} from '@/lib/mcp/field-allowlist'
import {
  McpValidationError,
  parseFieldPayload,
  validateReadyToPublish,
  validateSlug,
} from '@/lib/mcp/validation'
import { getIssuer } from '@/lib/mcp/oauth/config'
import { changedFieldNames, recordAudit, snapshotArticleRevision } from '@/lib/mcp/audit'
import { consumeUpload } from '@/lib/mcp/rate-limit'
import { importArticleImage } from '@/lib/mcp/image-import'
import { articlePublicUrl, articlePublicUrls, categoryPublicUrl } from '@/lib/mcp/urls'
import type { McpToolResult } from '@/lib/mcp/responses'
import type { McpAuthContext } from '@/lib/mcp/auth'
import { parseScheduleTime } from '@/lib/blog-schedule'
import {
  createArticleAdmin,
  findArticleBySlugAdmin,
  findArticleBySourceRefAdmin,
  getArticleAdmin,
  getArticleRawAdmin,
  setArticleScheduleAdmin,
  updateArticleFieldsAdmin,
} from '@/lib/server/blog-mutations'
import {
  getCategoryAdmin,
  getCategoryRawAdmin,
  toIsoString,
  updateCategorySeoAdmin,
} from '@/lib/server/category-seo-mutations'

/**
 * The five write tools.
 *
 * Every one of them follows the same order, and the order is the security
 * model: allowlist the fields, validate and sanitize the values, check the
 * conflict token, write, then audit. Nothing writes before the allowlist check,
 * and nothing returns success before the audit entry is queued.
 */

interface ToolContext {
  auth: McpAuthContext
  requestId: string
}

// ── create_blog_draft ──────────────────────────────────────────────────────

export async function createBlogDraft(
  input: Record<string, unknown>,
  ctx: ToolContext
): Promise<McpToolResult> {
  const { fields: rawFields, sourceRef, slug: rawSlug } = splitCreateInput(input)

  const slug = validateSlug(rawSlug)
  const { fields, warnings } = parseFieldPayload(
    rawFields,
    BLOG_WRITABLE_FIELDS,
    'create_blog_draft',
    getIssuer()
  )

  // Idempotency, before anything is written. A retried import -- which is the
  // normal case when a tool call times out on the client but succeeded here --
  // must find its own earlier article rather than create a second one.
  if (sourceRef) {
    const existing = await findArticleBySourceRefAdmin(sourceRef)
    if (existing) {
      return {
        ok: true,
        created: false,
        contentId: existing.id,
        contentType: 'blog_article',
        status: existing.status,
        url: articlePublicUrl(existing.slug),
        updatedAt: existing.updatedAt,
        warnings: [
          ...warnings,
          `An article already exists for sourceRef "${sourceRef}" (slug "${existing.slug}"). ` +
            'Nothing was created. Use update_blog_content to change it.',
        ],
        data: { slug: existing.slug },
      }
    }
  }

  const slugTaken = await findArticleBySlugAdmin(slug)
  if (slugTaken) {
    throw new McpValidationError('CONFLICT', [
      `The slug "${slug}" is already used by article ${slugTaken.id}. ` +
        'Choose a different slug, or update that article instead.',
    ])
  }

  const id = await createArticleAdmin({
    slug,
    fields,
    sourceRef,
    actor: ctx.auth.email,
  })

  await recordAudit({
    action: 'create_blog_draft',
    contentType: 'blog_article',
    contentId: id,
    actor: ctx.auth.email,
    changedFields: ['slug', ...Object.keys(fields)].sort(),
    via: 'mcp',
    requestId: ctx.requestId,
    statusTo: 'draft',
  })

  const created = await getArticleAdmin(id)

  const missing = validateReadyToPublish({ slug, ...fields })

  return {
    ok: true,
    created: true,
    contentId: id,
    contentType: 'blog_article',
    status: 'draft',
    url: articlePublicUrl(slug),
    updatedAt: created?.updatedAt,
    warnings: [
      ...warnings,
      ...(missing.length > 0
        ? [
            'Still needed before this can be scheduled: ' + missing.join(' '),
          ]
        : []),
    ],
    data: {
      slug,
      urls: articlePublicUrls(slug),
      note: 'The draft is private. It is not on the site, in the sitemap, or reachable by URL.',
    },
  }
}

/**
 * Pull the three non-field arguments out of a create payload.
 *
 * `sourceRef` and `slug` are arguments *about* the article rather than fields
 * *of* it, so they are removed before the allowlist check -- otherwise every
 * create would be rejected for sending fields that are not in
 * BLOG_WRITABLE_FIELDS.
 */
function splitCreateInput(input: Record<string, unknown>): {
  fields: Record<string, unknown>
  sourceRef?: string
  slug: unknown
} {
  const { sourceRef, slug, ...fields } = input

  if (sourceRef !== undefined && (typeof sourceRef !== 'string' || sourceRef.length > 300)) {
    throw new McpValidationError('INVALID_REQUEST', [
      'sourceRef must be a string of at most 300 characters, such as a Google Drive file id.',
    ])
  }

  return {
    fields,
    sourceRef: typeof sourceRef === 'string' && sourceRef.trim() ? sourceRef.trim() : undefined,
    slug,
  }
}

// ── update_blog_content ────────────────────────────────────────────────────

export async function updateBlogContent(
  input: Record<string, unknown>,
  ctx: ToolContext
): Promise<McpToolResult> {
  const { id, expectedUpdatedAt, ...rawFields } = input

  if (typeof id !== 'string' || !id.trim()) {
    throw new McpValidationError('INVALID_REQUEST', ['id is required.'])
  }
  if (typeof expectedUpdatedAt !== 'string' || !expectedUpdatedAt.trim()) {
    throw new McpValidationError('INVALID_REQUEST', [
      'expectedUpdatedAt is required. Read the article with get_content first and pass back ' +
        'its updatedAt value, so a concurrent edit is detected instead of overwritten.',
    ])
  }
  if (Object.keys(rawFields).length === 0) {
    throw new McpValidationError('INVALID_REQUEST', ['No fields to update were supplied.'])
  }

  const { fields, warnings } = parseFieldPayload(
    rawFields,
    BLOG_WRITABLE_FIELDS,
    'update_blog_content',
    getIssuer()
  )

  // A slug change moves a live URL. Refusing it on a published article is not
  // a technical limit -- it is that redirecting the old URL is a decision with
  // SEO consequences, and this integration has no way to create a redirect.
  const current = await getArticleAdmin(id.trim())
  if (!current) {
    throw new McpValidationError('NOT_FOUND', [`No blog article with id "${id}".`])
  }
  if (
    typeof fields.slug === 'string' &&
    fields.slug !== current.slug &&
    current.status === 'published'
  ) {
    throw new McpValidationError('FORBIDDEN', [
      `This article is published at "${articlePublicUrl(current.slug)}". Changing its slug ` +
        'would break that URL with no redirect. Change it in the admin panel if that is intended.',
    ])
  }
  if (typeof fields.slug === 'string' && fields.slug !== current.slug) {
    const taken = await findArticleBySlugAdmin(fields.slug, id.trim())
    if (taken) {
      throw new McpValidationError('CONFLICT', [
        `The slug "${fields.slug}" is already used by article ${taken.id}.`,
      ])
    }
  }

  const before = await getArticleRawAdmin(id.trim())

  const outcome = await updateArticleFieldsAdmin(id.trim(), fields, {
    expectedUpdatedAt: expectedUpdatedAt.trim(),
    actor: ctx.auth.email,
  })

  if (!outcome.ok) {
    if (outcome.reason === 'not_found') {
      throw new McpValidationError('NOT_FOUND', [`No blog article with id "${id}".`])
    }
    return {
      ok: false,
      errorCode: 'CONFLICT',
      contentId: id.trim(),
      contentType: 'blog_article',
      updatedAt: outcome.currentUpdatedAt,
      errors: [
        'This article changed since you read it, so nothing was written. Somebody edited it in ' +
          'the admin panel, or an earlier call of yours succeeded.',
      ],
    }
  }

  if (before) {
    await snapshotArticleRevision(id.trim(), before, {
      actor: ctx.auth.email,
      requestId: ctx.requestId,
      via: 'mcp',
    })
  }

  await recordAudit({
    action: 'update_blog_content',
    contentType: 'blog_article',
    contentId: id.trim(),
    actor: ctx.auth.email,
    changedFields: changedFieldNames(before, fields),
    via: 'mcp',
    requestId: ctx.requestId,
  })

  const slug = typeof fields.slug === 'string' ? fields.slug : current.slug

  return {
    ok: true,
    contentId: id.trim(),
    contentType: 'blog_article',
    status: current.status,
    url: articlePublicUrl(slug),
    updatedAt: outcome.updatedAt,
    warnings,
    data: { updatedFields: Object.keys(fields).sort() },
  }
}

// ── update_category_seo ────────────────────────────────────────────────────

export async function updateCategorySeo(
  input: Record<string, unknown>,
  ctx: ToolContext
): Promise<McpToolResult> {
  const { id, expectedUpdatedAt, ...rawFields } = input

  if (typeof id !== 'string' || !id.trim()) {
    throw new McpValidationError('INVALID_REQUEST', ['id is required.'])
  }
  if (Object.keys(rawFields).length === 0) {
    throw new McpValidationError('INVALID_REQUEST', ['No fields to update were supplied.'])
  }

  const { fields, warnings } = parseFieldPayload(
    rawFields,
    CATEGORY_WRITABLE_FIELDS,
    'update_category_seo',
    getIssuer()
  )

  // Existence is checked before the write and reported distinctly from a
  // permission failure: this tool cannot create a category, and a model that
  // guessed an id should be told the id is wrong rather than that it lacks
  // permission.
  const category = await getCategoryAdmin(id.trim())
  if (!category) {
    throw new McpValidationError('NOT_FOUND', [
      `No category with id "${id}". This tool edits existing categories only — it cannot ` +
        'create one. Use search_content to find the right id.',
    ])
  }

  const before = await getCategoryRawAdmin(id.trim())

  const outcome = await updateCategorySeoAdmin(id.trim(), fields, {
    expectedUpdatedAt:
      typeof expectedUpdatedAt === 'string' && expectedUpdatedAt.trim()
        ? expectedUpdatedAt.trim()
        : undefined,
    actor: ctx.auth.email,
  })

  if (!outcome.ok) {
    if (outcome.reason === 'not_found') {
      throw new McpValidationError('NOT_FOUND', [`No category with id "${id}".`])
    }
    return {
      ok: false,
      errorCode: 'CONFLICT',
      contentId: id.trim(),
      contentType: 'category',
      updatedAt: outcome.currentUpdatedAt,
      errors: ['This category changed since you read it, so nothing was written.'],
    }
  }

  await recordAudit({
    action: 'update_category_seo',
    contentType: 'category',
    contentId: id.trim(),
    actor: ctx.auth.email,
    changedFields: changedFieldNames(before, fields),
    via: 'mcp',
    requestId: ctx.requestId,
  })

  return {
    ok: true,
    contentId: id.trim(),
    contentType: 'category',
    url: categoryPublicUrl(String(category.path ?? '')),
    updatedAt: outcome.updatedAt,
    warnings,
    data: {
      updatedFields: Object.keys(fields).sort(),
      path: category.path,
      note:
        'Category structure, visibility, ordering and product assignments are not reachable ' +
        'through this tool and were not touched.',
    },
  }
}

// ── upload_article_image ───────────────────────────────────────────────────

export async function uploadArticleImage(
  input: Record<string, unknown>,
  ctx: ToolContext
): Promise<McpToolResult> {
  if (!consumeUpload(ctx.auth.email)) {
    throw new McpValidationError('RATE_LIMITED', [
      'Too many uploads in the last minute. Wait and retry.',
    ])
  }

  const altHe = typeof input.altHe === 'string' ? input.altHe.trim() : ''
  const altEn = typeof input.altEn === 'string' ? input.altEn.trim() : ''

  // Alt text is mandatory rather than optional. These images go on pages
  // published specifically to be found, and an image with no alt text is both
  // an accessibility defect and a wasted SEO signal. Requiring it at upload
  // time is the only point where the person who knows what the image shows is
  // still in the loop.
  if (!altHe || !altEn) {
    throw new McpValidationError('INVALID_REQUEST', [
      'altHe and altEn are both required: describe what the image shows, in Hebrew and English.',
    ])
  }
  if (altHe.length > 300 || altEn.length > 300) {
    throw new McpValidationError('INVALID_REQUEST', [
      'Alt text must be at most 300 characters.',
    ])
  }

  const imported = await importArticleImage({
    imageBase64: typeof input.imageBase64 === 'string' ? input.imageBase64 : undefined,
    mimeType: typeof input.mimeType === 'string' ? input.mimeType : undefined,
    sourceUrl: typeof input.sourceUrl === 'string' ? input.sourceUrl : undefined,
  })

  await recordAudit({
    action: 'upload_article_image',
    contentType: 'image',
    contentId: imported.storagePath,
    actor: ctx.auth.email,
    changedFields: [],
    via: 'mcp',
    requestId: ctx.requestId,
  })

  return {
    ok: true,
    contentType: 'image',
    contentId: imported.storagePath,
    url: imported.url,
    warnings: imported.reused
      ? ['This exact image was already stored; the existing copy was reused.']
      : [],
    data: {
      storagePath: imported.storagePath,
      url: imported.url,
      contentType: imported.contentType,
      bytes: imported.bytes,
      alt: { he: altHe, en: altEn },
      usage:
        'Pass this url as featuredImage (with featuredImageAlt set to the alt text above), ' +
        'as ogImage, or in an <img src> inside the article content.',
    },
  }
}

// ── schedule_blog_post / unschedule_blog_post ──────────────────────────────

export async function scheduleBlogPost(
  input: Record<string, unknown>,
  ctx: ToolContext
): Promise<McpToolResult> {
  const id = typeof input.id === 'string' ? input.id.trim() : ''
  const publishAt = typeof input.publishAt === 'string' ? input.publishAt : ''
  const expectedUpdatedAt =
    typeof input.expectedUpdatedAt === 'string' ? input.expectedUpdatedAt.trim() : undefined

  if (!id) throw new McpValidationError('INVALID_REQUEST', ['id is required.'])

  const parsed = parseScheduleTime(publishAt)
  if (!parsed.ok) {
    throw new McpValidationError('INVALID_REQUEST', [parsed.error])
  }

  const article = await getArticleAdmin(id)
  if (!article) {
    throw new McpValidationError('NOT_FOUND', [`No blog article with id "${id}".`])
  }
  if (article.status === 'published') {
    throw new McpValidationError('CONFLICT', [
      'This article is already published. Re-scheduling it would take a live URL down; ' +
        'change it in the admin panel if that is intended.',
    ])
  }

  // Completeness is checked here and not at create time. A draft is allowed to
  // be half-finished; something queued to go live unattended is not, because by
  // the time the cron runs there is nobody to notice a missing meta description.
  const missing = validateReadyToPublish(article)
  if (missing.length > 0) {
    return {
      ok: false,
      errorCode: 'VALIDATION_FAILED',
      contentId: id,
      contentType: 'blog_article',
      status: article.status,
      updatedAt: article.updatedAt,
      errors: [
        'This article is not ready to publish, so it was not scheduled:',
        ...missing,
      ],
    }
  }

  const outcome = await setArticleScheduleAdmin(
    id,
    { status: 'scheduled', publishedAt: parsed.publishAtUtc },
    { expectedUpdatedAt, actor: ctx.auth.email }
  )

  if (!outcome.ok) {
    if (outcome.reason === 'not_found') {
      throw new McpValidationError('NOT_FOUND', [`No blog article with id "${id}".`])
    }
    return {
      ok: false,
      errorCode: 'CONFLICT',
      contentId: id,
      contentType: 'blog_article',
      updatedAt: outcome.currentUpdatedAt,
      errors: ['This article changed since you read it, so it was not scheduled.'],
    }
  }

  await recordAudit({
    action: 'schedule_blog_post',
    contentType: 'blog_article',
    contentId: id,
    actor: ctx.auth.email,
    changedFields: ['status', 'publishedAt'],
    via: 'mcp',
    requestId: ctx.requestId,
    statusFrom: outcome.statusFrom,
    statusTo: 'scheduled',
  })

  return {
    ok: true,
    contentId: id,
    contentType: 'blog_article',
    status: 'scheduled',
    publishAt: parsed.publishAtUtc,
    url: articlePublicUrl(article.slug),
    updatedAt: outcome.updatedAt,
    warnings: parsed.wasInPast
      ? [
          'The time you gave is in the past, so this will publish at the next scheduled check ' +
            '(within 15 minutes) rather than immediately.',
        ]
      : [],
    data: {
      urls: articlePublicUrls(article.slug),
      note:
        'The article is queued, not live. It becomes reachable at its scheduled time. ' +
        'Whether and when Google indexes it is separate and not controlled here.',
    },
  }
}

export async function unscheduleBlogPost(
  input: Record<string, unknown>,
  ctx: ToolContext
): Promise<McpToolResult> {
  const id = typeof input.id === 'string' ? input.id.trim() : ''
  if (!id) throw new McpValidationError('INVALID_REQUEST', ['id is required.'])

  const article = await getArticleAdmin(id)
  if (!article) {
    throw new McpValidationError('NOT_FOUND', [`No blog article with id "${id}".`])
  }
  if (article.status === 'published') {
    throw new McpValidationError('FORBIDDEN', [
      'This article is already published. Unpublishing a live URL is not something this ' +
        'integration can do; use the admin panel.',
    ])
  }
  if (article.status === 'draft') {
    return {
      ok: true,
      contentId: id,
      contentType: 'blog_article',
      status: 'draft',
      updatedAt: article.updatedAt,
      warnings: ['This article was already a draft; nothing changed.'],
    }
  }

  const outcome = await setArticleScheduleAdmin(
    id,
    { status: 'draft' },
    { actor: ctx.auth.email }
  )

  if (!outcome.ok) {
    throw new McpValidationError('CONFLICT', [
      'This article changed since you read it, so it was not unscheduled.',
    ])
  }

  await recordAudit({
    action: 'unschedule_blog_post',
    contentType: 'blog_article',
    contentId: id,
    actor: ctx.auth.email,
    changedFields: ['status'],
    via: 'mcp',
    requestId: ctx.requestId,
    statusFrom: outcome.statusFrom,
    statusTo: 'draft',
  })

  return {
    ok: true,
    contentId: id,
    contentType: 'blog_article',
    status: 'draft',
    updatedAt: outcome.updatedAt,
    data: { note: 'Back to a private draft. It will not publish until scheduled again.' },
  }
}

/** Re-exported so the route file has one import for every handler. */
export { toIsoString }
