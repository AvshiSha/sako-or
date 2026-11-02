/**
 * The complete field surface of the MCP SEO content integration.
 *
 * This file is the access control. Tool descriptions tell ChatGPT what it may
 * do; these lists decide what the server actually accepts, and every tool
 * checks against them before a read or a write. Nothing outside them is
 * reachable, and adding a field here is the only way to widen the integration.
 *
 * Two deliberate properties:
 *
 *   - Writable is a subset of readable, enforced by a test. A field that can be
 *     written but not read back would make conflict detection meaningless.
 *   - Unknown keys are an error, not something to drop. Silently ignoring an
 *     unrecognized field lets a caller believe a write landed when it did not,
 *     and hides the day a typo'd field name means an article is missing its
 *     meta description.
 */

/** The only content types this integration can see. Anything else is a validation error. */
export const MCP_CONTENT_TYPES = ['blog_article', 'category'] as const
export type McpContentType = (typeof MCP_CONTENT_TYPES)[number]

export function isMcpContentType(value: unknown): value is McpContentType {
  return typeof value === 'string' && (MCP_CONTENT_TYPES as readonly string[]).includes(value)
}

/**
 * Blog article fields the integration may read.
 *
 * `id`, `status`, `createdAt` and `updatedAt` are included because the caller
 * needs them: `updatedAt` is the conflict token, and status is how it knows
 * whether a draft is already scheduled.
 */
export const BLOG_READABLE_FIELDS = Object.freeze([
  'id',
  'slug',
  'title',
  'excerpt',
  'content',
  'featuredImage',
  'featuredImageAlt',
  'status',
  'publishedAt',
  'seoTitle',
  'seoDescription',
  'ogTitle',
  'ogDescription',
  'ogImage',
  'canonicalUrl',
  'sourceRef',
  'createdBy',
  'updatedBy',
  'lastEditedVia',
  'createdAt',
  'updatedAt',
] as const)

/**
 * Blog article fields the integration may write.
 *
 * Notably absent:
 *
 *   - `status` and `publishedAt`. Publication is a state transition, not a
 *     field edit: only schedule_blog_post and unschedule_blog_post move an
 *     article between states, and only the cron publishes it. Letting
 *     update_blog_content set status would hand it a publish button by the back
 *     door, which is exactly the decision this integration was scoped to avoid.
 *   - `sourceRef`. Set once on create and then immutable -- it is the
 *     idempotency key, and a caller that could rewrite it could create the
 *     duplicate the key exists to prevent.
 *   - `relatedProductsCarousel`. It selects which products appear beside the
 *     article, which is merchandising, not editorial.
 *   - `createdBy`, `updatedBy`, `lastEditedVia`, `createdAt`, `updatedAt`. The
 *     server stamps all five. A caller that could write them could forge the
 *     audit trail and defeat conflict detection in the same call.
 */
export const BLOG_WRITABLE_FIELDS = Object.freeze([
  'slug',
  'title',
  'excerpt',
  'content',
  'featuredImage',
  'featuredImageAlt',
  'seoTitle',
  'seoDescription',
  'ogTitle',
  'ogDescription',
  'ogImage',
  'canonicalUrl',
] as const)

/**
 * Category fields the integration may read.
 *
 * `name`, `path`, `slug` and `level` are read-only context -- the specialist
 * needs to know which category she is editing and what its URL is. Everything
 * structural or commercial is absent: `isEnabled`, `sortOrder`, `parentId`, and
 * the separate categoryMerchandising and banners documents are not reachable
 * through any tool here.
 */
export const CATEGORY_READABLE_FIELDS = Object.freeze([
  'id',
  'name',
  'slug',
  'path',
  'level',
  'contentTitle',
  'seoTitle',
  'seoDescription',
  'seoContent',
  'description',
  'image',
  'updatedAt',
] as const)

/**
 * Category fields the integration may write: the six agreed editorial/SEO
 * fields and nothing else.
 *
 * `image` is additionally constrained at validation time to a URL inside the
 * content-media prefix, so this cannot be used to point a category's social
 * preview at an arbitrary host or at a product photo.
 *
 * Category *structure* is untouchable by design: no slug, no path, no parentId,
 * no level, no isEnabled, no sortOrder, no name. The integration can only
 * change what a category says, never where it sits, whether it is visible, or
 * which products are in it.
 */
export const CATEGORY_WRITABLE_FIELDS = Object.freeze([
  'contentTitle',
  'seoTitle',
  'seoDescription',
  'seoContent',
  'description',
  'image',
] as const)

export type BlogWritableField = (typeof BLOG_WRITABLE_FIELDS)[number]
export type CategoryWritableField = (typeof CATEGORY_WRITABLE_FIELDS)[number]

/**
 * Fields whose value is a {he, en} pair rather than a plain string. Used by the
 * validators so a caller passing a bare string to a localized field gets a
 * clear error instead of a half-written document.
 */
export const LOCALIZED_FIELDS = Object.freeze([
  'title',
  'excerpt',
  'content',
  'featuredImageAlt',
  'seoTitle',
  'seoDescription',
  'ogTitle',
  'ogDescription',
  'contentTitle',
  'seoContent',
  'name',
  'description',
] as const)

export function isLocalizedField(field: string): boolean {
  return (LOCALIZED_FIELDS as readonly string[]).includes(field)
}

/**
 * Fields carrying rich HTML, which get the full CMS sanitizer. Everything else
 * localized is either an inline heading (sanitizeInlineHtml) or plain text
 * (cmsHtmlToPlainText) -- see lib/mcp/validation.ts.
 */
export const RICH_HTML_FIELDS = Object.freeze(['content', 'seoContent'] as const)

/** Inline-HTML fields: emphasis and links only, no block structure. */
export const INLINE_HTML_FIELDS = Object.freeze(['title', 'contentTitle'] as const)

export function readableFieldsFor(type: McpContentType): readonly string[] {
  return type === 'blog_article' ? BLOG_READABLE_FIELDS : CATEGORY_READABLE_FIELDS
}

export function writableFieldsFor(type: McpContentType): readonly string[] {
  return type === 'blog_article' ? BLOG_WRITABLE_FIELDS : CATEGORY_WRITABLE_FIELDS
}

/**
 * The Firebase Storage prefix MCP uploads live under, and the only prefix a
 * field like `image` or `featuredImage` may point into.
 *
 * Separate from the existing `blog/` and `categories/` prefixes used by the
 * admin editor so that an MCP credential cannot overwrite media an admin
 * uploaded, and so the blast radius of this integration is one folder.
 */
export const CONTENT_MEDIA_PREFIX = 'content/news/'

/** The bucket MCP media lives in, matching next.config.ts remotePatterns. */
export const STORAGE_HOST = 'firebasestorage.googleapis.com'
