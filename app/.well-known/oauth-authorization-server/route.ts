import { NextResponse } from 'next/server'

import {
  MCP_PATHS,
  SUPPORTED_SCOPES,
  absoluteUrl,
  getIssuer,
} from '@/lib/mcp/oauth/config'
import { isMcpEnabled } from '@/lib/server/content-role'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * RFC 8414 Authorization Server Metadata.
 *
 * Every advertised capability here is one this server actually implements, which
 * is the point of the document -- a client that trusts it and then hits an
 * unimplemented endpoint has no way to recover. In particular:
 *
 *   - S256 only. `plain` PKCE is deliberately absent and
 *     /api/mcp/oauth/authorize refuses it; see verifyPkceS256.
 *   - `none` for token endpoint auth. ChatGPT registers as a public client and
 *     holds no client secret, so PKCE is the binding between the authorize and
 *     token requests. Advertising client_secret_post would invite a client to
 *     send a secret this server never issued.
 *   - No client_credentials. ChatGPT does not support machine-to-machine grants
 *     anyway, and a grant with no user in the loop would defeat the point of
 *     tying every write to one named content editor.
 */
export async function GET() {
  if (!isMcpEnabled()) {
    return new NextResponse(null, { status: 404 })
  }

  return NextResponse.json(
    {
      issuer: getIssuer(),
      authorization_endpoint: absoluteUrl(MCP_PATHS.authorize),
      token_endpoint: absoluteUrl(MCP_PATHS.token),
      registration_endpoint: absoluteUrl(MCP_PATHS.register),
      revocation_endpoint: absoluteUrl(MCP_PATHS.revoke),
      scopes_supported: [...SUPPORTED_SCOPES],
      response_types_supported: ['code'],
      response_modes_supported: ['query'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
      revocation_endpoint_auth_methods_supported: ['none'],
      // RFC 8707. ChatGPT appends `resource` to both requests and we validate
      // it, so saying so lets the client skip a probe.
      authorization_response_iss_parameter_supported: true,
      service_documentation: `${getIssuer()}/docs/mcp-seo-content`,
    },
    {
      headers: {
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
      },
    }
  )
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  })
}
