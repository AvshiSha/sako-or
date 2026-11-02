import { NextResponse } from 'next/server'
import { z } from 'zod'

import { GRANTABLE_SCOPES, isAllowedRedirectUri } from '@/lib/mcp/oauth/config'
import { registerClient } from '@/lib/mcp/oauth/store'
import { isMcpEnabled } from '@/lib/server/content-role'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * RFC 7591 Dynamic Client Registration.
 *
 * Open, as the spec intends -- there is no credential to present before you
 * have one. What makes that safe is the redirect URI allowlist: a registration
 * is only useful if it can receive an authorization code, and
 * isAllowedRedirectUri confines that to ChatGPT's own callbacks. A rogue
 * registration therefore produces a client id that can never be redeemed.
 *
 * ChatGPT prefers Client ID Metadata Documents over DCR, where the client id is
 * a URL on chatgpt.com whose metadata we would fetch. DCR is implemented
 * instead because it needs no outbound request from our server at authorize
 * time, which is one less thing that can fail or be pointed somewhere
 * unexpected. The metadata document does not advertise CIMD support, so
 * ChatGPT falls back to this.
 */
const registerSchema = z
  .object({
    redirect_uris: z.array(z.string().min(1).max(2000)).min(1).max(10),
    client_name: z.string().max(200).optional(),
    // Accepted and ignored: a client may legitimately send these, and rejecting
    // the request over a field we do not need would break registration for no
    // benefit. What we actually honour is fixed by this server's metadata.
    grant_types: z.array(z.string()).optional(),
    response_types: z.array(z.string()).optional(),
    token_endpoint_auth_method: z.string().optional(),
    scope: z.string().optional(),
    client_uri: z.string().optional(),
    logo_uri: z.string().optional(),
    contacts: z.array(z.string()).optional(),
    tos_uri: z.string().optional(),
    policy_uri: z.string().optional(),
    software_id: z.string().optional(),
    software_version: z.string().optional(),
    application_type: z.string().optional(),
  })
  .passthrough()

function registrationError(error: string, description: string, status = 400): NextResponse {
  return NextResponse.json(
    { error, error_description: description },
    { status, headers: { 'Cache-Control': 'no-store' } }
  )
}

export async function POST(request: Request) {
  if (!isMcpEnabled()) {
    return new NextResponse(null, { status: 404 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return registrationError('invalid_client_metadata', 'Expected a JSON object.')
  }

  const parsed = registerSchema.safeParse(body)
  if (!parsed.success) {
    return registrationError(
      'invalid_client_metadata',
      'redirect_uris is required and must be an array of 1-10 URI strings.'
    )
  }

  const redirectUris = parsed.data.redirect_uris.map((uri) => uri.trim())
  const rejected = redirectUris.filter((uri) => !isAllowedRedirectUri(uri))
  if (rejected.length > 0) {
    // Names the rejected URI but not the allowlist: the list is a security
    // control, and an unauthenticated endpoint should not enumerate it.
    console.warn('[MCP_OAUTH_REGISTER] Rejected redirect_uri(s):', rejected)
    return registrationError(
      'invalid_redirect_uri',
      'One or more redirect_uris are not permitted for this authorization server.'
    )
  }

  const client = await registerClient({
    clientName: parsed.data.client_name ?? 'ChatGPT connector',
    redirectUris,
  })

  console.log(
    '[MCP_OAUTH_REGISTER]',
    JSON.stringify({ clientId: client.clientId, clientName: client.clientName })
  )

  return NextResponse.json(
    {
      client_id: client.clientId,
      client_id_issued_at: Math.floor(new Date(client.createdAt).getTime() / 1000),
      redirect_uris: client.redirectUris,
      client_name: client.clientName,
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
      scope: GRANTABLE_SCOPES.join(' '),
    },
    { status: 201, headers: { 'Cache-Control': 'no-store' } }
  )
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  })
}
