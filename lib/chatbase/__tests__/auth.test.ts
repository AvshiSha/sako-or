import { afterEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { verifyChatbaseRequest } from '../auth'
import { consumeRateLimit, resetRateLimits, RATE_LIMIT_MAX_REQUESTS } from '../rate-limit'

const SECRET = 'test-secret-value-long-enough'
const original = process.env.CHATBASE_API_SECRET

afterEach(() => {
  if (original === undefined) delete process.env.CHATBASE_API_SECRET
  else process.env.CHATBASE_API_SECRET = original
})

function request(headers: Record<string, string> = {}): Request {
  return new Request('https://example.test/api/chatbase/search-shoes', {
    method: 'POST',
    headers,
  })
}

describe('verifyChatbaseRequest', () => {
  it('accepts the secret in x-chatbase-secret', () => {
    process.env.CHATBASE_API_SECRET = SECRET
    assert.deepEqual(verifyChatbaseRequest(request({ 'x-chatbase-secret': SECRET })), { ok: true })
  })

  it('accepts the secret as a Bearer token', () => {
    process.env.CHATBASE_API_SECRET = SECRET
    assert.deepEqual(
      verifyChatbaseRequest(request({ authorization: `Bearer ${SECRET}` })),
      { ok: true }
    )
    // Case-insensitively, since header casing is not guaranteed.
    assert.deepEqual(
      verifyChatbaseRequest(request({ authorization: `bearer ${SECRET}` })),
      { ok: true }
    )
  })

  it('rejects a missing secret', () => {
    process.env.CHATBASE_API_SECRET = SECRET
    assert.deepEqual(verifyChatbaseRequest(request()), { ok: false, reason: 'unauthorized' })
  })

  it('rejects an empty secret', () => {
    process.env.CHATBASE_API_SECRET = SECRET
    assert.deepEqual(
      verifyChatbaseRequest(request({ 'x-chatbase-secret': '' })),
      { ok: false, reason: 'unauthorized' }
    )
  })

  it('rejects a wrong secret', () => {
    process.env.CHATBASE_API_SECRET = SECRET
    assert.deepEqual(
      verifyChatbaseRequest(request({ 'x-chatbase-secret': 'wrong' })),
      { ok: false, reason: 'unauthorized' }
    )
  })

  it('rejects a secret of the right length but wrong content', () => {
    // Guards the constant-time comparison, which needs equal lengths to run.
    process.env.CHATBASE_API_SECRET = SECRET
    const sameLength = 'x'.repeat(SECRET.length)
    assert.deepEqual(
      verifyChatbaseRequest(request({ 'x-chatbase-secret': sameLength })),
      { ok: false, reason: 'unauthorized' }
    )
  })

  it('rejects a secret that merely starts with the right value', () => {
    process.env.CHATBASE_API_SECRET = SECRET
    assert.deepEqual(
      verifyChatbaseRequest(request({ 'x-chatbase-secret': `${SECRET}extra` })),
      { ok: false, reason: 'unauthorized' }
    )
  })

  it('fails closed when the server has no secret configured', () => {
    // An unset secret must never mean "open to everyone".
    delete process.env.CHATBASE_API_SECRET
    assert.deepEqual(
      verifyChatbaseRequest(request({ 'x-chatbase-secret': SECRET })),
      { ok: false, reason: 'not_configured' }
    )
    assert.deepEqual(verifyChatbaseRequest(request()), { ok: false, reason: 'not_configured' })
  })

  it('fails closed on an empty configured secret', () => {
    process.env.CHATBASE_API_SECRET = ''
    assert.deepEqual(
      verifyChatbaseRequest(request({ 'x-chatbase-secret': '' })),
      { ok: false, reason: 'not_configured' }
    )
  })
})

describe('consumeRateLimit', () => {
  it('allows a normal conversation and blocks a runaway loop', () => {
    resetRateLimits()
    for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i++) {
      assert.equal(consumeRateLimit('route'), true, `request ${i + 1} should be allowed`)
    }
    assert.equal(consumeRateLimit('route'), false)
  })

  it('counts each route separately', () => {
    resetRateLimits()
    for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i++) consumeRateLimit('a')
    assert.equal(consumeRateLimit('a'), false)
    assert.equal(consumeRateLimit('b'), true)
  })

  it('recovers once the window rolls over', () => {
    resetRateLimits()
    const start = 1_000_000
    for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i++) consumeRateLimit('route', start)
    assert.equal(consumeRateLimit('route', start), false)
    assert.equal(consumeRateLimit('route', start + 60_001), true)
  })
})
