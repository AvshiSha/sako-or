import test from 'node:test'
import assert from 'node:assert/strict'

import { runTool, toolResult } from '@/lib/mcp/responses'
import { McpValidationError } from '@/lib/mcp/validation'
import { changedFieldNames } from '@/lib/mcp/audit-diff'
import {
  MCP_RATE_LIMIT_MAX_CALLS,
  MCP_RATE_LIMIT_MAX_UPLOADS,
  consumeToolCall,
  consumeUpload,
  resetMcpRateLimits,
} from '@/lib/mcp/rate-limit'

/** The text block, which is what ChatGPT actually reads. */
function textOf(result: Awaited<ReturnType<typeof runTool>>): string {
  const block = result.content?.[0]
  return block && 'text' in block ? String(block.text) : ''
}

// ── Envelope ───────────────────────────────────────────────────────────────

test('a success carries both a text block and structured content', () => {
  const result = toolResult({
    ok: true,
    contentId: 'abc',
    contentType: 'blog_article',
    status: 'draft',
  })
  assert.ok(textOf(result).startsWith('OK'))
  assert.equal(result.isError, false)
  assert.equal((result.structuredContent as Record<string, unknown>).contentId, 'abc')
})

test('a failure is flagged as an error and lists what went wrong', () => {
  const result = toolResult({
    ok: false,
    errorCode: 'FORBIDDEN_FIELD',
    errors: ['status cannot be set.'],
  })
  assert.equal(result.isError, true)
  assert.match(textOf(result), /FAILED \(FORBIDDEN_FIELD\)/)
  assert.match(textOf(result), /status cannot be set/)
})

test('a schedule result states the local time and the UTC instant', () => {
  const result = toolResult({
    ok: true,
    contentId: 'abc',
    status: 'scheduled',
    publishAt: '2026-01-15T07:00:00.000Z',
  })
  const text = textOf(result)
  // Both, because "09:00" alone is ambiguous and "07:00Z" alone is not what
  // the editor asked for.
  assert.match(text, /2026-01-15 09:00/)
  assert.match(text, /Asia\/Jerusalem/)
  assert.match(text, /2026-01-15T07:00:00\.000Z/)
})

test('a published result separates publication from indexing', () => {
  // The brief is explicit that these are different statuses and that nothing
  // should promise indexing.
  const text = textOf(toolResult({ ok: true, status: 'published', url: 'https://x/he/news/a' }))
  assert.match(text, /indexing is a separate process/i)
  assert.ok(!/will be indexed|will appear in Google|Discover/i.test(text))
})

test('a conflict tells the caller how to recover', () => {
  const text = textOf(
    toolResult({
      ok: false,
      errorCode: 'CONFLICT',
      updatedAt: '2026-01-15T10:00:00.000Z',
      errors: ['This article changed since you read it.'],
    })
  )
  assert.match(text, /re-read it/i)
  assert.match(text, /2026-01-15T10:00:00\.000Z/)
})

test('a reused create says so instead of implying a new article', () => {
  const text = textOf(toolResult({ ok: true, created: false, contentId: 'abc' }))
  assert.match(text, /existing one was reused/i)
})

test('warnings are surfaced on success', () => {
  const text = textOf(toolResult({ ok: true, warnings: ['markup was removed'] }))
  assert.match(text, /Note: markup was removed/)
})

// ── runTool error handling ─────────────────────────────────────────────────

test('a validation error becomes a readable result, not a protocol error', () => {
  // An MCP protocol error reaches the model as an opaque failure it cannot act
  // on; a result it can read gets corrected on the next call.
  return runTool('t', 'req-1', async () => {
    throw new McpValidationError('INVALID_REQUEST', ['slug is required.'])
  }).then((result) => {
    assert.equal(result.isError, true)
    assert.match(textOf(result), /slug is required/)
    assert.equal((result.structuredContent as Record<string, unknown>).errorCode, 'INVALID_REQUEST')
  })
})

test('an unexpected error never leaks its message', async () => {
  const result = await runTool('t', 'req-2', async () => {
    throw new Error('Firestore: permission denied on project sako-or, key AIzaSyC-SECRET')
  })
  const serialized = JSON.stringify(result)
  assert.ok(!serialized.includes('AIzaSyC-SECRET'))
  assert.ok(!serialized.includes('permission denied'))
  assert.ok(!serialized.includes('Firestore'))
  assert.match(textOf(result), /could not be completed/i)
})

test('no tool result contains an environment variable value', async () => {
  // A blanket check over the envelope: the integration must never return a
  // credential, and the cheapest way to be sure is to look.
  const sentinels = [
    'FIREBASE_PRIVATE_KEY',
    'CRON_SECRET',
    'ADMIN_API_KEY',
    'DATABASE_URL',
    'CHATBASE_API_SECRET',
    'RESEND_API_KEY',
  ]

  const results = [
    toolResult({ ok: true, contentId: 'a', status: 'draft', url: 'https://x/he/news/a' }),
    toolResult({ ok: false, errorCode: 'INTERNAL_ERROR', errors: ['nope'] }),
    await runTool('t', 'req-3', async () => {
      throw new Error('boom')
    }),
  ]

  for (const result of results) {
    const serialized = JSON.stringify(result)
    for (const name of sentinels) {
      const value = process.env[name]
      if (value && value.length > 8) {
        assert.ok(!serialized.includes(value), `${name}'s value leaked into a tool result`)
      }
      assert.ok(!serialized.includes(name), `the name ${name} appeared in a tool result`)
    }
  }
})

// ── Rate limiting ──────────────────────────────────────────────────────────

test('a subject is cut off after its budget and recovers in the next window', () => {
  resetMcpRateLimits()
  const now = 1_000_000

  for (let i = 0; i < MCP_RATE_LIMIT_MAX_CALLS; i++) {
    assert.equal(consumeToolCall('a@x.co', now), true, `call ${i + 1} should be allowed`)
  }
  assert.equal(consumeToolCall('a@x.co', now), false, 'the budget must run out')
  assert.equal(consumeToolCall('a@x.co', now + 61_000), true, 'the window must roll over')
})

test('budgets are per subject', () => {
  resetMcpRateLimits()
  const now = 2_000_000
  for (let i = 0; i < MCP_RATE_LIMIT_MAX_CALLS; i++) consumeToolCall('a@x.co', now)
  assert.equal(consumeToolCall('a@x.co', now), false)
  assert.equal(consumeToolCall('b@x.co', now), true, 'one subject must not exhaust another')
})

test('uploads have their own, tighter budget', () => {
  resetMcpRateLimits()
  const now = 3_000_000
  assert.ok(MCP_RATE_LIMIT_MAX_UPLOADS < MCP_RATE_LIMIT_MAX_CALLS)
  for (let i = 0; i < MCP_RATE_LIMIT_MAX_UPLOADS; i++) {
    assert.equal(consumeUpload('a@x.co', now), true)
  }
  assert.equal(consumeUpload('a@x.co', now), false)
  // Spending the upload budget must not have spent the general one.
  assert.equal(consumeToolCall('a@x.co', now), true)
})

// ── Audit diffing ──────────────────────────────────────────────────────────

test('only genuinely changed fields are recorded', () => {
  const before = { title: { he: 'א', en: 'A' }, slug: 'old' }
  const after = { title: { he: 'א', en: 'A' }, slug: 'new' }
  assert.deepEqual(changedFieldNames(before, after), ['slug'])
})

test('a create records every supplied field', () => {
  assert.deepEqual(changedFieldNames(null, { slug: 'a', title: {} }), ['slug', 'title'])
})

test('a nested change is detected', () => {
  const before = { title: { he: 'א', en: 'A' } }
  const after = { title: { he: 'ב', en: 'A' } }
  assert.deepEqual(changedFieldNames(before, after), ['title'])
})
