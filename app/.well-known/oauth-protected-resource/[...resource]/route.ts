import { NextResponse } from 'next/server'

import { MCP_PATHS } from '@/lib/mcp/oauth/config'
import {
  DISCOVERY_HEADERS,
  DISCOVERY_PREFLIGHT_HEADERS,
  protectedResourceMetadata,
} from '@/lib/mcp/oauth/metadata'
import { isMcpEnabled } from '@/lib/server/content-role'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * The RFC 9728 section 3.1 path-insertion form of the same document.
 *
 * For a resource at `https://host/api/mcp`, the spec puts its metadata at
 * `https://host/.well-known/oauth-protected-resource/api/mcp`. A client that
 * follows the spec literally looks here; one that follows the challenge
 * mcp-handler emits looks at the bare path next door. Both answer.
 *
 * Only the path belonging to *our* resource is served. A request for some other
 * resource's metadata gets a 404 rather than this document, because answering
 * it would be claiming to be an authorization server for something we do not
 * protect.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ resource: string[] }> }
) {
  if (!isMcpEnabled()) return new NextResponse(null, { status: 404 })

  const { resource } = await params
  const requested = `/${(resource ?? []).join('/')}`

  if (requested.replace(/\/+$/, '') !== MCP_PATHS.resource) {
    return new NextResponse(null, { status: 404 })
  }

  return NextResponse.json(protectedResourceMetadata(), { headers: DISCOVERY_HEADERS })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: DISCOVERY_PREFLIGHT_HEADERS })
}
