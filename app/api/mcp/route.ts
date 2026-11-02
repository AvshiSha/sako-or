import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createMcpHandler, withMcpAuth } from 'mcp-handler'
import { z } from 'zod4'

import {
  requireAuthContext,
  requireWriteScope,
  verifyMcpToken,
  type McpAuthContext,
} from '@/lib/mcp/auth'
import { MCP_PATHS, getIssuer } from '@/lib/mcp/oauth/config'
import { consumeToolCall } from '@/lib/mcp/rate-limit'
import { runTool, type McpToolResult } from '@/lib/mcp/responses'
import { McpValidationError } from '@/lib/mcp/validation'
import { getContent, searchContent } from '@/lib/mcp/tools/read-tools'
import {
  createBlogDraft,
  scheduleBlogPost,
  unscheduleBlogPost,
  updateBlogContent,
  updateCategorySeo,
  uploadArticleImage,
} from '@/lib/mcp/tools/write-tools'
import { isMcpEnabled } from '@/lib/server/content-role'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
/** Image imports fetch and store megabytes; the default 10s is not enough. */
export const maxDuration = 60

/**
 * The MCP endpoint for the SEO content workflow.
 *
 * Streamable HTTP, stateless -- mcp-handler v2 serves the 2026-07-28 protocol
 * natively with no session store, which is why this needs no Redis.
 *
 * Tool schemas are declared with zod 4 (aliased as `zod4`, since the app itself
 * is on zod 3 and will stay there) because the SDK takes Standard Schema. They
 * are a hint to the model about what to send. Every one of them is validated
 * again inside the handler with the app's own zod 3 and the field allowlists in
 * lib/mcp/field-allowlist.ts -- the declaration is documentation, the handler
 * is the access control, and keeping them in different libraries makes that
 * split impossible to blur.
 *
 * `readOnlyHint` is what makes ChatGPT prompt for confirmation: a tool without
 * it is treated as a write, so only the two read tools carry it. The five write
 * tools are confirmed in the conversation every time, which is ChatGPT's
 * behaviour and cannot be turned off from here.
 */

/**
 * The three field-bearing write tools declare `z.looseObject`, not `z.object`.
 *
 * A plain zod object **strips** keys it does not know, and the SDK validates
 * arguments against the declared schema before the handler sees them. With
 * `z.object` a payload of `{ seoTitle: {...}, status: 'published' }` therefore
 * had `status` removed in transit: the write applied `seoTitle`, the
 * publication gate correctly held, and the call returned `ok: true` with no
 * indication that anything had been dropped. Safe, but a model that asked to
 * publish got a success back.
 *
 * `looseObject` passes unknown keys through to the handler, where
 * `rejectUnknownFields` fails the whole call and names both the offending field
 * and the writable set. The allowlist in lib/mcp/field-allowlist.ts is the
 * access control either way; this is what makes the refusal visible instead of
 * silent.
 */

/** Shared localized-field schema. Both languages optional so one can be filled at a time. */
const localized = z
  .object({
    he: z.string().describe('Hebrew text.').optional(),
    en: z.string().describe('English text.').optional(),
  })
  .describe('A Hebrew/English pair. Supply at least one language.')

const BLOG_FIELD_SCHEMA = {
  title: localized.optional().describe('Article headline. Inline markup only (links, emphasis).'),
  excerpt: localized
    .optional()
    .describe('Short summary, plain text. Used as the meta-description fallback and on cards.'),
  content: localized
    .optional()
    .describe(
      'Article body as HTML. Allowed: p, h2, h3, ul/ol/li, a, strong, em, u, blockquote, hr, ' +
        'img, table and YouTube iframes. Anything else is stripped. Hebrew text is kept as-is; ' +
        'do not add dir attributes — the page handles direction.'
    ),
  featuredImage: z
    .string()
    .optional()
    .describe('URL returned by upload_article_image. No other host is accepted.'),
  featuredImageAlt: localized
    .optional()
    .describe('Alt text for the featured image, in both languages.'),
  seoTitle: localized.optional().describe('Meta title. Aim for 45-60 characters including " | SAKO-OR".'),
  seoDescription: localized.optional().describe('Meta description. Aim for 140-160 characters.'),
  ogTitle: localized.optional().describe('Open Graph title. Defaults to seoTitle when empty.'),
  ogDescription: localized.optional().describe('Open Graph description.'),
  ogImage: z
    .string()
    .optional()
    .describe('Social preview image URL from upload_article_image. Defaults to featuredImage.'),
  canonicalUrl: z
    .string()
    .optional()
    .describe(
      'Only to point this article at another page on this site. Must be a path or a URL on ' +
        'this domain. Pass "" to clear it. Leave unset for a normal article.'
    ),
}

function mcpDisabled(): NextResponse {
  return new NextResponse(null, { status: 404 })
}

/**
 * Per-call preamble shared by every tool.
 *
 * Rate limited per subject so one client cannot multiply its budget by
 * spreading calls across tools.
 *
 * Everything that can refuse a call -- missing auth context, rate limit, and
 * for a write tool the scope check -- runs *inside* runTool, so a refusal comes
 * back as the same structured envelope as a validation failure. Before this was
 * restructured, requireWriteScope threw outside the wrapper: the SDK caught it
 * and produced a bare error with no `structuredContent` and no errorCode, so a
 * client could read the message but not the machine-readable reason.
 */
function begin(authInfo: Parameters<typeof requireAuthContext>[0], requestId: string) {
  const auth = requireAuthContext(authInfo)
  if (!consumeToolCall(auth.email)) {
    throw new McpValidationError('RATE_LIMITED', [
      'Too many tool calls in the last minute. Wait and retry.',
    ])
  }
  return { auth, requestId }
}

type ToolRunner = (context: { auth: McpAuthContext; requestId: string }) => Promise<McpToolResult>

/** A read tool: auth context plus the rate limit. */
function runReadTool(
  toolName: string,
  authInfo: Parameters<typeof requireAuthContext>[0],
  run: ToolRunner
) {
  const requestId = randomUUID()
  return runTool(toolName, requestId, () => run(begin(authInfo, requestId)))
}

/** A write tool: the same, plus content:write. */
function runWriteTool(
  toolName: string,
  authInfo: Parameters<typeof requireAuthContext>[0],
  run: ToolRunner
) {
  const requestId = randomUUID()
  return runTool(toolName, requestId, () => {
    const context = begin(authInfo, requestId)
    requireWriteScope(context.auth)
    return run(context)
  })
}

const handler = createMcpHandler(
  (server) => {
    // ── Read ───────────────────────────────────────────────────────────────

    server.registerTool(
      'search_content',
      {
        title: 'Search SAKO-OR content',
        description:
          'Search the blog articles and product categories you may edit. Returns ids, titles, ' +
          'status and public URLs. This is the only way to discover a contentId — ids are not ' +
          'guessable. Covers blog articles and categories only; it cannot see products, orders, ' +
          'customers or anything else on the site.',
        annotations: { readOnlyHint: true, openWorldHint: false },
        inputSchema: z.object({
          query: z
            .string()
            .optional()
            .describe('Hebrew or English substring to match against titles, slugs and paths. Omit to list everything.'),
          contentTypes: z
            .array(z.enum(['blog_article', 'category']))
            .optional()
            .describe('Narrow the search. Defaults to both.'),
          status: z
            .enum(['draft', 'scheduled', 'published'])
            .optional()
            .describe('Blog articles only.'),
        }),
      },
      async (args, ctx) => {
        return runReadTool('search_content', ctx.http?.authInfo, () =>
          searchContent(args as Record<string, unknown>)
        )
      }
    )

    server.registerTool(
      'get_content',
      {
        title: 'Get SAKO-OR content',
        description:
          'Read the editable fields of one blog article or category, plus its updatedAt. ' +
          'Always call this before an update: updatedAt is the conflict token that ' +
          'update_blog_content requires, and it is how a concurrent edit by a human gets ' +
          'detected instead of silently overwritten.',
        annotations: { readOnlyHint: true, openWorldHint: false },
        inputSchema: z.object({
          contentType: z.enum(['blog_article', 'category']),
          contentId: z.string().describe('Id from search_content.'),
        }),
      },
      async (args, ctx) => {
        return runReadTool('get_content', ctx.http?.authInfo, () =>
          getContent(args as Record<string, unknown>)
        )
      }
    )

    // ── Write ──────────────────────────────────────────────────────────────

    server.registerTool(
      'create_blog_draft',
      {
        title: 'Create a blog draft',
        description:
          'Create a new article as a private draft. It is not on the site, not in the sitemap ' +
          'and not reachable by URL until it is scheduled and its time arrives. ' +
          'Pass sourceRef (for example the Google Drive file id) so re-running an import ' +
          'returns the same article instead of creating a duplicate.',
        annotations: { destructiveHint: false, idempotentHint: false, openWorldHint: false },
        inputSchema: z.looseObject({
          slug: z
            .string()
            .describe(
              'URL segment: lowercase a-z, digits, single hyphens. Required and not derivable ' +
                'from a Hebrew title — choose a transliterated or English slug.'
            ),
          sourceRef: z
            .string()
            .optional()
            .describe('Stable reference to the source document. Makes retries safe.'),
          ...BLOG_FIELD_SCHEMA,
        }),
      },
      async (args, ctx) => {
        return runWriteTool('create_blog_draft', ctx.http?.authInfo, (context) =>
          createBlogDraft(args as Record<string, unknown>, context)
        )
      }
    )

    server.registerTool(
      'update_blog_content',
      {
        title: 'Update blog article fields',
        description:
          'Change specified fields of an article. Only the fields you pass are touched; ' +
          'everything else is left alone. Requires expectedUpdatedAt from get_content. ' +
          'This tool cannot change publication status — use schedule_blog_post for that.',
        annotations: { destructiveHint: false, idempotentHint: false, openWorldHint: false },
        inputSchema: z.looseObject({
          id: z.string(),
          expectedUpdatedAt: z
            .string()
            .describe('The updatedAt value from get_content. A mismatch aborts the write.'),
          slug: z
            .string()
            .optional()
            .describe('Changing the slug of a published article is refused — it would break a live URL.'),
          ...BLOG_FIELD_SCHEMA,
        }),
      },
      async (args, ctx) => {
        return runWriteTool('update_blog_content', ctx.http?.authInfo, (context) =>
          updateBlogContent(args as Record<string, unknown>, context)
        )
      }
    )

    server.registerTool(
      'update_category_seo',
      {
        title: 'Update category SEO text',
        description:
          'Edit the editorial and SEO text of an existing product category. Cannot create or ' +
          'delete a category, and cannot change its structure, visibility, ordering, slug, name ' +
          'or product assignments — those fields are rejected.',
        annotations: { destructiveHint: false, idempotentHint: true, openWorldHint: false },
        inputSchema: z.looseObject({
          id: z.string().describe('Category id from search_content.'),
          expectedUpdatedAt: z
            .string()
            .optional()
            .describe('Optional conflict token from get_content.'),
          contentTitle: localized
            .optional()
            .describe('H2 heading above the editorial block on the collection page.'),
          seoContent: localized
            .optional()
            .describe('Editorial HTML shown at the bottom of the collection page.'),
          seoTitle: localized.optional().describe('Meta title for the collection page.'),
          seoDescription: localized.optional().describe('Meta description for the collection page.'),
          description: localized
            .optional()
            .describe('Legacy field, not rendered on the page. Only a meta-description fallback.'),
          image: z
            .string()
            .optional()
            .describe('Social preview image URL from upload_article_image.'),
        }),
      },
      async (args, ctx) => {
        return runWriteTool('update_category_seo', ctx.http?.authInfo, (context) =>
          updateCategorySeo(args as Record<string, unknown>, context)
        )
      }
    )

    server.registerTool(
      'upload_article_image',
      {
        title: 'Upload an article image',
        description:
          'Store an image for use in an article or a category editorial block, and return its ' +
          'URL. Supply either imageBase64 (up to 3 MB of image) or sourceUrl (a publicly ' +
          'reachable https URL — a Google Drive link only works if the file is shared with ' +
          '"anyone with the link"). Hebrew and English alt text are both required. ' +
          'Identical images are stored once, so retrying is safe.',
        annotations: { destructiveHint: false, idempotentHint: true, openWorldHint: true },
        inputSchema: z.object({
          altHe: z.string().describe('What the image shows, in Hebrew. Required.'),
          altEn: z.string().describe('What the image shows, in English. Required.'),
          imageBase64: z
            .string()
            .optional()
            .describe('Base64 image data, or a data: URL. Up to 3 MB decoded.'),
          mimeType: z
            .enum(['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'])
            .optional()
            .describe('Required with imageBase64 unless a data: URL carries it. SVG is not accepted.'),
          sourceUrl: z
            .string()
            .optional()
            .describe('Public https URL to fetch instead. Private and internal addresses are refused.'),
        }),
      },
      async (args, ctx) => {
        return runWriteTool('upload_article_image', ctx.http?.authInfo, (context) =>
          uploadArticleImage(args as Record<string, unknown>, context)
        )
      }
    )

    server.registerTool(
      'schedule_blog_post',
      {
        title: 'Schedule a blog article',
        description:
          'Queue a draft to publish at a given time. publishAt is local Asia/Jerusalem time, ' +
          'e.g. "2026-11-05T09:00"; it is stored as UTC. The article is checked for required ' +
          'content first and is NOT scheduled if anything is missing — the response lists what. ' +
          'A past time publishes at the next check, within 15 minutes. ' +
          'This does not publish immediately and there is no tool that does: the site publishes ' +
          'scheduled articles on its own timer. Publication makes the URL live; it says nothing ' +
          'about whether or when a search engine will index it.',
        annotations: { destructiveHint: false, idempotentHint: true, openWorldHint: false },
        inputSchema: z.object({
          id: z.string(),
          publishAt: z
            .string()
            .describe('Local Asia/Jerusalem time, "YYYY-MM-DDTHH:mm", or a full ISO timestamp.'),
          expectedUpdatedAt: z.string().optional().describe('Optional conflict token from get_content.'),
        }),
      },
      async (args, ctx) => {
        return runWriteTool('schedule_blog_post', ctx.http?.authInfo, (context) =>
          scheduleBlogPost(args as Record<string, unknown>, context)
        )
      }
    )

    server.registerTool(
      'unschedule_blog_post',
      {
        title: 'Unschedule a blog article',
        description:
          'Return a scheduled article to a private draft so it will not publish. ' +
          'Refused for an article that is already published.',
        annotations: { destructiveHint: false, idempotentHint: true, openWorldHint: false },
        inputSchema: z.object({ id: z.string() }),
      },
      async (args, ctx) => {
        return runWriteTool('unschedule_blog_post', ctx.http?.authInfo, (context) =>
          unscheduleBlogPost(args as Record<string, unknown>, context)
        )
      }
    )
  },
  {
    serverInfo: { name: 'sako-or-seo-content', version: '1.0.0' },
    instructions:
      'SEO content tools for the SAKO-OR store. Scope: blog articles, the editorial/SEO text of ' +
      'existing product categories, and images for those. Nothing else on the site is reachable.\n\n' +
      'Workflow: search_content to find a record, get_content to read it and obtain its ' +
      'updatedAt, then create_blog_draft / update_blog_content / update_category_seo. Upload ' +
      'images with upload_article_image and use the URL it returns — no other image host is ' +
      'accepted. schedule_blog_post queues an article; the site publishes it on its own timer.\n\n' +
      'Content is Hebrew-first. Write Hebrew into the `he` field and English into `en`; do not ' +
      'add dir or lang attributes, the page handles direction. Slugs must be latin lowercase, ' +
      'so a Hebrew headline needs an explicitly chosen slug.\n\n' +
      'Always pass expectedUpdatedAt on an update. If it comes back as a CONFLICT, somebody ' +
      'edited the record in the admin panel: re-read it, merge, and retry — do not force the write.',
  }
)

/**
 * withMcpAuth turns a failed verifyMcpToken into a 401 with the RFC 9728
 * `WWW-Authenticate` challenge pointing at our protected-resource metadata,
 * which is how ChatGPT discovers where to send the user to authorize.
 *
 * `resourceUrl` is the ORIGIN, not the resource identifier: withMcpAuth builds
 * the challenge as `${resourceUrl}${resourceMetadataPath}`. Passing the full
 * `.../api/mcp` identifier here produced
 * `/api/mcp/.well-known/oauth-protected-resource`, which nothing serves -- a
 * client that followed the challenge would 404 and never find the
 * authorization server.
 *
 * It is pinned to the configured issuer rather than inferred from proxy
 * headers because on Vercel the inferred origin is whichever deployment URL the
 * request arrived on, and a preview hostname in the challenge would send the
 * client to an authorization server that does not know its client id.
 */
const authenticated = withMcpAuth(handler, verifyMcpToken, {
  required: true,
  resourceMetadataPath: '/.well-known/oauth-protected-resource',
  resourceUrl: getIssuer(),
})

async function route(request: Request): Promise<Response> {
  if (!isMcpEnabled()) return mcpDisabled()
  return authenticated(request)
}

export { route as GET, route as POST, route as DELETE }

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers':
        'Authorization, Content-Type, MCP-Protocol-Version, Mcp-Session-Id, Last-Event-ID',
      'Access-Control-Expose-Headers': 'Mcp-Session-Id, WWW-Authenticate',
      'Access-Control-Max-Age': '86400',
    },
  })
}

/** Referenced so the consent-page path stays in one place if the route moves. */
export const CONSENT_PATH = MCP_PATHS.consentPage
