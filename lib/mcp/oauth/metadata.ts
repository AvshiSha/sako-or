import {
  MCP_PATHS,
  SUPPORTED_SCOPES,
  getIssuer,
  getResourceIdentifier,
} from '@/lib/mcp/oauth/config'

/**
 * The RFC 9728 Protected Resource Metadata document.
 *
 * Shared by both routes that serve it. RFC 9728 section 3.1 specifies
 * *path insertion* -- for a resource at `https://host/api/mcp` the metadata
 * lives at `https://host/.well-known/oauth-protected-resource/api/mcp` -- while
 * many clients, and the challenge mcp-handler emits, use the bare
 * `https://host/.well-known/oauth-protected-resource`. Both are served, with
 * identical content, because guessing which one a given client will try is not
 * a bet worth taking: the failure mode is a connector that cannot discover its
 * authorization server, reported to the user as an opaque auth error.
 */
export function protectedResourceMetadata(): Record<string, unknown> {
  const issuer = getIssuer()
  return {
    resource: getResourceIdentifier(),
    authorization_servers: [issuer],
    scopes_supported: [...SUPPORTED_SCOPES],
    bearer_methods_supported: ['header'],
    resource_documentation: `${issuer}/docs/mcp-seo-content`,
  }
}

/** Headers for a discovery document: public, uncached, CORS-open. */
export const DISCOVERY_HEADERS = {
  'Cache-Control': 'no-store',
  // Fetched cross-origin before the client holds any credential, and identical
  // for every caller, so there is nothing to protect by restricting it.
  'Access-Control-Allow-Origin': '*',
} as const

export const DISCOVERY_PREFLIGHT_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, MCP-Protocol-Version',
  'Access-Control-Max-Age': '86400',
} as const

export { MCP_PATHS }
