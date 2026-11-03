import test from 'node:test'
import assert from 'node:assert/strict'

import { buildAuthorizationResponse, getIssuer } from '@/lib/mcp/oauth/config'

/**
 * RFC 9207 issuer identification on the authorization response.
 *
 * The server metadata sets `authorization_response_iss_parameter_supported`,
 * and a client that reads that flag MUST reject an authorization response
 * without an `iss` parameter. That is precisely what happened on the first two
 * real ChatGPT connections: the metadata claimed support, none of the three
 * redirect sites sent the parameter, and ChatGPT discarded the authorization
 * code rather than exchanging it.
 *
 * Every authorization response now goes through one builder, and these tests
 * hold it to the claim.
 */

const ISSUER = 'https://www.sako-or.com'
const CALLBACK = 'https://chatgpt.com/connector_platform_oauth_redirect'

const originalIssuer = process.env.MCP_OAUTH_ISSUER
process.env.MCP_OAUTH_ISSUER = ISSUER

test.after(() => {
  if (originalIssuer === undefined) delete process.env.MCP_OAUTH_ISSUER
  else process.env.MCP_OAUTH_ISSUER = originalIssuer
})

test('a successful authorization response carries iss', () => {
  const url = buildAuthorizationResponse(CALLBACK, { code: 'abc123', state: 'xyz' })
  assert.equal(url.searchParams.get('iss'), ISSUER)
  assert.equal(url.searchParams.get('code'), 'abc123')
  assert.equal(url.searchParams.get('state'), 'xyz')
})

test('an error authorization response carries iss too', () => {
  // RFC 9207 does not exempt error responses, and a validating client rejects
  // one that omits the parameter just as it would a successful one.
  const url = buildAuthorizationResponse(CALLBACK, {
    error: 'access_denied',
    error_description: 'The user declined the request.',
    state: 'xyz',
  })
  assert.equal(url.searchParams.get('iss'), ISSUER)
  assert.equal(url.searchParams.get('error'), 'access_denied')
})

test('iss matches the issuer the metadata advertises', () => {
  // A mismatch is as bad as an absence: the client compares the two.
  const url = buildAuthorizationResponse(CALLBACK, { code: 'abc' })
  assert.equal(url.searchParams.get('iss'), getIssuer())
})

test('iss cannot be overridden by a caller-supplied parameter', () => {
  const url = buildAuthorizationResponse(CALLBACK, { code: 'abc', iss: 'https://evil.test' })
  assert.equal(url.searchParams.get('iss'), ISSUER)
})

test('absent parameters are omitted rather than sent as "undefined"', () => {
  // `state` is optional; a literal "undefined" in the query string would be
  // echoed back to the client as a real value.
  const url = buildAuthorizationResponse(CALLBACK, { code: 'abc', state: undefined })
  assert.equal(url.searchParams.has('state'), false)
  assert.equal(url.searchParams.get('code'), 'abc')
})

test('a null state is omitted', () => {
  // The stored auth request holds `state: string | null`.
  const url = buildAuthorizationResponse(CALLBACK, { code: 'abc', state: null })
  assert.equal(url.searchParams.has('state'), false)
})

test('the callback origin and path survive untouched', () => {
  const url = buildAuthorizationResponse(CALLBACK, { code: 'abc' })
  assert.equal(url.origin, 'https://chatgpt.com')
  assert.equal(url.pathname, '/connector_platform_oauth_redirect')
})

test('an existing query string on the callback is preserved', () => {
  const url = buildAuthorizationResponse(`${CALLBACK}?tenant=sako`, { code: 'abc' })
  assert.equal(url.searchParams.get('tenant'), 'sako')
  assert.equal(url.searchParams.get('code'), 'abc')
  assert.equal(url.searchParams.get('iss'), ISSUER)
})

test('values are encoded, not injected', () => {
  const url = buildAuthorizationResponse(CALLBACK, {
    error: 'access_denied',
    error_description: 'declined & aborted?code=injected',
  })
  assert.equal(url.searchParams.get('error_description'), 'declined & aborted?code=injected')
  assert.equal(url.searchParams.get('code'), null, 'a value must not become a separate parameter')
})
