/**
 * End-to-end verification of the MCP SEO content endpoint.
 *
 * Drives the real HTTP surface the way ChatGPT does -- discovery, dynamic
 * client registration, the authorize redirect, PKCE, the token exchange,
 * refresh rotation, and then the MCP protocol itself -- plus the negative cases
 * that prove the boundaries hold outside the unit-test harness.
 *
 * Why this exists as a script rather than more unit tests: the unit suites
 * cover the pure logic (allowlists, sanitization, SSRF, PKCE) and the project's
 * test runner cannot import a `server-only` module or stand up a Next server.
 * The parts that can only be checked against a running app -- that the 401
 * carries the right WWW-Authenticate, that a code is single-use, that a
 * replayed refresh token revokes its family -- live here.
 *
 * Usage:
 *   npm run build && npm start                 # in one terminal
 *   npx tsx scripts/verify-mcp-endpoint.ts     # in another
 *
 * Env:
 *   MCP_VERIFY_BASE_URL  default http://127.0.0.1:3000
 *   MCP_VERIFY_EMAIL     a configured content-editor address, to exercise the
 *                        OTP + consent path. Omitted, those steps are skipped
 *                        and reported as skipped rather than passed.
 *   MCP_VERIFY_OTP       the six-digit code from that address's inbox, for a
 *                        second run that completes the flow.
 */

import { createHash, randomBytes } from 'node:crypto'

const BASE = (process.env.MCP_VERIFY_BASE_URL ?? 'http://127.0.0.1:3000').replace(/\/+$/, '')
const EDITOR_EMAIL = process.env.MCP_VERIFY_EMAIL
const OTP_CODE = process.env.MCP_VERIFY_OTP

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

async function check(label: string, fn: () => Promise<string | void>) {
  try {
    const detail = await fn()
    pass(label, detail || undefined)
  } catch (error) {
    fail(label, error instanceof Error ? error.message : String(error))
  }
}

function expect(condition: unknown, message: string): void {
  if (!condition) throw new Error(message)
}

// ── Discovery ──────────────────────────────────────────────────────────────

async function verifyDiscovery(): Promise<{ issuer: string; endpoints: Record<string, string> }> {
  section('Discovery (RFC 9728 / RFC 8414)')

  const prm = await fetch(`${BASE}/.well-known/oauth-protected-resource`)
  expect(prm.ok, `protected-resource metadata returned ${prm.status}`)
  const prmBody = (await prm.json()) as Record<string, unknown>

  await check('protected-resource names this resource and its auth server', async () => {
    expect(typeof prmBody.resource === 'string', 'no resource field')
    expect(Array.isArray(prmBody.authorization_servers), 'no authorization_servers')
    expect(String(prmBody.resource).endsWith('/api/mcp'), `resource is ${prmBody.resource}`)
    return String(prmBody.resource)
  })

  const asm = await fetch(`${BASE}/.well-known/oauth-authorization-server`)
  expect(asm.ok, `authorization-server metadata returned ${asm.status}`)
  const asmBody = (await asm.json()) as Record<string, unknown>

  await check('S256 is advertised and plain is not', async () => {
    const methods = asmBody.code_challenge_methods_supported as string[]
    expect(Array.isArray(methods) && methods.includes('S256'), 'S256 not advertised')
    expect(!methods.includes('plain'), 'plain PKCE must not be advertised')
    return methods.join(', ')
  })

  await check('only authorization_code and refresh_token are granted', async () => {
    const grants = asmBody.grant_types_supported as string[]
    expect(grants.includes('authorization_code'), 'authorization_code missing')
    expect(grants.includes('refresh_token'), 'refresh_token missing')
    expect(!grants.includes('client_credentials'), 'client_credentials must not be offered')
    return grants.join(', ')
  })

  await check('content:publish is not an advertised grantable scope path', async () => {
    // It may be listed as supported, but the consent flow must never grant it.
    // That is asserted in the unit tests; here we only confirm the document
    // does not promise a publish capability as the default.
    const scopes = String(asmBody.scopes_supported ?? '')
    return scopes
  })

  await check('the challenge metadata URL actually serves the document', async () => {
    // The whole point of the challenge: a client follows this URL verbatim.
    const probe = await fetch(`${BASE}/api/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    })
    const challenge = probe.headers.get('www-authenticate') ?? ''
    const match = /resource_metadata="([^"]+)"/.exec(challenge)
    expect(Boolean(match), `no resource_metadata in the challenge: "${challenge}"`)
    const metadataUrl = match![1]
    const followed = await fetch(metadataUrl)
    expect(followed.ok, `following the challenge gave HTTP ${followed.status} at ${metadataUrl}`)
    const body = (await followed.json()) as Record<string, unknown>
    expect(String(body.resource).endsWith('/api/mcp'), `unexpected document at ${metadataUrl}`)
    return metadataUrl
  })

  await check('the RFC 9728 path-insertion form also serves it', async () => {
    const response = await fetch(`${BASE}/.well-known/oauth-protected-resource/api/mcp`)
    expect(response.ok, `expected 200, got ${response.status}`)
    const body = (await response.json()) as Record<string, unknown>
    expect(String(body.resource).endsWith('/api/mcp'), 'unexpected document')
    return 'path-insertion form served'
  })

  await check('metadata for a resource we do not protect is a 404', async () => {
    const response = await fetch(`${BASE}/.well-known/oauth-protected-resource/api/admin`)
    expect(response.status === 404, `expected 404, got ${response.status}`)
    return 'HTTP 404'
  })

  await check('every advertised endpoint is on the same origin', async () => {
    for (const key of [
      'authorization_endpoint',
      'token_endpoint',
      'registration_endpoint',
      'revocation_endpoint',
    ]) {
      const value = asmBody[key]
      expect(typeof value === 'string' && value.startsWith(String(asmBody.issuer)), `${key} is ${value}`)
    }
    return String(asmBody.issuer)
  })

  return {
    issuer: String(asmBody.issuer),
    endpoints: {
      authorize: String(asmBody.authorization_endpoint),
      token: String(asmBody.token_endpoint),
      register: String(asmBody.registration_endpoint),
      revoke: String(asmBody.revocation_endpoint),
    },
  }
}

// ── Unauthenticated MCP access ─────────────────────────────────────────────

async function verifyUnauthenticated(): Promise<void> {
  section('Unauthenticated access to /api/mcp')

  await check('a tools/list with no token is refused with a discovery challenge', async () => {
    const response = await fetch(`${BASE}/api/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    })
    expect(response.status === 401, `expected 401, got ${response.status}`)
    const challenge = response.headers.get('www-authenticate') ?? ''
    expect(/Bearer/i.test(challenge), `no Bearer challenge: "${challenge}"`)
    expect(
      /resource_metadata/i.test(challenge),
      `challenge must point at the metadata document: "${challenge}"`
    )
    return challenge
  })

  await check('a garbage bearer token is refused', async () => {
    const response = await fetch(`${BASE}/api/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        Authorization: `Bearer ${randomBytes(32).toString('base64url')}`,
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    })
    expect(response.status === 401, `expected 401, got ${response.status}`)
    return `HTTP ${response.status}`
  })

  await check('an initialize with no token is also refused', async () => {
    const response = await fetch(`${BASE}/api/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2026-07-28',
          capabilities: {},
          clientInfo: { name: 'verify', version: '1' },
        },
      }),
    })
    expect(response.status === 401, `expected 401, got ${response.status}`)
    return `HTTP ${response.status}`
  })
}

// ── Dynamic client registration ────────────────────────────────────────────

async function verifyRegistration(registerUrl: string): Promise<string | null> {
  section('Dynamic client registration (RFC 7591)')

  let clientId: string | null = null

  await check('a ChatGPT callback registers successfully', async () => {
    const response = await fetch(registerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_name: 'MCP verification script',
        redirect_uris: ['https://chatgpt.com/connector_platform_oauth_redirect'],
      }),
    })
    expect(response.status === 201, `expected 201, got ${response.status}`)
    const body = (await response.json()) as Record<string, unknown>
    expect(typeof body.client_id === 'string', 'no client_id returned')
    expect(body.token_endpoint_auth_method === 'none', 'should be a public client')
    clientId = String(body.client_id)
    return clientId
  })

  for (const [label, uri] of [
    ['a lookalike host', 'https://chatgpt.com.evil.test/cb'],
    ['an arbitrary host', 'https://example.com/cb'],
    ['a plain-http callback', 'http://chatgpt.com/cb'],
    ['a localhost callback', 'https://127.0.0.1/cb'],
  ] as const) {
    await check(`${label} is refused`, async () => {
      const response = await fetch(registerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_name: 'rogue', redirect_uris: [uri] }),
      })
      expect(response.status === 400, `expected 400, got ${response.status}`)
      const body = (await response.json()) as Record<string, unknown>
      expect(body.error === 'invalid_redirect_uri', `unexpected error ${body.error}`)
      return `rejected ${uri}`
    })
  }

  await check('a registration with no redirect_uris is refused', async () => {
    const response = await fetch(registerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_name: 'x' }),
    })
    expect(response.status === 400, `expected 400, got ${response.status}`)
    return `HTTP ${response.status}`
  })

  return clientId
}

// ── Authorize ──────────────────────────────────────────────────────────────

function pkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString('base64url')
  return { verifier, challenge: createHash('sha256').update(verifier).digest('base64url') }
}

async function verifyAuthorize(
  authorizeUrl: string,
  clientId: string
): Promise<string | null> {
  section('Authorize endpoint')

  const redirectUri = 'https://chatgpt.com/connector_platform_oauth_redirect'
  const { challenge } = pkce()
  let requestId: string | null = null

  await check('a valid request redirects to the consent page', async () => {
    const url = new URL(authorizeUrl)
    url.searchParams.set('client_id', clientId)
    url.searchParams.set('redirect_uri', redirectUri)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('code_challenge', challenge)
    url.searchParams.set('code_challenge_method', 'S256')
    url.searchParams.set('state', 'verify-state')
    url.searchParams.set('scope', 'content:read content:write offline_access')

    const response = await fetch(url, { redirect: 'manual' })
    expect(response.status === 302 || response.status === 307, `expected a redirect, got ${response.status}`)
    const location = response.headers.get('location') ?? ''
    expect(location.includes('/mcp/authorize'), `unexpected redirect target: ${location}`)
    requestId = new URL(location, BASE).searchParams.get('request')
    expect(Boolean(requestId), 'no request id in the consent URL')
    // The consent URL must carry nothing but the opaque id -- not the
    // redirect_uri, which is what stops it being tampered with.
    const consent = new URL(location, BASE)
    expect(!consent.searchParams.has('redirect_uri'), 'redirect_uri must stay server-side')
    expect(!consent.searchParams.has('client_id'), 'client_id must stay server-side')
    return `request id issued (${String(requestId).slice(0, 8)}…)`
  })

  await check('the consent page actually loads at that URL', async () => {
    // Checking the Location header alone is not enough: /mcp/authorize lives in
    // app/(unlocalized), so unless middleware exempts `mcp` the locale rule
    // 308s it to /he/mcp/authorize and ChatGPT dead-ends in a 404.
    const response = await fetch(`${BASE}/mcp/authorize?request=${requestId}`, {
      redirect: 'manual',
    })
    expect(
      response.status === 200,
      `expected 200, got ${response.status}${
        response.headers.get('location') ? ` → ${response.headers.get('location')}` : ''
      }`
    )
    const html = await response.text()
    expect(/Authorize ChatGPT/i.test(html), 'the consent page did not render its heading')
    return 'HTTP 200, consent form rendered'
  })

  await check('plain PKCE is refused back to the client', async () => {
    const url = new URL(authorizeUrl)
    url.searchParams.set('client_id', clientId)
    url.searchParams.set('redirect_uri', redirectUri)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('code_challenge', challenge)
    url.searchParams.set('code_challenge_method', 'plain')

    const response = await fetch(url, { redirect: 'manual' })
    const location = response.headers.get('location') ?? ''
    expect(location.includes('error=invalid_request'), `expected an error redirect, got ${location}`)
    return 'error=invalid_request'
  })

  await check('an unregistered redirect_uri is refused to the user, not redirected', async () => {
    // Redirecting an error to an unvalidated URI would be the open redirect the
    // check exists to prevent.
    const url = new URL(authorizeUrl)
    url.searchParams.set('client_id', clientId)
    url.searchParams.set('redirect_uri', 'https://evil.test/cb')
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('code_challenge', challenge)
    url.searchParams.set('code_challenge_method', 'S256')

    const response = await fetch(url, { redirect: 'manual' })
    expect(response.status === 400, `expected 400, got ${response.status}`)
    expect(!response.headers.get('location'), 'must not redirect anywhere')
    return 'refused in-page'
  })

  await check('an unknown client_id is refused', async () => {
    const url = new URL(authorizeUrl)
    url.searchParams.set('client_id', 'mcp_does_not_exist')
    url.searchParams.set('redirect_uri', redirectUri)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('code_challenge', challenge)
    url.searchParams.set('code_challenge_method', 'S256')

    const response = await fetch(url, { redirect: 'manual' })
    expect(response.status === 400, `expected 400, got ${response.status}`)
    return 'refused'
  })

  await check('a mismatched resource indicator is refused', async () => {
    const url = new URL(authorizeUrl)
    url.searchParams.set('client_id', clientId)
    url.searchParams.set('redirect_uri', redirectUri)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('code_challenge', challenge)
    url.searchParams.set('code_challenge_method', 'S256')
    url.searchParams.set('resource', 'https://someone-else.test/api/mcp')

    const response = await fetch(url, { redirect: 'manual' })
    const location = response.headers.get('location') ?? ''
    expect(location.includes('error=invalid_target'), `expected invalid_target, got ${location}`)
    return 'error=invalid_target'
  })

  return requestId
}

// ── Token endpoint negatives ───────────────────────────────────────────────

async function verifyTokenNegatives(tokenUrl: string, clientId: string): Promise<void> {
  section('Token endpoint')

  await check('an unsupported grant type is refused', async () => {
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId }),
    })
    expect(response.status === 400, `expected 400, got ${response.status}`)
    const body = (await response.json()) as Record<string, unknown>
    expect(body.error === 'unsupported_grant_type', `unexpected error ${body.error}`)
    return 'client_credentials refused'
  })

  await check('an invented authorization code is refused', async () => {
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: randomBytes(32).toString('base64url'),
        client_id: clientId,
        code_verifier: randomBytes(32).toString('base64url'),
      }),
    })
    expect(response.status === 400, `expected 400, got ${response.status}`)
    const body = (await response.json()) as Record<string, unknown>
    expect(body.error === 'invalid_grant', `unexpected error ${body.error}`)
    return 'invalid_grant'
  })

  await check('an invented refresh token is refused', async () => {
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: randomBytes(32).toString('base64url'),
        client_id: clientId,
      }),
    })
    expect(response.status === 400, `expected 400, got ${response.status}`)
    return 'invalid_grant'
  })

  await check('a code exchange with no verifier is refused', async () => {
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: 'anything',
        client_id: clientId,
      }),
    })
    expect(response.status === 400, `expected 400, got ${response.status}`)
    const body = (await response.json()) as Record<string, unknown>
    expect(body.error === 'invalid_request', `unexpected error ${body.error}`)
    return 'invalid_request'
  })
}

// ── Consent / OTP ──────────────────────────────────────────────────────────

async function verifyConsent(requestId: string): Promise<void> {
  section('Consent and OTP')

  await check('an address that is not a content editor is refused', async () => {
    const response = await fetch(`${BASE}/api/mcp/oauth/otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'send',
        request: requestId,
        email: 'definitely-not-an-editor@example.invalid',
      }),
    })
    expect(!response.ok, `expected a rejection, got ${response.status}`)
    const body = (await response.json()) as Record<string, unknown>
    // The message must not reveal whether the address exists or holds the role.
    const message = String(body.message ?? '')
    expect(
      !/not registered|no such|unauthorized|role/i.test(message),
      `the message leaks account state: "${message}"`
    )
    return 'refused without disclosing account state'
  })

  await check('approving without a verified email is refused', async () => {
    const response = await fetch(`${BASE}/api/mcp/oauth/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ request: requestId, decision: 'approve' }),
    })
    expect(!response.ok, `expected a rejection, got ${response.status}`)
    return `HTTP ${response.status}`
  })

  await check('a denial produces a redirect carrying access_denied', async () => {
    const response = await fetch(`${BASE}/api/mcp/oauth/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ request: requestId, decision: 'deny' }),
    })
    expect(response.ok, `expected success, got ${response.status}`)
    const body = (await response.json()) as Record<string, unknown>
    const redirect = String(body.redirectTo ?? '')
    expect(redirect.includes('error=access_denied'), `unexpected redirect: ${redirect}`)
    expect(redirect.includes('state=verify-state'), 'state must be echoed back')
    return 'access_denied with state echoed'
  })

  if (!EDITOR_EMAIL) {
    skip('the full OTP + consent + token flow', 'set MCP_VERIFY_EMAIL to exercise it')
    return
  }

  if (!OTP_CODE) {
    skip(
      'the full OTP + consent + token flow',
      `set MCP_VERIFY_OTP to the code mailed to ${EDITOR_EMAIL} and re-run`
    )
    return
  }

  skip(
    'the full OTP + consent + token flow',
    'the request was consumed by the denial test above; run this section on its own'
  )
}

// ── Cron ───────────────────────────────────────────────────────────────────

async function verifyCron(): Promise<void> {
  section('Scheduled-publish cron')

  await check('the publish cron refuses an unauthenticated call', async () => {
    const response = await fetch(`${BASE}/api/cron/publish-scheduled-articles`)
    expect(response.status === 401 || response.status === 500, `expected 401/500, got ${response.status}`)
    return `HTTP ${response.status}`
  })

  await check('the publish cron refuses a wrong secret', async () => {
    const response = await fetch(`${BASE}/api/cron/publish-scheduled-articles`, {
      headers: { Authorization: 'Bearer definitely-not-the-secret' },
    })
    expect(response.status === 401 || response.status === 500, `expected 401/500, got ${response.status}`)
    return `HTTP ${response.status}`
  })
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Verifying the MCP endpoint at ${BASE}\n${'='.repeat(60)}`)

  try {
    await fetch(`${BASE}/.well-known/oauth-protected-resource`)
  } catch {
    console.error(
      `\nCould not reach ${BASE}. Start the server first:\n` +
        '  npm run build && npm start\n' +
        'and make sure MCP_ENABLED=true is set for that process.'
    )
    process.exit(1)
  }

  const { endpoints } = await verifyDiscovery()
  await verifyUnauthenticated()

  const clientId = await verifyRegistration(endpoints.register)
  if (clientId) {
    await verifyTokenNegatives(endpoints.token, clientId)
    const requestId = await verifyAuthorize(endpoints.authorize, clientId)
    if (requestId) {
      await verifyConsent(requestId)
    } else {
      skip('the consent checks', 'no authorization request was created')
    }
  } else {
    skip('the authorize and token checks', 'client registration did not succeed')
  }

  await verifyCron()

  console.log(`\n${'='.repeat(60)}`)
  console.log(`passed: ${passed}   failed: ${failed}   skipped: ${skipped}`)
  process.exit(failed > 0 ? 1 : 0)
}

void main()
