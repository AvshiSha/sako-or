import { afterEach, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { ChatbaseRequestError, withChatbaseRoute } from '../api-response'
import { resetRateLimits, RATE_LIMIT_MAX_REQUESTS } from '../rate-limit'

/**
 * Route-level behaviour without the service layer: every Chatbase route is this
 * wrapper plus a handler, so auth, rate limiting, parsing and the response
 * envelope are all exercised here.
 */

const SECRET = 'route-test-secret'
const original = process.env.CHATBASE_API_SECRET

// The wrapper logs one structured line per request; keep the test output clean.
const realLog = console.log
const realError = console.error

beforeEach(() => {
  process.env.CHATBASE_API_SECRET = SECRET
  resetRateLimits()
  console.log = () => {}
  console.error = () => {}
})

afterEach(() => {
  console.log = realLog
  console.error = realError
  if (original === undefined) delete process.env.CHATBASE_API_SECRET
  else process.env.CHATBASE_API_SECRET = original
})

function post(body: unknown, headers: Record<string, string> = { 'x-chatbase-secret': SECRET }) {
  return new Request('https://example.test/api/chatbase/test', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

const echo = withChatbaseRoute('test_route', async (body) => ({ echoed: body }))

describe('authentication', () => {
  it('accepts a valid x-chatbase-secret', async () => {
    const response = await echo(post({ a: 1 }))
    assert.equal(response.status, 200)
    const json = await response.json()
    assert.equal(json.success, true)
    assert.deepEqual(json.data.echoed, { a: 1 })
  })

  it('accepts a valid Bearer token', async () => {
    const response = await echo(post({}, { authorization: `Bearer ${SECRET}` }))
    assert.equal(response.status, 200)
  })

  it('returns 401 for a missing secret', async () => {
    const response = await echo(post({}, {}))
    assert.equal(response.status, 401)
    const json = await response.json()
    assert.equal(json.success, false)
    assert.equal(json.error.code, 'UNAUTHORIZED')
  })

  it('returns 401 for a wrong secret', async () => {
    const response = await echo(post({}, { 'x-chatbase-secret': 'nope' }))
    assert.equal(response.status, 401)
  })

  it('returns 500 and fails closed when the server secret is unset', async () => {
    delete process.env.CHATBASE_API_SECRET
    const response = await echo(post({}, { 'x-chatbase-secret': SECRET }))
    assert.equal(response.status, 500)
    assert.equal((await response.json()).error.code, 'ENDPOINT_NOT_CONFIGURED')
  })

  it('never echoes the supplied credential back', async () => {
    const response = await echo(post({}, { 'x-chatbase-secret': 'leaky-value' }))
    assert.equal((await response.text()).includes('leaky-value'), false)
  })
})

describe('rate limiting', () => {
  it('returns 429 once the window budget is spent', async () => {
    for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i++) {
      assert.equal((await echo(post({}))).status, 200)
    }
    const response = await echo(post({}))
    assert.equal(response.status, 429)
    assert.equal((await response.json()).error.code, 'RATE_LIMITED')
  })

  it('checks auth before the rate limit, so an attacker cannot exhaust it', async () => {
    for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS + 5; i++) {
      await echo(post({}, { 'x-chatbase-secret': 'wrong' }))
    }
    assert.equal((await echo(post({}))).status, 200)
  })
})

describe('request parsing', () => {
  it('rejects malformed JSON with a 400', async () => {
    const response = await echo(post('{not json'))
    assert.equal(response.status, 400)
    assert.equal((await response.json()).error.code, 'INVALID_REQUEST')
  })

  it('rejects a JSON array or scalar body', async () => {
    assert.equal((await echo(post([1, 2]))).status, 400)
    assert.equal((await echo(post('"a string"'))).status, 400)
  })
})

describe('response envelope', () => {
  it('carries a request id on success and on failure', async () => {
    const ok = await (await echo(post({}))).json()
    assert.match(ok.requestId, /^[0-9a-f-]{36}$/)
    const bad = await (await echo(post({}, {}))).json()
    assert.match(bad.requestId, /^[0-9a-f-]{36}$/)
  })

  it('gives each request its own id', async () => {
    const first = await (await echo(post({}))).json()
    const second = await (await echo(post({}))).json()
    assert.notEqual(first.requestId, second.requestId)
  })

  it('is never cached', async () => {
    const response = await echo(post({}))
    assert.equal(response.headers.get('cache-control'), 'no-store')
  })

  it('surfaces a validation failure as a 400 with a field map', async () => {
    const route = withChatbaseRoute('test_route', async () => {
      throw new ChatbaseRequestError('INVALID_REQUEST', {
        maxHeelHeightCm: 'Must be a non-negative number.',
      })
    })
    const response = await route(post({}))
    assert.equal(response.status, 400)
    const json = await response.json()
    assert.equal(json.error.code, 'INVALID_REQUEST')
    assert.equal(json.error.fields.maxHeelHeightCm, 'Must be a non-negative number.')
  })

  it('never leaks an internal error message or stack trace', async () => {
    const route = withChatbaseRoute('test_route', async () => {
      throw new Error('connect ECONNREFUSED 10.0.0.1:5432 — password=hunter2')
    })
    const response = await route(post({}))
    assert.equal(response.status, 500)
    const text = await response.text()
    assert.equal(text.includes('ECONNREFUSED'), false)
    assert.equal(text.includes('hunter2'), false)
    assert.equal(text.includes('at '), false, 'no stack frames')
    assert.equal(JSON.parse(text).error.code, 'INTERNAL_ERROR')
  })
})
