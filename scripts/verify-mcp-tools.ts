/**
 * Verification of the authenticated MCP tool surface.
 *
 * Mints a short-lived access token directly through the store -- skipping the
 * email-OTP consent screen, which needs a human and an inbox -- and then drives
 * the real MCP protocol over HTTP with it. This is what proves the access
 * boundaries hold with a *valid* credential in hand, which is the case the
 * unit tests cannot reach: they check the allowlists as functions, this checks
 * that the server actually consults them.
 *
 * Reads are run by default and touch nothing. The write cases are opt-in
 * because they create a real (private, unpublished) draft in Firestore; the
 * script deletes what it created, and says so either way.
 *
 * Usage:
 *   npm run build && MCP_ENABLED=true npm start -- -p 3100     # terminal 1
 *   npx tsx scripts/verify-mcp-tools.ts                        # terminal 2
 *   npx tsx scripts/verify-mcp-tools.ts --write                # include writes
 *
 * Env:
 *   MCP_VERIFY_BASE_URL   default http://127.0.0.1:3100
 *   MCP_VERIFY_EMAIL      a configured content editor (must satisfy
 *                         MCP_CONTENT_EDITOR_EMAILS *and* users.role)
 */

import 'dotenv/config'

const BASE = (process.env.MCP_VERIFY_BASE_URL ?? 'http://127.0.0.1:3100').replace(/\/+$/, '')
const WRITE = process.argv.includes('--write')

/** Kept in one place so adding a tool fails in exactly one assertion, not three. */
const EXPECTED_TOOL_COUNT = 9

let passed = 0
let failed = 0
let skipped = 0

function pass(label: string, detail?: string) {
  passed++
  console.log(`  PASS  ${label}${detail ? ` — ${detail}` : ''}`)
}
function fail(label: string, detail: string) {
  failed++
  console.error(`  FAIL  ${label} — ${detail}`)
}
function skip(label: string, why: string) {
  skipped++
  console.log(`  SKIP  ${label} — ${why}`)
}
function section(name: string) {
  console.log(`\n${name}`)
}
function expect(condition: unknown, message: string): void {
  if (!condition) throw new Error(message)
}
/**
 * A solid-colour PNG of a given size, for the image-dimension cases.
 *
 * Generated rather than checked in as base64 constants: the interesting part is
 * the dimensions, and a handful of fixtures would be a handful of opaque blobs
 * nobody could tell apart. Noise is drawn into it so the encoder cannot
 * collapse every size to the same few bytes, which would make the
 * content-addressed store treat them as one image.
 */
async function makePng(width: number, height: number): Promise<Buffer> {
  const sharpLib = (await import('sharp')).default
  const pixels = Buffer.alloc(width * height * 3)
  for (let i = 0; i < pixels.length; i++) pixels[i] = (i * 31 + width * 7 + height) % 251
  return sharpLib(pixels, { raw: { width, height, channels: 3 } }).png().toBuffer()
}

async function check(label: string, fn: () => Promise<string | void>) {
  try {
    const detail = await fn()
    pass(label, detail || undefined)
  } catch (error) {
    fail(label, error instanceof Error ? error.message : String(error))
  }
}

// ── MCP client ─────────────────────────────────────────────────────────────

interface ToolOutcome {
  ok: boolean
  errorCode?: string
  errors?: string[]
  warnings?: string[]
  contentId?: string
  status?: string
  updatedAt?: string
  created?: boolean
  url?: string
  publishAt?: string
  data?: unknown
  rawText: string
}

/**
 * A minimal MCP client that speaks both protocol revisions.
 *
 * The distinction is not cosmetic and cost real debugging time, so it is
 * written down here:
 *
 *   - **2026-07-28 (modern, stateless).** No `initialize` handshake at all.
 *     Every request must instead carry a per-request `_meta` envelope naming
 *     the protocol version and the client. Sending `initialize` with a modern
 *     `MCP-Protocol-Version` header is a contradiction and the server rejects
 *     it with -32020.
 *   - **2025-06-18 (legacy).** The familiar `initialize` handshake, and the
 *     `MCP-Protocol-Version` header must be absent or name a 2025 revision.
 *
 * mcp-handler v2 serves the modern revision natively and keeps a compatibility
 * layer for the legacy one. Both are exercised, because which one ChatGPT
 * negotiates is its choice, not ours.
 */
const MODERN_PROTOCOL = '2026-07-28'
const LEGACY_PROTOCOL = '2025-06-18'

const META_PROTOCOL_VERSION = 'io.modelcontextprotocol/protocolVersion'
const META_CLIENT_INFO = 'io.modelcontextprotocol/clientInfo'
const META_CLIENT_CAPABILITIES = 'io.modelcontextprotocol/clientCapabilities'

const CLIENT_INFO = { name: 'verify-mcp-tools', version: '1.0.0' }

/** Joining tool content blocks for display. */
const NEWLINE = '\n'

class McpClient {
  private id = 0

  constructor(
    private readonly token: string,
    private readonly mode: 'modern' | 'legacy' = 'modern'
  ) {}

  private async rpc(method: string, params?: Record<string, unknown>): Promise<unknown> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      Authorization: `Bearer ${this.token}`,
    }

    let body: Record<string, unknown>
    if (this.mode === 'modern') {
      headers['MCP-Protocol-Version'] = MODERN_PROTOCOL
      // The stateless revision requires the method -- and, for tools/call, the
      // tool name -- in headers as well as the body, so an intermediary can
      // route and authorize without parsing JSON. The server rejects a
      // mismatch or an absence with -32020.
      headers['Mcp-Method'] = method
      const toolName = params?.name
      if (typeof toolName === 'string') headers['Mcp-Name'] = toolName
      body = {
        jsonrpc: '2.0',
        id: ++this.id,
        method,
        params: {
          ...(params ?? {}),
          // All three keys are required on every modern request. The server
          // rejects a partial envelope with -32602, which is correct per spec
          // and was how this client's framing got caught.
          _meta: {
            [META_PROTOCOL_VERSION]: MODERN_PROTOCOL,
            [META_CLIENT_INFO]: CLIENT_INFO,
            [META_CLIENT_CAPABILITIES]: {},
          },
        },
      }
    } else {
      body = { jsonrpc: '2.0', id: ++this.id, method, ...(params ? { params } : {}) }
    }

    const response = await fetch(`${BASE}/api/mcp`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })

    if (response.status === 401) throw new Error('401 Unauthorized')

    // Read the body exactly once: a Response body cannot be consumed twice, and
    // reading it inside an error message after parsing is a silent test bug.
    const text = await response.text()
    if (!response.ok) throw new Error(`HTTP ${response.status} from ${method}: ${text.slice(0, 400)}`)

    // Streamable HTTP may answer as SSE even for a single response.
    const payload =
      text.startsWith('event:') || text.startsWith('data:')
        ? JSON.parse(
            text
              .split(/\r?\n/)
              .filter((line) => line.startsWith('data:'))
              .map((line) => line.slice(5).trim())
              .join('')
          )
        : JSON.parse(text)

    if (payload.error) throw new Error(`JSON-RPC error: ${JSON.stringify(payload.error)}`)
    return payload.result
  }

  /** Legacy handshake only. The modern revision has none. */
  async initializeLegacy(): Promise<unknown> {
    return this.rpc('initialize', {
      protocolVersion: LEGACY_PROTOCOL,
      capabilities: {},
      clientInfo: CLIENT_INFO,
    })
  }

  /** The modern equivalent of initialize: server identity without a handshake. */
  async discover(): Promise<unknown> {
    return this.rpc('server/discover')
  }

  async listTools(): Promise<Array<{ name: string; annotations?: Record<string, unknown> }>> {
    const result = (await this.rpc('tools/list')) as {
      tools: Array<{ name: string; annotations?: Record<string, unknown> }>
    }
    return result.tools
  }

  async call(name: string, args: Record<string, unknown>): Promise<ToolOutcome> {
    const result = (await this.rpc('tools/call', { name, arguments: args })) as {
      content?: Array<{ type: string; text?: string }>
      structuredContent?: Record<string, unknown>
      isError?: boolean
    }
    const rawText = result.content?.map((c) => c.text ?? '').join(NEWLINE) ?? ''
    return { ...(result.structuredContent as object), rawText } as ToolOutcome
  }
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Verifying MCP tools at ${BASE}\n${'='.repeat(60)}`)

  const email = process.env.MCP_VERIFY_EMAIL
  if (!email) {
    console.error(
      '\nMCP_VERIFY_EMAIL is required: the address of a configured content editor.\n' +
        'It must be listed in MCP_CONTENT_EDITOR_EMAILS and carry users.role = CONTENT_EDITOR.'
    )
    process.exit(1)
  }

  // Imported lazily so the script can report a clean error above before
  // firebase-admin and Prisma are initialized.
  const { resolveContentRole } = await import('@/lib/server/content-role')
  const { issueTokens } = await import('@/lib/mcp/oauth/store')
  const { getResourceIdentifier } = await import('@/lib/mcp/oauth/config')

  const role = await resolveContentRole(email)
  if (!role) {
    console.error(
      `\n${email} is not an authorized content editor.\n` +
        'Both conditions must hold:\n' +
        '  1. MCP_CONTENT_EDITOR_EMAILS contains it, and\n' +
        '  2. its Prisma users.role is CONTENT_EDITOR.'
    )
    process.exit(1)
  }
  console.log(`Acting as ${role.email}`)

  const readWrite = await issueTokens({
    email: role.email,
    clientId: 'mcp_verification_script',
    scopes: ['content:read', 'content:write'],
    resource: getResourceIdentifier(),
    withRefresh: false,
  })
  const readOnly = await issueTokens({
    email: role.email,
    clientId: 'mcp_verification_script',
    scopes: ['content:read'],
    resource: getResourceIdentifier(),
    withRefresh: false,
  })

  const rw = new McpClient(readWrite.accessToken)
  const ro = new McpClient(readOnly.accessToken)

  let createdId: string | null = null
  let collectionId: string | null = null
  /** Storage paths this run uploaded, so the bucket is left as it was found. */
  const uploadedPaths = new Set<string>()

  try {
    // ── Protocol ──────────────────────────────────────────────────────────
    section('Protocol')

    await check('the modern stateless revision answers server/discover', async () => {
      const result = (await rw.discover()) as {
        supportedVersions?: string[]
        instructions?: string
        _meta?: Record<string, { name?: string }>
      }
      // In the 2026-07-28 revision serverInfo rides in the `_meta` envelope
      // rather than at the top level, which is where the legacy `initialize`
      // result puts it.
      const serverName = result._meta?.['io.modelcontextprotocol/serverInfo']?.name
      expect(
        result.supportedVersions?.includes(MODERN_PROTOCOL),
        `server does not advertise ${MODERN_PROTOCOL}: ${JSON.stringify(result.supportedVersions)}`
      )
      expect(serverName === 'sako-or-seo-content', `unexpected server "${serverName}"`)
      expect(Boolean(result.instructions), 'the server instructions should be advertised')
      return `${MODERN_PROTOCOL}: ${serverName}`
    })

    await check('the legacy 2025 handshake also works (compatibility layer)', async () => {
      // Which revision ChatGPT negotiates is its choice, so both must work.
      const legacy = new McpClient(readWrite.accessToken, 'legacy')
      const result = (await legacy.initializeLegacy()) as {
        serverInfo?: { name?: string }
        protocolVersion?: string
        instructions?: string
      }
      expect(
        result.serverInfo?.name === 'sako-or-seo-content',
        `unexpected server ${JSON.stringify(result.serverInfo)}`
      )
      expect(Boolean(result.instructions), 'the server instructions should be advertised')
      const tools = await legacy.listTools()
      expect(tools.length === EXPECTED_TOOL_COUNT, `legacy tools/list returned ${tools.length}`)
      return `${result.protocolVersion}: ${tools.length} tools`
    })

    let tools: Array<{ name: string; annotations?: Record<string, unknown> }> = []

    await check('exactly the expected nine tools are exposed', async () => {
      tools = await rw.listTools()
      const names = tools.map((t) => t.name).sort()
      const expected = [
        'create_blog_draft',
        'get_content',
        'list_product_collections',
        'schedule_blog_post',
        'search_content',
        'unschedule_blog_post',
        'update_blog_content',
        'update_category_seo',
        'upload_article_image',
      ]
      expect(
        expected.length === EXPECTED_TOOL_COUNT,
        'EXPECTED_TOOL_COUNT and this list disagree'
      )
      expect(
        JSON.stringify(names) === JSON.stringify(expected),
        `got ${JSON.stringify(names)}`
      )
      return names.join(', ')
    })

    await check('no tool exists for products, orders, users or raw queries', async () => {
      // `list_product_collections` is the one tool whose name contains a
      // forbidden word, and it is exempted by name rather than by loosening the
      // substring check: it reads which collections exist and how many live
      // products each holds, and nothing else in this surface may mention a
      // product at all. Exempting the word instead of the tool would let a
      // future `update_product_price` through.
      const names = tools.map((t) => t.name).filter((n) => n !== 'list_product_collections')
      for (const forbidden of [
        'query',
        'sql',
        'firestore',
        'exec',
        'fetch',
        'http',
        'product',
        'order',
        'customer',
        'user',
        'coupon',
        'price',
        'stock',
        'inventory',
        'settings',
        'deploy',
        'publish_blog_post',
      ]) {
        expect(
          !names.some((n) => n.toLowerCase().includes(forbidden)),
          `a tool name contains "${forbidden}": ${names.join(', ')}`
        )
      }
      return 'none of the forbidden shapes present'
    })

    await check('only the three read tools are marked read-only', async () => {
      // readOnlyHint is what makes ChatGPT prompt for confirmation; a write tool
      // wrongly marked read-only would be applied without asking.
      const readOnlyNames = tools
        .filter((t) => t.annotations?.readOnlyHint === true)
        .map((t) => t.name)
        .sort()
      expect(
        JSON.stringify(readOnlyNames) ===
          JSON.stringify(['get_content', 'list_product_collections', 'search_content']),
        `got ${JSON.stringify(readOnlyNames)}`
      )
      return readOnlyNames.join(', ')
    })

    // ── Reads ─────────────────────────────────────────────────────────────
    section('Reads')

    await check('search_content returns only permitted content types', async () => {
      const result = await rw.call('search_content', {})
      expect(result.ok, `search failed: ${result.rawText}`)
      const data = result.data as { results: Array<{ contentType: string }> }
      for (const hit of data.results) {
        expect(
          ['blog_article', 'category'].includes(hit.contentType),
          `unexpected content type ${hit.contentType}`
        )
      }
      return `${data.results.length} result(s)`
    })

    await check('search_content rejects an unpermitted content type', async () => {
      const result = await rw.call('search_content', { contentTypes: ['products'] })
      expect(!result.ok, 'should have been rejected')
      return result.errorCode ?? 'rejected'
    })

    await check('get_content rejects an unpermitted content type', async () => {
      for (const contentType of ['product', 'order', 'user', 'coupon', 'campaign']) {
        const result = await rw.call('get_content', { contentType, contentId: 'anything' })
        expect(!result.ok, `${contentType} should have been rejected`)
      }
      return 'product, order, user, coupon, campaign all refused'
    })

    await check('get_content on an id from another collection is NOT_FOUND, not a leak', async () => {
      // A real product id, fetched from the public API, asked for as an article.
      const products = await fetch(`${BASE}/api/products?limit=1`).then(
        (r) => (r.ok ? r.json() : null),
        () => null
      )
      const productId =
        (Array.isArray(products) ? products[0]?.id : products?.products?.[0]?.id) ?? 'unknown-id'

      const result = await rw.call('get_content', {
        contentType: 'blog_article',
        contentId: String(productId),
      })
      expect(!result.ok, 'a product id must not resolve as an article')
      expect(result.errorCode === 'NOT_FOUND', `expected NOT_FOUND, got ${result.errorCode}`)
      const serialized = JSON.stringify(result)
      expect(!/price|sku|stock|inventory/i.test(serialized), 'the response leaked product data')
      return `product id ${String(productId).slice(0, 12)}… → NOT_FOUND`
    })

    await check('a category read exposes no structural or commercial fields', async () => {
      const search = await rw.call('search_content', { contentTypes: ['category'] })
      const hits = (search.data as { results: Array<{ contentId: string }> }).results
      if (hits.length === 0) return 'no categories to read'

      const result = await rw.call('get_content', {
        contentType: 'category',
        contentId: hits[0].contentId,
      })
      expect(result.ok, `read failed: ${result.rawText}`)
      const fields = (result.data as { fields: Record<string, unknown> }).fields
      for (const forbidden of ['isEnabled', 'sortOrder', 'parentId', 'banners', 'merchandising']) {
        expect(!(forbidden in fields), `${forbidden} was returned`)
      }
      return `returned: ${Object.keys(fields).sort().join(', ')}`
    })

    // ── Scope enforcement ─────────────────────────────────────────────────
    // ── Product collections ───────────────────────────────────────────────
    section('Product collections')

    await check('list_product_collections returns ids, both locales and a live count', async () => {
      const result = await rw.call('list_product_collections', { query: 'boots' })
      expect(result.ok, `list failed: ${result.rawText}`)
      const data = result.data as {
        results: Array<{
          collectionId: string
          categoryIds: string[]
          path: string
          title: { he: string; en: string }
          urls: { he: string; en: string }
          liveProducts?: number | string
        }>
      }
      expect(data.results.length > 0, 'no collection matched "boots"')

      const boots = data.results.find((c) => c.path === 'women/shoes/boots')
      expect(Boolean(boots), `women/shoes/boots not in ${data.results.map((c) => c.path).join(', ')}`)
      expect(Boolean(boots!.title.he), 'the Hebrew title is empty')
      expect(Boolean(boots!.title.en), 'the English title is empty')
      expect(boots!.urls.he.includes('/he/collection/women/shoes/boots'), `bad he URL: ${boots!.urls.he}`)
      expect(boots!.urls.en.includes('/en/collection/women/shoes/boots'), `bad en URL: ${boots!.urls.en}`)

      // The chain, not the id. This is the field the storefront queries on, and
      // a leaf id alone would select nothing.
      expect(
        boots!.categoryIds.length === 3 &&
          boots!.categoryIds[boots!.categoryIds.length - 1] === boots!.collectionId,
        `expected a 3-link chain ending at the leaf, got ${JSON.stringify(boots!.categoryIds)}`
      )
      collectionId = boots!.collectionId
      return `${boots!.path} (${boots!.title.he} / ${boots!.title.en}), ${boots!.liveProducts} live products`
    })

    await check('a Hebrew query finds the same collection', async () => {
      const result = await rw.call('list_product_collections', { query: 'מגפיים' })
      expect(result.ok, `list failed: ${result.rawText}`)
      const data = result.data as { results: Array<{ collectionId: string; path: string }> }
      expect(
        data.results.some((c) => c.collectionId === collectionId),
        `Hebrew search missed it: ${data.results.map((c) => c.path).join(', ')}`
      )
      return `matched ${data.results.length} collection(s)`
    })

    await check('the collection listing carries no product detail', async () => {
      // Only a count crosses this boundary. A name, price or stock level here
      // would be a product read surface that nothing asked for.
      const result = await rw.call('list_product_collections', {})
      const raw = JSON.stringify(result.data)
      for (const leaked of ['price', 'sku', 'stock', 'inventory', 'salePrice', 'barcode']) {
        expect(!raw.toLowerCase().includes(leaked.toLowerCase()), `"${leaked}" appeared in the listing`)
      }
      return 'counts only'
    })

    section('Scope enforcement')

    await check('a read-only token can read', async () => {
      const result = await ro.call('search_content', {})
      expect(result.ok, `read failed with a read-only token: ${result.rawText}`)
      return 'search_content allowed'
    })

    await check('a read-only token is refused by every write tool', async () => {
      const attempts: Array<[string, Record<string, unknown>]> = [
        ['create_blog_draft', { slug: 'scope-probe' }],
        ['update_blog_content', { id: 'x', expectedUpdatedAt: 'x', title: { en: 'x' } }],
        ['update_category_seo', { id: 'x', seoTitle: { en: 'x' } }],
        ['upload_article_image', { altHe: 'x', altEn: 'x', sourceUrl: 'https://example.com/a.png' }],
        ['schedule_blog_post', { id: 'x', publishAt: '2026-12-01T09:00' }],
        ['unschedule_blog_post', { id: 'x' }],
      ]
      for (const [name, args] of attempts) {
        const result = await ro.call(name, args)
        expect(!result.ok, `${name} succeeded with a read-only token`)
        expect(
          result.errorCode === 'FORBIDDEN',
          `${name} gave ${result.errorCode} rather than FORBIDDEN`
        )
      }
      return 'all six write tools refused'
    })

    // ── Forbidden fields, with a valid write token ────────────────────────
    section('Forbidden fields (valid write token)')

    await check('update_blog_content cannot set status', async () => {
      const result = await rw.call('update_blog_content', {
        id: 'any',
        expectedUpdatedAt: 'any',
        status: 'published',
      })
      expect(!result.ok, 'should have been rejected')
      expect(
        result.errorCode === 'FORBIDDEN_FIELD',
        `expected FORBIDDEN_FIELD, got ${result.errorCode}`
      )
      return 'status refused'
    })

    await check('update_blog_content cannot set publishedAt or the audit fields', async () => {
      for (const field of ['publishedAt', 'sourceRef', 'createdBy', 'updatedBy', 'lastEditedVia']) {
        const result = await rw.call('update_blog_content', {
          id: 'any',
          expectedUpdatedAt: 'any',
          [field]: 'x',
        })
        expect(!result.ok, `${field} should have been rejected`)
        expect(result.errorCode === 'FORBIDDEN_FIELD', `${field} gave ${result.errorCode}`)
      }
      return 'all five refused'
    })

    await check('update_category_seo cannot touch structure or visibility', async () => {
      for (const field of ['isEnabled', 'slug', 'parentId', 'sortOrder', 'path', 'name', 'level']) {
        const result = await rw.call('update_category_seo', { id: 'any', [field]: 'x' })
        expect(!result.ok, `${field} should have been rejected`)
        expect(result.errorCode === 'FORBIDDEN_FIELD', `${field} gave ${result.errorCode}`)
      }
      return 'all seven refused'
    })

    await check('update_blog_content requires a conflict token', async () => {
      const result = await rw.call('update_blog_content', { id: 'any', title: { en: 'x' } })
      expect(!result.ok, 'should have been rejected')
      expect(/expectedUpdatedAt/.test(result.rawText), `unexpected message: ${result.rawText}`)
      return 'expectedUpdatedAt enforced'
    })

    await check('a featured image outside the content-media folder is refused', async () => {
      for (const url of [
        'https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/products%2FSKU%2Fa.jpg?alt=media',
        'https://evil.test/a.jpg',
      ]) {
        const result = await rw.call('update_blog_content', {
          id: 'any',
          expectedUpdatedAt: 'any',
          featuredImage: url,
        })
        expect(!result.ok, `${url} should have been rejected`)
      }
      return 'product media and external hosts both refused'
    })

    await check('an SSRF target is refused by upload_article_image', async () => {
      for (const sourceUrl of [
        'https://169.254.169.254/latest/meta-data/',
        'http://localhost/a.png',
        'https://10.0.0.1/a.png',
        'file:///etc/passwd',
      ]) {
        const result = await rw.call('upload_article_image', {
          altHe: 'בדיקה',
          altEn: 'probe',
          sourceUrl,
        })
        expect(!result.ok, `${sourceUrl} should have been rejected`)
      }
      return 'metadata, loopback, private and file:// all refused'
    })

    await check('upload_article_image requires alt text in both languages', async () => {
      const result = await rw.call('upload_article_image', {
        altHe: 'רק עברית',
        altEn: '',
        sourceUrl: 'https://example.com/a.png',
      })
      expect(!result.ok, 'should have been rejected')
      expect(/altEn|both/.test(result.rawText), `unexpected message: ${result.rawText}`)
      return 'both languages enforced'
    })

    await check('a Hebrew-only slug is refused with an explanation', async () => {
      const result = await rw.call('create_blog_draft', { slug: 'מגפי-חורף' })
      expect(!result.ok, 'should have been rejected')
      expect(/latin|Hebrew/i.test(result.rawText), `unexpected message: ${result.rawText}`)
      return 'explained, not silently emptied'
    })

    // ── Consent -> code -> token ──────────────────────────────────────────
    section('The full authorization chain')

    await check('consent 303s to the callback and the code exchanges for a token', async () => {
      // The exact chain that failed on the first real connection: consent
      // succeeded, a code was issued, and no token was ever requested. Every
      // other test covered the pieces either side of this join. This one walks
      // it, skipping only the emailed OTP, which needs a human inbox.
      const { createHash, randomBytes } = await import('node:crypto')
      const { registerClient, createAuthRequest, markAuthRequestVerified } = await import(
        '@/lib/mcp/oauth/store'
      )
      const { getIssuer: issuer } = await import('@/lib/mcp/oauth/config')

      const verifier = randomBytes(32).toString('base64url')
      const challenge = createHash('sha256').update(verifier).digest('base64url')
      const redirectUri = 'https://chatgpt.com/connector_platform_oauth_redirect'

      const client = await registerClient({
        clientName: 'chain check',
        redirectUris: [redirectUri],
      })
      const requestId = await createAuthRequest({
        clientId: client.clientId,
        redirectUri,
        state: 'chain-state',
        codeChallenge: challenge,
        scopes: ['content:read', 'content:write', 'offline_access'],
        resource: `${issuer()}/api/mcp`,
      })
      // Stands in for the emailed six-digit code.
      await markAuthRequestVerified(requestId, role.email)

      // Approve exactly as the consent page now does: a form POST.
      const approve = await fetch(`${BASE}/api/mcp/oauth/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ request: requestId, decision: 'approve' }),
        redirect: 'manual',
      })
      expect(approve.status === 303, `approve should 303, got ${approve.status}`)

      const location = approve.headers.get('location') ?? ''
      const callback = new URL(location)
      expect(callback.origin === 'https://chatgpt.com', `wrong callback origin: ${callback.origin}`)
      expect(callback.searchParams.get('state') === 'chain-state', 'state was not echoed')
      const code = callback.searchParams.get('code') ?? ''
      expect(Boolean(code), 'no code on the callback URL')

      // RFC 9207. A client that sees the metadata flag refuses a response
      // without this, which is how the first two real connections died here.
      const sentIssuer = callback.searchParams.get('iss')
      expect(sentIssuer === issuer(), `iss was "${sentIssuer}", expected "${issuer()}"`)

      // Now the step that never happened in production.
      const tokenResponse = await fetch(`${BASE}/api/mcp/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          client_id: client.clientId,
          redirect_uri: redirectUri,
          code_verifier: verifier,
        }),
      })
      const tokenRaw = await tokenResponse.text()
      expect(tokenResponse.ok, `token exchange failed ${tokenResponse.status}: ${tokenRaw.slice(0, 300)}`)
      const tokens = JSON.parse(tokenRaw) as Record<string, string>
      expect(Boolean(tokens.access_token), 'no access_token')
      expect(Boolean(tokens.refresh_token), 'offline_access should yield a refresh token')

      // And the token actually works.
      const issued = new McpClient(tokens.access_token)
      const tools = await issued.listTools()
      expect(tools.length === EXPECTED_TOOL_COUNT, `the issued token saw ${tools.length} tools`)

      // Replaying the code must fail: single use.
      const replay = await fetch(`${BASE}/api/mcp/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          client_id: client.clientId,
          redirect_uri: redirectUri,
          code_verifier: verifier,
        }),
      })
      expect(replay.status === 400, `code replay should fail, got ${replay.status}`)

      return `303 -> code -> token -> ${tools.length} tools; replay refused`
    })

    await check('the authorization code lifetime leaves room for a real redirect', async () => {
      const { AUTH_CODE_TTL_MS } = await import('@/lib/mcp/oauth/config')
      // 60s broke the first real connection. RFC 6749 4.1.2 recommends a
      // maximum of ten minutes; anything under two is asking for the same bug.
      expect(
        AUTH_CODE_TTL_MS >= 2 * 60 * 1000 && AUTH_CODE_TTL_MS <= 10 * 60 * 1000,
        `AUTH_CODE_TTL_MS is ${AUTH_CODE_TTL_MS}ms`
      )
      return `${AUTH_CODE_TTL_MS / 1000}s`
    })

    // ── Token renewal ─────────────────────────────────────────────────────
    section('Token renewal')

    const { getIssuer } = await import('@/lib/mcp/oauth/config')
    const tokenUrl = `${getIssuer()}/api/mcp/oauth/token`

    let rotated: { access: string; refresh: string | null } | null = null

    await check('a refresh token exchanges for a fresh access token', async () => {
      // This is what keeps the connector working past the first hour without
      // the specialist signing in again. If it does not work, she has to
      // re-consent every hour and the daily workflow is not viable.
      const grant = await issueTokens({
        email: role.email,
        clientId: 'mcp_verification_script',
        scopes: ['content:read', 'content:write', 'offline_access'],
        resource: getResourceIdentifier(),
        withRefresh: true,
      })
      expect(Boolean(grant.refreshToken), 'offline_access should have produced a refresh token')

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: grant.refreshToken!,
          client_id: 'mcp_verification_script',
        }),
      })
      const raw = await response.text()
      expect(response.ok, `expected 200, got ${response.status}: ${raw.slice(0, 300)}`)
      const body = JSON.parse(raw) as Record<string, string>
      expect(Boolean(body.access_token), 'no access_token returned')
      expect(body.token_type === 'Bearer', `unexpected token_type ${body.token_type}`)
      expect(Boolean(body.refresh_token), 'rotation should return a NEW refresh token')
      expect(body.refresh_token !== grant.refreshToken, 'the refresh token was not rotated')

      rotated = { access: body.access_token, refresh: body.refresh_token }
      // Keep the spent one so the replay case below can present it.
      ;(globalThis as Record<string, unknown>).__spentRefresh = grant.refreshToken
      return `rotated, expires_in=${body.expires_in}s`
    })

    await check('the renewed access token works on the MCP endpoint', async () => {
      expect(Boolean(rotated), 'no rotated token to test')
      const renewed = new McpClient(rotated!.access)
      const result = await renewed.call('search_content', { contentTypes: ['category'] })
      expect(result.ok, `the renewed token was refused: ${result.rawText}`)
      return 'search_content succeeded with the renewed token'
    })

    await check('replaying a spent refresh token is refused and revokes the family', async () => {
      const spent = (globalThis as Record<string, unknown>).__spentRefresh as string
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: spent,
          client_id: 'mcp_verification_script',
        }),
      })
      expect(response.status === 400, `expected 400, got ${response.status}`)
      const body = (await response.json()) as Record<string, string>
      expect(body.error === 'invalid_grant', `unexpected error ${body.error}`)
      expect(/revoked/i.test(body.error_description ?? ''), 'should say the family was revoked')

      // And the rotated access token from that family must now be dead.
      const dead = new McpClient(rotated!.access)
      let refused = false
      try {
        await dead.call('search_content', {})
      } catch (error) {
        refused = /401/.test(String(error))
      }
      expect(refused, 'the replay should have revoked the whole family, including the access token')
      return 'replay refused, family revoked, sibling access token dead'
    })

    // ── Writes ────────────────────────────────────────────────────────────
    section('Write workflow')

    if (!WRITE) {
      skip('the create / update / schedule workflow', 'pass --write to run it (creates a private draft)')
    } else {
      // The token-renewal section deliberately revoked the earlier family, so
      // the write cases need a fresh credential.
      const fresh = await issueTokens({
        email: role.email,
        clientId: 'mcp_verification_script',
        scopes: ['content:read', 'content:write'],
        resource: getResourceIdentifier(),
        withRefresh: false,
      })
      const w = new McpClient(fresh.accessToken)

      const sourceRef = `verification-${Date.now()}`
      const slug = `mcp-verification-${Date.now()}`

      await check('create_blog_draft creates a private draft', async () => {
        const result = await w.call('create_blog_draft', {
          slug,
          sourceRef,
          title: { he: 'בדיקת אימות', en: 'Verification Draft' },
          excerpt: { he: 'תקציר בדיקה', en: 'Verification excerpt' },
          content: { he: '<p>גוף הכתבה</p>', en: '<p>Body copy</p>' },
        })
        expect(result.ok, `create failed: ${result.rawText}`)
        expect(result.status === 'draft', `expected draft, got ${result.status}`)
        expect(result.created === true, 'should report created')
        createdId = result.contentId ?? null
        return `id ${createdId}`
      })

      await check('the draft is not publicly reachable', async () => {
        const response = await fetch(`${BASE}/he/news/${slug}`)
        expect(response.status === 404, `expected 404, got ${response.status}`)
        return 'HTTP 404 on the public URL'
      })

      await check('the draft is absent from the sitemap', async () => {
        const sitemap = await fetch(`${BASE}/sitemap.xml`).then((r) => r.text())
        expect(!sitemap.includes(slug), 'the draft slug appeared in the sitemap')
        return 'not in sitemap.xml'
      })

      await check('re-running the import with the same sourceRef does not duplicate', async () => {
        const result = await w.call('create_blog_draft', {
          slug: `${slug}-second`,
          sourceRef,
          title: { en: 'Should not create' },
        })
        expect(result.ok, `retry failed: ${result.rawText}`)
        expect(result.created === false, 'should report that nothing was created')
        expect(result.contentId === createdId, `returned a different id: ${result.contentId}`)
        return 'existing article returned'
      })

      await check('a forbidden field mixed with a legitimate one fails the WHOLE call', async () => {
        // The regression this guards: with a plain zod object on the tool's
        // input schema, `status` was stripped in transit, `seoTitle` was
        // applied, and the call returned ok:true. The publication gate held --
        // the article stayed a draft -- but a model that asked to publish got a
        // success back. Now the whole call is refused and names the field.
        const current = await w.call('get_content', {
          contentType: 'blog_article',
          contentId: createdId,
        })
        const before = (current.data as { fields: Record<string, unknown> }).fields

        const result = await w.call('update_blog_content', {
          id: createdId,
          expectedUpdatedAt: current.updatedAt,
          seoTitle: { en: 'Should not be applied' },
          status: 'published',
        })
        expect(!result.ok, 'the mixed payload should have been refused outright')
        expect(
          result.errorCode === 'FORBIDDEN_FIELD',
          `expected FORBIDDEN_FIELD, got ${result.errorCode}`
        )
        expect(/status/.test(result.rawText), `the message should name status: ${result.rawText}`)

        // And nothing landed -- not even the legitimate half.
        const after = await w.call('get_content', {
          contentType: 'blog_article',
          contentId: createdId,
        })
        const afterFields = (after.data as { fields: Record<string, unknown> }).fields
        expect(
          JSON.stringify(afterFields.seoTitle) === JSON.stringify(before.seoTitle),
          'the legitimate field was applied despite the refusal'
        )
        expect(afterFields.status === 'draft', `status changed to ${afterFields.status}`)
        return 'refused atomically, neither field applied'
      })

      await check('a stale conflict token aborts the write', async () => {
        const result = await w.call('update_blog_content', {
          id: createdId,
          expectedUpdatedAt: '1999-01-01T00:00:00.000Z',
          seoTitle: { en: 'Should not land' },
        })
        expect(!result.ok, 'should have been rejected')
        expect(result.errorCode === 'CONFLICT', `expected CONFLICT, got ${result.errorCode}`)
        expect(Boolean(result.updatedAt), 'should return the current updatedAt to recover with')
        return `CONFLICT, current token returned`
      })

      await check('a correct conflict token lets the write through', async () => {
        const current = await w.call('get_content', {
          contentType: 'blog_article',
          contentId: createdId,
        })
        const result = await w.call('update_blog_content', {
          id: createdId,
          expectedUpdatedAt: current.updatedAt,
          seoTitle: { he: 'כותרת SEO', en: 'SEO Title' },
          seoDescription: { he: 'תיאור SEO לבדיקה', en: 'SEO description for verification' },
        })
        expect(result.ok, `update failed: ${result.rawText}`)
        return 'updated'
      })

      await check('script tags in the body are stripped before storage', async () => {
        const current = await w.call('get_content', {
          contentType: 'blog_article',
          contentId: createdId,
        })
        const result = await w.call('update_blog_content', {
          id: createdId,
          expectedUpdatedAt: current.updatedAt,
          content: { en: '<p>Safe</p><script>alert(1)</script>', he: '<p>בטוח</p>' },
        })
        expect(result.ok, `update failed: ${result.rawText}`)

        const after = await w.call('get_content', {
          contentType: 'blog_article',
          contentId: createdId,
        })
        const fields = (after.data as { fields: Record<string, { en: string }> }).fields
        expect(!fields.content.en.includes('<script'), 'a script tag reached the database')
        expect(Boolean(result.warnings?.length), 'the strip should be reported')
        return 'stripped, and reported as a warning'
      })

      // ── The product collection association ──────────────────────────────

      await check('a new draft starts with no product collection', async () => {
        const current = await w.call('get_content', {
          contentType: 'blog_article',
          contentId: createdId,
        })
        const fields = (current.data as { fields: Record<string, unknown> }).fields
        expect(
          'productCollection' in fields,
          'the field should always be present so a reader can tell it is readable'
        )
        expect(fields.productCollection === null, `expected null, got ${JSON.stringify(fields.productCollection)}`)
        return 'null, and reported as null rather than omitted'
      })

      await check('assigning a collection saves the whole ancestor chain', async () => {
        const current = await w.call('get_content', {
          contentType: 'blog_article',
          contentId: createdId,
        })
        const result = await w.call('update_blog_content', {
          id: createdId,
          expectedUpdatedAt: current.updatedAt,
          productCollection: { collectionId },
        })
        expect(result.ok, `assign failed: ${result.rawText}`)

        const { adminDb } = await import('@/lib/firebase-admin')
        const stored = (await adminDb.collection('blogArticles').doc(createdId!).get()).data()
        const config = stored?.relatedProductsCarousel
        expect(config?.enabled === true, `enabled is ${config?.enabled}`)
        expect(
          Array.isArray(config?.categoryIds) && config.categoryIds.length === 3,
          `expected a 3-link chain, stored ${JSON.stringify(config?.categoryIds)}`
        )
        expect(
          config.categoryIds[2] === collectionId,
          'the chain does not end at the chosen collection'
        )
        expect(config?.mode === 'random', `mode is ${config?.mode}`)
        return `categoryIds ${JSON.stringify(config.categoryIds)}, maxProducts ${config.maxProducts}`
      })

      await check('reading it back returns the same selection, in both locales', async () => {
        const current = await w.call('get_content', {
          contentType: 'blog_article',
          contentId: createdId,
        })
        const fields = (current.data as {
          fields: { productCollection: { collectionId: string; title: { he: string; en: string }; urls: { he: string; en: string } } | null }
        }).fields
        expect(fields.productCollection !== null, 'the selection read back as null')
        expect(
          fields.productCollection!.collectionId === collectionId,
          `read back ${fields.productCollection!.collectionId}`
        )
        expect(Boolean(fields.productCollection!.title.he), 'no Hebrew title')
        expect(Boolean(fields.productCollection!.title.en), 'no English title')
        return `${fields.productCollection!.title.he} / ${fields.productCollection!.title.en}`
      })

      await check('the storefront resolves products for that selection', async () => {
        // The point of the whole feature: the stored chain is one the product
        // query actually matches. Checked through the same module the article
        // page renders with, so this fails if the chain is subtly wrong rather
        // than merely well-formed.
        const { adminDb } = await import('@/lib/firebase-admin')
        const stored = (await adminDb.collection('blogArticles').doc(createdId!).get()).data()
        const { fetchRelatedProductsForArticle } = await import('@/lib/blog-related-products')
        const products = await fetchRelatedProductsForArticle(stored?.relatedProductsCarousel)
        expect(products.length > 0, 'the saved selection resolves to no products')
        expect(
          products.length <= stored!.relatedProductsCarousel.maxProducts,
          `returned ${products.length}, over the ${stored!.relatedProductsCarousel.maxProducts} cap`
        )
        return `${products.length} product cards would render`
      })

      await check('an unrelated edit leaves the selection alone', async () => {
        const current = await w.call('get_content', {
          contentType: 'blog_article',
          contentId: createdId,
        })
        const result = await w.call('update_blog_content', {
          id: createdId,
          expectedUpdatedAt: current.updatedAt,
          seoDescription: { he: 'תיאור חדש', en: 'A different description' },
        })
        expect(result.ok, `update failed: ${result.rawText}`)

        const after = await w.call('get_content', {
          contentType: 'blog_article',
          contentId: createdId,
        })
        const fields = (after.data as { fields: { productCollection: { collectionId: string } | null } }).fields
        expect(fields.productCollection !== null, 'an unrelated edit cleared the selection')
        expect(fields.productCollection!.collectionId === collectionId, 'the selection changed')
        return 'selection preserved through a partial update'
      })

      await check('maxProducts survives an edit that only names the collection', async () => {
        // Partial-update behaviour inside the stored object: the whole field is
        // rewritten on every write, so a re-assignment that says nothing about
        // the count must not reset it.
        let current = await w.call('get_content', { contentType: 'blog_article', contentId: createdId })
        const withCount = await w.call('update_blog_content', {
          id: createdId,
          expectedUpdatedAt: current.updatedAt,
          productCollection: { collectionId, maxProducts: 4 },
        })
        expect(withCount.ok, `set failed: ${withCount.rawText}`)

        current = await w.call('get_content', { contentType: 'blog_article', contentId: createdId })
        const reassign = await w.call('update_blog_content', {
          id: createdId,
          expectedUpdatedAt: current.updatedAt,
          productCollection: { collectionId },
        })
        expect(reassign.ok, `reassign failed: ${reassign.rawText}`)

        const { adminDb } = await import('@/lib/firebase-admin')
        const stored = (await adminDb.collection('blogArticles').doc(createdId!).get()).data()
        expect(
          stored?.relatedProductsCarousel?.maxProducts === 4,
          `maxProducts reset to ${stored?.relatedProductsCarousel?.maxProducts}`
        )
        return 'maxProducts 4 preserved'
      })

      await check('an unknown collection id is NOT_FOUND and changes nothing', async () => {
        const current = await w.call('get_content', { contentType: 'blog_article', contentId: createdId })
        const result = await w.call('update_blog_content', {
          id: createdId,
          expectedUpdatedAt: current.updatedAt,
          productCollection: { collectionId: 'definitely-not-a-collection' },
        })
        expect(!result.ok, 'an invented id was accepted')
        expect(result.errorCode === 'NOT_FOUND', `expected NOT_FOUND, got ${result.errorCode}`)

        const after = await w.call('get_content', { contentType: 'blog_article', contentId: createdId })
        const fields = (after.data as { fields: { productCollection: { collectionId: string } | null } }).fields
        expect(fields.productCollection?.collectionId === collectionId, 'the refusal still wrote something')
        return 'refused, previous selection intact'
      })

      await check('the raw carousel object cannot be written', async () => {
        const current = await w.call('get_content', { contentType: 'blog_article', contentId: createdId })
        const result = await w.call('update_blog_content', {
          id: createdId,
          expectedUpdatedAt: current.updatedAt,
          relatedProductsCarousel: { enabled: true, mode: 'random', categoryIds: ['x'], maxProducts: 99 },
        })
        expect(!result.ok, 'the raw field was accepted')
        expect(result.errorCode === 'FORBIDDEN_FIELD', `expected FORBIDDEN_FIELD, got ${result.errorCode}`)
        return 'refused by name'
      })

      await check('categoryIds cannot be smuggled in through productCollection', async () => {
        const current = await w.call('get_content', { contentType: 'blog_article', contentId: createdId })
        const result = await w.call('update_blog_content', {
          id: createdId,
          expectedUpdatedAt: current.updatedAt,
          productCollection: { collectionId, categoryIds: ['anything'] },
        })
        expect(!result.ok, 'a hand-built chain was accepted')
        expect(result.errorCode === 'FORBIDDEN_FIELD', `expected FORBIDDEN_FIELD, got ${result.errorCode}`)
        return 'the chain stays server-derived'
      })

      await check('a stale token aborts a collection change too', async () => {
        const result = await w.call('update_blog_content', {
          id: createdId,
          expectedUpdatedAt: '1999-01-01T00:00:00.000Z',
          productCollection: null,
        })
        expect(!result.ok, 'should have been rejected')
        expect(result.errorCode === 'CONFLICT', `expected CONFLICT, got ${result.errorCode}`)

        const after = await w.call('get_content', { contentType: 'blog_article', contentId: createdId })
        const fields = (after.data as { fields: { productCollection: unknown } }).fields
        expect(fields.productCollection !== null, 'the stale write cleared the selection anyway')
        return 'CONFLICT, selection untouched'
      })

      await check('null clears the selection and the section stops rendering', async () => {
        const current = await w.call('get_content', { contentType: 'blog_article', contentId: createdId })
        const result = await w.call('update_blog_content', {
          id: createdId,
          expectedUpdatedAt: current.updatedAt,
          productCollection: null,
        })
        expect(result.ok, `clear failed: ${result.rawText}`)

        const after = await w.call('get_content', { contentType: 'blog_article', contentId: createdId })
        const fields = (after.data as { fields: { productCollection: unknown } }).fields
        expect(fields.productCollection === null, `expected null, got ${JSON.stringify(fields.productCollection)}`)

        const { adminDb } = await import('@/lib/firebase-admin')
        const stored = (await adminDb.collection('blogArticles').doc(createdId!).get()).data()
        const { fetchRelatedProductsForArticle } = await import('@/lib/blog-related-products')
        const products = await fetchRelatedProductsForArticle(stored?.relatedProductsCarousel)
        expect(products.length === 0, `${products.length} products still resolve after clearing`)
        return 'cleared, and no products resolve'
      })

      await check('the collection write touched nothing but the article', async () => {
        // The permission boundary, asserted against the database rather than
        // inferred from the tool schema.
        const { adminDb } = await import('@/lib/firebase-admin')
        const category = (await adminDb.collection('categories').doc(collectionId!).get()).data()
        expect(category?.seoUpdatedVia === undefined, 'the category document was written')
        expect(category?.isEnabled === true, 'the category visibility changed')
        return 'the category document is untouched'
      })

      // ── Image dimensions ────────────────────────────────────────────────

      await check('an undersized editorial image is refused with its measurements', async () => {
        const result = await w.call('upload_article_image', {
          altHe: 'תמונה קטנה מדי',
          altEn: 'Too small',
          imageBase64: (await makePng(600, 314)).toString('base64'),
          mimeType: 'image/png',
        })
        expect(!result.ok, 'an undersized image was stored')
        expect(/600x314/.test(result.rawText), `the message should measure it: ${result.rawText}`)
        expect(/1200x628/.test(result.rawText), 'the message should state the target')
        return 'refused, no upscaling'
      })

      await check('a wrong-shape editorial image is refused until a crop is asked for', async () => {
        const base = {
          altHe: 'יחס לא נכון',
          altEn: 'Wrong ratio',
          imageBase64: (await makePng(1920, 1080)).toString('base64'),
          mimeType: 'image/png',
        }
        const strict = await w.call('upload_article_image', base)
        expect(!strict.ok, 'a 16:9 source was cropped without being asked')
        expect(/fit/.test(strict.rawText), `the message should name the escape hatch: ${strict.rawText}`)

        const cropped = await w.call('upload_article_image', { ...base, fit: 'cover' })
        expect(cropped.ok, `the explicit crop failed: ${cropped.rawText}`)
        if (cropped.contentId) uploadedPaths.add(cropped.contentId)
        const data = cropped.data as { width: number; height: number }
        expect(data.width === 1200 && data.height === 628, `stored ${data.width}x${data.height}`)
        return `refused, then 1920x1080 -> ${data.width}x${data.height} on request`
      })

      await check('an oversized editorial image is stored at exactly 1200x628', async () => {
        const result = await w.call('upload_article_image', {
          altHe: 'תמונה גדולה',
          altEn: 'Oversized but correctly proportioned',
          imageBase64: (await makePng(1650, 863)).toString('base64'),
          mimeType: 'image/png',
        })
        expect(result.ok, `upload failed: ${result.rawText}`)
        if (result.contentId) uploadedPaths.add(result.contentId)
        const data = result.data as { width: number; height: number; sourceDimensions?: string }
        expect(data.width === 1200 && data.height === 628, `stored ${data.width}x${data.height}`)
        expect(data.sourceDimensions === '1650x863', `source not reported: ${data.sourceDimensions}`)

        // Measured off the stored object, not taken from the response.
        const stored = Buffer.from(await (await fetch(result.url!)).arrayBuffer())
        const sharpLib = (await import('sharp')).default
        const meta = await sharpLib(stored).metadata()
        expect(
          meta.width === 1200 && meta.height === 628,
          `the stored file is ${meta.width}x${meta.height}`
        )
        return `1650x863 -> ${meta.width}x${meta.height} ${meta.format}`
      })

      await check('a body image keeps its own proportions', async () => {
        const result = await w.call('upload_article_image', {
          altHe: 'תמונה בגוף הכתבה',
          altEn: 'In-body image',
          purpose: 'inline',
          imageBase64: (await makePng(900, 900)).toString('base64'),
          mimeType: 'image/png',
        })
        expect(result.ok, `inline upload failed: ${result.rawText}`)
        if (result.contentId) uploadedPaths.add(result.contentId)
        const data = result.data as { width: number; height: number }
        expect(data.width === 900 && data.height === 900, `stored ${data.width}x${data.height}`)
        return 'a square body image stays square'
      })

      await check('an incomplete article is refused by schedule_blog_post', async () => {
        // It has no featured image at this point.
        const result = await w.call('schedule_blog_post', {
          id: createdId,
          publishAt: '2027-01-15T09:00',
        })
        expect(!result.ok, 'should have been refused')
        expect(/featuredImage/.test(result.rawText), `unexpected message: ${result.rawText}`)
        return 'missing requirements listed'
      })

      await check('schedule_blog_post stores UTC for a Jerusalem wall-clock time', async () => {
        // A real 1200x628, not the 1x1 placeholder this used to send: the
        // featured image is now measured, and a 1x1 is refused for the same
        // reason any undersized source is.
        const image = await w.call('upload_article_image', {
          altHe: 'תמונת בדיקה',
          altEn: 'Verification image',
          imageBase64: (await makePng(1200, 628)).toString('base64'),
          mimeType: 'image/png',
        })
        expect(image.ok, `upload failed: ${image.rawText}`)
        if (image.contentId) uploadedPaths.add(image.contentId)

        const current = await w.call('get_content', {
          contentType: 'blog_article',
          contentId: createdId,
        })
        const completed = await w.call('update_blog_content', {
          id: createdId,
          expectedUpdatedAt: current.updatedAt,
          featuredImage: image.url,
          featuredImageAlt: { he: 'תמונת בדיקה', en: 'Verification image' },
        })
        expect(completed.ok, `completion failed: ${completed.rawText}`)

        const result = await w.call('schedule_blog_post', {
          id: createdId,
          publishAt: '2027-01-15T09:00',
          expectedUpdatedAt: completed.updatedAt,
        })
        expect(result.ok, `schedule failed: ${result.rawText}`)
        expect(result.status === 'scheduled', `expected scheduled, got ${result.status}`)
        // 09:00 Jerusalem in January is UTC+2.
        expect(
          result.publishAt === '2027-01-15T07:00:00.000Z',
          `expected 07:00Z, got ${result.publishAt}`
        )
        return `09:00 Asia/Jerusalem → ${result.publishAt}`
      })

      await check('a scheduled article is still not public and not in the sitemap', async () => {
        const page = await fetch(`${BASE}/he/news/${slug}`)
        expect(page.status === 404, `expected 404, got ${page.status}`)
        const sitemap = await fetch(`${BASE}/sitemap.xml`).then((r) => r.text())
        expect(!sitemap.includes(slug), 'a scheduled slug appeared in the sitemap')
        return 'private until its time'
      })

      await check('unschedule_blog_post returns it to a draft', async () => {
        const result = await w.call('unschedule_blog_post', { id: createdId })
        expect(result.ok, `unschedule failed: ${result.rawText}`)
        expect(result.status === 'draft', `expected draft, got ${result.status}`)
        return 'back to draft'
      })
    }
  } finally {
    section('Cleanup')

    if (uploadedPaths.size > 0) {
      // The image cases upload real files now, not a 1x1 placeholder, and the
      // store is content-addressed -- so without this the bucket accumulates a
      // few hundred KB of noise every time anyone runs the script.
      try {
        const { adminStorage } = await import('@/lib/firebase-admin')
        const bucket = adminStorage.bucket(
          process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
            `${process.env.FIREBASE_PROJECT_ID ?? 'sako-or'}.firebasestorage.app`
        )
        for (const path of uploadedPaths) await bucket.file(path).delete({ ignoreNotFound: true })
        console.log(`  Deleted ${uploadedPaths.size} verification image(s) from storage.`)
      } catch (error) {
        console.error('  Could NOT delete the verification images.', error)
      }
    }

    if (createdId) {
      try {
        const { adminDb } = await import('@/lib/firebase-admin')
        const revisions = await adminDb
          .collection('blogArticles')
          .doc(createdId)
          .collection('revisions')
          .get()
        for (const doc of revisions.docs) await doc.ref.delete()
        await adminDb.collection('blogArticles').doc(createdId).delete()
        console.log(`  Deleted the verification draft ${createdId} and its revisions.`)
      } catch (error) {
        console.error(
          `  Could NOT delete the verification draft ${createdId}. Remove it by hand in /admin/blog.`,
          error
        )
      }
    } else {
      console.log('  Nothing was created, so nothing to clean up.')
    }

    try {
      const { revokeAllForEmail: revoke } = await import('@/lib/mcp/oauth/store')
      await revoke(role.email)
      console.log('  Revoked the verification tokens.')
    } catch (error) {
      console.error('  Could not revoke the verification tokens; they expire in an hour.', error)
    }
  }

  console.log(`\n${'='.repeat(60)}`)
  console.log(`passed: ${passed}   failed: ${failed}   skipped: ${skipped}`)
  if (!WRITE) {
    console.log('Run again with --write to exercise the create / update / schedule workflow.')
  }
  process.exit(failed > 0 ? 1 : 0)
}

void main()
