import 'server-only'

import type { AuthInfo } from '@modelcontextprotocol/server'

import {
  SCOPE_CONTENT_READ,
  SCOPE_CONTENT_WRITE,
  getResourceIdentifier,
  resourceMatches,
} from '@/lib/mcp/oauth/config'
import { getAccessToken } from '@/lib/mcp/oauth/store'
import { resolveContentRole } from '@/lib/server/content-role'
import { McpValidationError } from '@/lib/mcp/validation'

/**
 * Bearer token verification for /api/mcp.
 *
 * Handed to withMcpAuth, which turns an `undefined` return into a 401 carrying
 * the RFC 9728 `WWW-Authenticate` challenge that points a client at the
 * protected-resource metadata document. Returning undefined for every failure
 * mode is deliberate: a client cannot act differently on "expired" versus
 * "revoked" versus "never existed", and distinguishing them would leak whether
 * a token string was ever valid.
 *
 * Four independent checks, every request, in this order:
 *
 *   1. the token exists, is not revoked and has not expired;
 *   2. its RFC 8707 audience is this resource, so a token minted for something
 *      else sharing the authorization server cannot be replayed here;
 *   3. the account still holds the content role -- re-read from Postgres, not
 *      trusted from the token, so withdrawing the role takes effect within one
 *      access-token lifetime rather than one refresh-token lifetime; and
 *   4. the token carries at least read scope.
 *
 * The email lands in `extra.email` rather than `AuthInfo.clientId` because
 * clientId is the OAuth client (ChatGPT) and the email is the acting user. The
 * audit trail needs the second one.
 */
export interface McpAuthContext {
  email: string
  clientId: string
  scopes: string[]
}

export async function verifyMcpToken(
  _request: Request,
  bearerToken?: string
): Promise<AuthInfo | undefined> {
  if (!bearerToken) return undefined

  const record = await getAccessToken(bearerToken)
  if (!record) return undefined

  // An empty stored resource means the client never sent one, which older MCP
  // clients do; a non-empty one must match.
  if (record.resource && !resourceMatches(record.resource)) {
    console.warn('[MCP_AUTH] Token presented for a different resource audience.')
    return undefined
  }

  const role = await resolveContentRole(record.email)
  if (!role) {
    console.warn('[MCP_AUTH] Token valid but the content role has been withdrawn.')
    return undefined
  }

  if (!record.scopes.includes(SCOPE_CONTENT_READ)) {
    console.warn('[MCP_AUTH] Token carries no content:read scope.')
    return undefined
  }

  return {
    token: bearerToken,
    clientId: record.clientId,
    scopes: record.scopes,
    expiresAt: Math.floor(record.expiresAt / 1000),
    resource: new URL(getResourceIdentifier()),
    extra: { email: role.email },
  }
}

/**
 * Pull our own context back out of the SDK's AuthInfo.
 *
 * Throws rather than returning null. A tool reached without auth means
 * withMcpAuth was bypassed or misconfigured, which is a server bug, and the
 * safe behaviour for a bug in an authorization path is to fail the call.
 */
export function requireAuthContext(authInfo: AuthInfo | undefined): McpAuthContext {
  const email = authInfo?.extra?.email
  if (!authInfo || typeof email !== 'string' || !email) {
    throw new McpValidationError('UNAUTHORIZED', [
      'This tool requires an authenticated session. Reconnect the connector.',
    ])
  }
  return { email, clientId: authInfo.clientId, scopes: authInfo.scopes }
}

/**
 * Require a scope for a write tool.
 *
 * Separate from the read gate in verifyMcpToken so a read-only grant is a
 * usable state: search and get work, and the write tools refuse individually
 * with a message saying why, instead of the whole connector failing to
 * authenticate.
 */
export function requireWriteScope(context: McpAuthContext): void {
  if (!context.scopes.includes(SCOPE_CONTENT_WRITE)) {
    throw new McpValidationError('FORBIDDEN', [
      'This connection was authorized for reading only. Reconnect it in ChatGPT and ' +
        'approve the content:write scope to create or edit content.',
    ])
  }
}
