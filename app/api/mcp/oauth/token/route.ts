import { NextResponse } from 'next/server'

import {
  SCOPE_OFFLINE_ACCESS,
  resourceMatches,
} from '@/lib/mcp/oauth/config'
import { verifyPkceS256 } from '@/lib/mcp/oauth/crypto'
import {
  consumeAuthCode,
  consumeRefreshToken,
  getClient,
  issueTokens,
  revokeFamily,
} from '@/lib/mcp/oauth/store'
import { isMcpEnabled, resolveContentRole } from '@/lib/server/content-role'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * OAuth 2.1 token endpoint: authorization_code and refresh_token.
 *
 * Both grants re-resolve the content role before issuing anything. That is what
 * makes revocation meaningful without a short refresh lifetime: taking the role
 * away stops the next refresh dead, so the longest a withdrawn editor keeps
 * access is the remaining life of one access token.
 */

function tokenError(error: string, description: string, status = 400): NextResponse {
  return NextResponse.json(
    { error, error_description: description },
    { status, headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' } }
  )
}

/**
 * Read the body as form-encoded, falling back to JSON.
 *
 * RFC 6749 mandates application/x-www-form-urlencoded, and that is what
 * ChatGPT sends. JSON is accepted as well because scripted clients -- including
 * the verification script for this integration -- commonly send it, and
 * refusing would be pedantry that costs debugging time.
 */
async function readParams(request: Request): Promise<URLSearchParams | null> {
  const contentType = request.headers.get('content-type') ?? ''
  const raw = await request.text()
  if (!raw) return null

  if (contentType.includes('application/json')) {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>
      const params = new URLSearchParams()
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === 'string') params.set(key, value)
      }
      return params
    } catch {
      return null
    }
  }

  return new URLSearchParams(raw)
}

export async function POST(request: Request) {
  if (!isMcpEnabled()) {
    return new NextResponse(null, { status: 404 })
  }

  const params = await readParams(request)
  if (!params) {
    return tokenError('invalid_request', 'A form-encoded or JSON body is required.')
  }

  const grantType = params.get('grant_type') ?? ''

  if (grantType === 'authorization_code') {
    return handleAuthorizationCode(params)
  }
  if (grantType === 'refresh_token') {
    return handleRefresh(params)
  }

  return tokenError(
    'unsupported_grant_type',
    'Supported grant types are authorization_code and refresh_token.'
  )
}

async function handleAuthorizationCode(params: URLSearchParams): Promise<NextResponse> {
  const code = params.get('code') ?? ''
  const clientId = params.get('client_id') ?? ''
  const redirectUri = params.get('redirect_uri') ?? ''
  const codeVerifier = params.get('code_verifier') ?? ''
  const resource = params.get('resource')

  if (!code || !clientId || !codeVerifier) {
    return tokenError(
      'invalid_request',
      'code, client_id and code_verifier are all required for the authorization_code grant.'
    )
  }

  // The code is consumed whether or not the rest of the checks pass. A code
  // that survived a failed exchange could be retried against a different
  // verifier, which is exactly the brute force PKCE is meant to prevent.
  const record = await consumeAuthCode(code)
  if (!record) {
    return tokenError('invalid_grant', 'The authorization code is invalid, expired or already used.')
  }

  if (record.clientId !== clientId) {
    console.warn('[MCP_OAUTH_TOKEN] Code presented by a different client than it was issued to.')
    return tokenError('invalid_grant', 'This code was not issued to this client.')
  }

  // RFC 6749 4.1.3: when the authorize request carried a redirect_uri, the
  // token request must present the identical value.
  if (redirectUri && redirectUri !== record.redirectUri) {
    return tokenError('invalid_grant', 'redirect_uri does not match the authorization request.')
  }

  if (!verifyPkceS256(codeVerifier, record.codeChallenge)) {
    console.warn('[MCP_OAUTH_TOKEN] PKCE verification failed.')
    return tokenError('invalid_grant', 'code_verifier does not match the code_challenge.')
  }

  if (resource && !resourceMatches(resource)) {
    return tokenError('invalid_target', 'The requested resource is not served by this server.')
  }

  const role = await resolveContentRole(record.email)
  if (!role) {
    console.warn('[MCP_OAUTH_TOKEN] Content role withdrawn before the code was redeemed.')
    return tokenError('invalid_grant', 'This account is no longer authorized.', 403)
  }

  const client = await getClient(clientId)
  if (!client) {
    return tokenError('invalid_client', 'Unknown client_id.', 401)
  }

  const tokens = await issueTokens({
    email: role.email,
    clientId,
    scopes: record.scopes,
    resource: record.resource,
    withRefresh: record.scopes.includes(SCOPE_OFFLINE_ACCESS),
  })

  console.log(
    '[MCP_OAUTH_TOKEN]',
    JSON.stringify({ grant: 'authorization_code', scopes: record.scopes, refresh: Boolean(tokens.refreshToken) })
  )

  return tokenResponse(tokens)
}

async function handleRefresh(params: URLSearchParams): Promise<NextResponse> {
  const refreshToken = params.get('refresh_token') ?? ''
  const clientId = params.get('client_id') ?? ''
  const requestedScope = params.get('scope')

  if (!refreshToken) {
    return tokenError('invalid_request', 'refresh_token is required.')
  }

  const result = await consumeRefreshToken(refreshToken)
  if (!result.ok) {
    if (result.reason === 'replayed') {
      // consumeRefreshToken has already revoked the family. Say so plainly: the
      // client needs to start a new consent flow, not keep retrying.
      console.warn('[MCP_OAUTH_TOKEN] Refresh token replay detected; token family revoked.')
      return tokenError(
        'invalid_grant',
        'This refresh token was already used. All tokens from that authorization have been revoked; reconnect the connector.'
      )
    }
    return tokenError('invalid_grant', 'The refresh token is invalid or expired.')
  }

  const record = result.record

  if (clientId && clientId !== record.clientId) {
    await revokeFamily(record.familyId)
    console.warn('[MCP_OAUTH_TOKEN] Refresh token presented by the wrong client; family revoked.')
    return tokenError('invalid_grant', 'This refresh token was not issued to this client.')
  }

  const role = await resolveContentRole(record.email)
  if (!role) {
    await revokeFamily(record.familyId)
    console.warn('[MCP_OAUTH_TOKEN] Content role withdrawn; refresh refused and family revoked.')
    return tokenError('invalid_grant', 'This account is no longer authorized.', 403)
  }

  // A refresh may narrow the grant but never widen it (RFC 6749 6).
  let scopes = record.scopes
  if (requestedScope?.trim()) {
    const asked = requestedScope.split(/\s+/).filter(Boolean)
    const narrowed = asked.filter((scope) => record.scopes.includes(scope))
    if (narrowed.length > 0) scopes = narrowed
  }

  const tokens = await issueTokens({
    email: role.email,
    clientId: record.clientId,
    scopes,
    resource: record.resource,
    familyId: record.familyId,
    withRefresh: scopes.includes(SCOPE_OFFLINE_ACCESS),
  })

  console.log('[MCP_OAUTH_TOKEN]', JSON.stringify({ grant: 'refresh_token', scopes }))

  return tokenResponse(tokens)
}

function tokenResponse(tokens: {
  accessToken: string
  refreshToken: string | null
  expiresIn: number
  scopes: string[]
}): NextResponse {
  return NextResponse.json(
    {
      access_token: tokens.accessToken,
      token_type: 'Bearer',
      expires_in: tokens.expiresIn,
      scope: tokens.scopes.join(' '),
      ...(tokens.refreshToken ? { refresh_token: tokens.refreshToken } : {}),
    },
    { headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' } }
  )
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  })
}
