import { NextResponse } from 'next/server'

import {
  MCP_PATHS,
  absoluteUrl,
  buildAuthorizationResponse,
  negotiateScopes,
  resourceMatches,
} from '@/lib/mcp/oauth/config'
import { createAuthRequest, getClient } from '@/lib/mcp/oauth/store'
import { isMcpEnabled } from '@/lib/server/content-role'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * OAuth 2.1 authorization endpoint.
 *
 * Validates everything about the request, parks it server-side, and sends the
 * browser to the consent page with nothing but an opaque request id.
 *
 * Parking it matters. If the consent page carried client_id, redirect_uri and
 * scope in its own query string, the approve step would have to trust values
 * that came back from the browser -- and an attacker who could reach the
 * consent page could then approve a grant with a redirect_uri we never
 * validated. Keeping the whole request in Firestore means the only thing the
 * browser can influence is *which* pending request it approves, and it has to
 * hold the id to do even that.
 *
 * Error handling follows RFC 6749: a bad redirect_uri or client_id is reported
 * to the *user*, because redirecting an error to an unvalidated URI is itself
 * the open-redirect the check exists to prevent. Every other error redirects
 * back to the client with `error`, so ChatGPT can show something useful.
 */
function userFacingError(message: string, status = 400): NextResponse {
  // Plain text, not JSON: this is rendered in the specialist's browser, not
  // parsed by the connector.
  return new NextResponse(`Authorization request rejected.\n\n${message}\n`, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}

function redirectWithError(
  redirectUri: string,
  error: string,
  description: string,
  state: string | null
): NextResponse {
  // Error responses carry `iss` as well; RFC 9207 does not exempt them, and a
  // client that validates the parameter will reject one that omits it.
  const target = buildAuthorizationResponse(redirectUri, {
    error,
    error_description: description,
    state,
  })
  return NextResponse.redirect(target.toString(), { status: 302 })
}

export async function GET(request: Request) {
  if (!isMcpEnabled()) {
    return new NextResponse(null, { status: 404 })
  }

  const url = new URL(request.url)
  const params = url.searchParams

  const clientId = params.get('client_id') ?? ''
  const redirectUri = params.get('redirect_uri') ?? ''
  const responseType = params.get('response_type') ?? ''
  const codeChallenge = params.get('code_challenge') ?? ''
  const codeChallengeMethod = params.get('code_challenge_method') ?? ''
  const state = params.get('state')
  const scope = params.get('scope')
  const resource = params.get('resource')

  const client = await getClient(clientId)
  if (!client) {
    return userFacingError(
      'Unknown client_id. The ChatGPT connector needs to be registered again — ' +
        'remove it in ChatGPT and add it back.'
    )
  }

  // Exact string match against the registered set, per RFC 6749 3.1.2.3. No
  // prefix or pattern matching: "starts with a registered URI" is the classic
  // way an open redirect gets into an OAuth server.
  if (!redirectUri || !client.redirectUris.includes(redirectUri)) {
    return userFacingError(
      'redirect_uri does not match the one registered for this client. ' +
        'Nothing was authorized.'
    )
  }

  // From here the redirect_uri is trusted, so errors go back to the client.
  if (responseType !== 'code') {
    return redirectWithError(
      redirectUri,
      'unsupported_response_type',
      'Only response_type=code is supported.',
      state
    )
  }

  if (codeChallengeMethod !== 'S256') {
    return redirectWithError(
      redirectUri,
      'invalid_request',
      'code_challenge_method must be S256. The "plain" method is not accepted.',
      state
    )
  }

  // base64url of a SHA-256 digest is always 43 characters.
  if (!/^[A-Za-z0-9\-._~]{43}$/.test(codeChallenge)) {
    return redirectWithError(
      redirectUri,
      'invalid_request',
      'code_challenge must be the base64url-encoded SHA-256 of the verifier.',
      state
    )
  }

  // RFC 8707. ChatGPT sends this; a token minted without checking it could be
  // replayed against a different resource that shares this authorization server.
  if (resource && !resourceMatches(resource)) {
    return redirectWithError(
      redirectUri,
      'invalid_target',
      'The requested resource is not served by this authorization server.',
      state
    )
  }

  const scopes = negotiateScopes(scope)

  const requestId = await createAuthRequest({
    clientId,
    redirectUri,
    state,
    codeChallenge,
    scopes,
    resource: resource ?? '',
  })

  // Logged so a flow that stalls can be placed precisely: register -> authorize
  // -> otp -> approve -> token each leave a line, and the first one missing is
  // the step that failed. No request id, code or state is logged.
  console.log(
    '[MCP_OAUTH_AUTHORIZE]',
    JSON.stringify({ outcome: 'consent_redirect', clientId, scopes })
  )

  const consent = new URL(absoluteUrl(MCP_PATHS.consentPage))
  consent.searchParams.set('request', requestId)

  return NextResponse.redirect(consent.toString(), {
    status: 302,
    headers: { 'Cache-Control': 'no-store' },
  })
}
