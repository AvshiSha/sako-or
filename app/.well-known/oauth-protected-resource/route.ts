import { NextResponse } from 'next/server'

import {
  DISCOVERY_HEADERS,
  DISCOVERY_PREFLIGHT_HEADERS,
  protectedResourceMetadata,
} from '@/lib/mcp/oauth/metadata'
import { isMcpEnabled } from '@/lib/server/content-role'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * RFC 9728 Protected Resource Metadata, at the bare well-known path.
 *
 * This is the first thing an MCP client fetches after a 401 from /api/mcp: the
 * `WWW-Authenticate` challenge points here, and this document points at the
 * authorization server. Without it ChatGPT has no way to discover where to send
 * the user, and the connector fails with an unhelpful auth error.
 *
 * Served from the app rather than a static file in public/ because the issuer is
 * environment-dependent -- a preview deployment must advertise its own origin or
 * the redirect lands on production.
 *
 * Note middleware.ts must let `/.well-known` through unlocalized; without that
 * the locale rule 308s this to `/he/.well-known/...` and the client parses a
 * 200 HTML page as JSON.
 */
export async function GET() {
  if (!isMcpEnabled()) return new NextResponse(null, { status: 404 })
  return NextResponse.json(protectedResourceMetadata(), { headers: DISCOVERY_HEADERS })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: DISCOVERY_PREFLIGHT_HEADERS })
}
