import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash, randomBytes } from 'node:crypto'

import {
  GRANTABLE_SCOPES,
  SCOPE_CONTENT_PUBLISH,
  SCOPE_CONTENT_READ,
  SCOPE_CONTENT_WRITE,
  SCOPE_OFFLINE_ACCESS,
  isAllowedRedirectUri,
  negotiateScopes,
} from '@/lib/mcp/oauth/config'
import {
  constantTimeEquals,
  generateOtpCode,
  generateToken,
  hashToken,
  verifyPkceS256,
} from '@/lib/mcp/oauth/crypto'
import { parseContentEditorEmails } from '@/lib/admin'

// ── Redirect URI allowlist ─────────────────────────────────────────────────

test('ChatGPT callbacks are accepted', () => {
  for (const uri of [
    'https://chatgpt.com/connector_platform_oauth_redirect',
    'https://chat.openai.com/aip/callback',
    'https://platform.openai.com/oauth/callback',
    'https://sub.chatgpt.com/callback',
  ]) {
    assert.equal(isAllowedRedirectUri(uri), true, `${uri} should be allowed`)
  }
})

test('a lookalike domain is refused', () => {
  // The reason this is a host allowlist and not a regex: /chatgpt\.com/ would
  // match every one of these.
  for (const uri of [
    'https://chatgpt.com.evil.test/callback',
    'https://evilchatgpt.com/callback',
    'https://notchatgpt.com/callback',
    'https://chatgpt.com.attacker.io/cb',
    'https://chatgptxcom/cb',
  ]) {
    assert.equal(isAllowedRedirectUri(uri), false, `${uri} must be refused`)
  }
})

test('non-https, credentialed and fragment redirect URIs are refused', () => {
  for (const uri of [
    'http://chatgpt.com/callback',
    'https://user:pass@chatgpt.com/callback',
    'https://chatgpt.com/callback#fragment',
    'javascript:alert(1)',
    'data:text/html,x',
    'not a url',
    '',
  ]) {
    assert.equal(isAllowedRedirectUri(uri), false, `${uri} must be refused`)
  }
})

test('an arbitrary third-party host is refused', () => {
  assert.equal(isAllowedRedirectUri('https://example.com/callback'), false)
  assert.equal(isAllowedRedirectUri('https://localhost/callback'), false)
  assert.equal(isAllowedRedirectUri('https://127.0.0.1/callback'), false)
})

// ── Scope negotiation ──────────────────────────────────────────────────────

test('an empty scope request grants read only', () => {
  // Granting write to a request that asked for nothing would make the scope
  // system decorative.
  assert.deepEqual(negotiateScopes(undefined), [SCOPE_CONTENT_READ])
  assert.deepEqual(negotiateScopes(''), [SCOPE_CONTENT_READ])
  assert.deepEqual(negotiateScopes('   '), [SCOPE_CONTENT_READ])
})

test('write implies read', () => {
  const granted = negotiateScopes(SCOPE_CONTENT_WRITE)
  assert.ok(granted.includes(SCOPE_CONTENT_READ))
  assert.ok(granted.includes(SCOPE_CONTENT_WRITE))
})

test('offline_access is granted when asked for', () => {
  const granted = negotiateScopes(`${SCOPE_CONTENT_WRITE} ${SCOPE_OFFLINE_ACCESS}`)
  assert.ok(granted.includes(SCOPE_OFFLINE_ACCESS))
})

test('content:publish is never granted, however it is requested', () => {
  // Publication is a cron transition, not something a token can authorize.
  for (const request of [
    SCOPE_CONTENT_PUBLISH,
    `${SCOPE_CONTENT_WRITE} ${SCOPE_CONTENT_PUBLISH}`,
    `${SCOPE_CONTENT_PUBLISH} ${SCOPE_OFFLINE_ACCESS}`,
  ]) {
    assert.ok(
      !negotiateScopes(request).includes(SCOPE_CONTENT_PUBLISH),
      `content:publish must not be granted for "${request}"`
    )
  }
  assert.ok(!(GRANTABLE_SCOPES as readonly string[]).includes(SCOPE_CONTENT_PUBLISH))
})

test('unknown scopes are dropped, not granted', () => {
  const granted = negotiateScopes('admin superuser content:read products:write')
  assert.deepEqual(granted, [SCOPE_CONTENT_READ])
})

test('a request of only unknown scopes falls back to read', () => {
  assert.deepEqual(negotiateScopes('admin everything'), [SCOPE_CONTENT_READ])
})

test('duplicate scopes collapse', () => {
  const granted = negotiateScopes('content:read content:read content:write')
  assert.equal(new Set(granted).size, granted.length)
})

// ── PKCE ───────────────────────────────────────────────────────────────────

function challengeFor(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url')
}

test('a correct S256 verifier passes', () => {
  const verifier = randomBytes(32).toString('base64url')
  assert.equal(verifyPkceS256(verifier, challengeFor(verifier)), true)
})

test('a wrong verifier fails', () => {
  const verifier = randomBytes(32).toString('base64url')
  const other = randomBytes(32).toString('base64url')
  assert.equal(verifyPkceS256(other, challengeFor(verifier)), false)
})

test('a plain verifier presented as its own challenge fails', () => {
  // This is what accepting `plain` PKCE would amount to: no protection at all.
  const verifier = randomBytes(32).toString('base64url')
  assert.equal(verifyPkceS256(verifier, verifier), false)
})

test('a verifier outside the RFC 7636 length bounds fails', () => {
  const short = 'a'.repeat(42)
  const long = 'a'.repeat(129)
  assert.equal(verifyPkceS256(short, challengeFor(short)), false)
  assert.equal(verifyPkceS256(long, challengeFor(long)), false)
  // 43 and 128 are the inclusive bounds and must pass.
  const min = 'a'.repeat(43)
  const max = 'a'.repeat(128)
  assert.equal(verifyPkceS256(min, challengeFor(min)), true)
  assert.equal(verifyPkceS256(max, challengeFor(max)), true)
})

test('a verifier with characters outside the unreserved set fails', () => {
  const bad = `${'a'.repeat(42)}!`
  assert.equal(verifyPkceS256(bad, challengeFor(bad)), false)
})

test('empty inputs fail', () => {
  assert.equal(verifyPkceS256('', ''), false)
  assert.equal(verifyPkceS256('a'.repeat(43), ''), false)
  assert.equal(verifyPkceS256('', 'x'), false)
})

// ── Token material ─────────────────────────────────────────────────────────

test('tokens are 256 bits of base64url and do not repeat', () => {
  const seen = new Set<string>()
  for (let i = 0; i < 200; i++) {
    const token = generateToken()
    assert.match(token, /^[A-Za-z0-9_-]{43}$/)
    assert.ok(!seen.has(token), 'generated a duplicate token')
    seen.add(token)
  }
})

test('hashing is stable and one-way in shape', () => {
  const token = generateToken()
  assert.equal(hashToken(token), hashToken(token))
  assert.match(hashToken(token), /^[0-9a-f]{64}$/)
  assert.notEqual(hashToken(token), token)
})

test('different tokens hash differently', () => {
  assert.notEqual(hashToken(generateToken()), hashToken(generateToken()))
})

test('OTP codes are six digits and well distributed', () => {
  // Also covers the leading-zero case, which a naive
  // Math.floor(100000 + random*900000) can never produce.
  const seen = new Set<string>()
  for (let i = 0; i < 3000; i++) {
    const code = generateOtpCode()
    assert.match(code, /^\d{6}$/)
    seen.add(code)
  }
  assert.ok(seen.size > 2500, `expected high variety, saw ${seen.size} distinct codes`)
})

test('constant-time comparison still compares correctly', () => {
  assert.equal(constantTimeEquals('abc', 'abc'), true)
  assert.equal(constantTimeEquals('abc', 'abd'), false)
  assert.equal(constantTimeEquals('abc', 'abcd'), false)
  assert.equal(constantTimeEquals('', ''), true)
})

// ── Content editor allowlist parsing ───────────────────────────────────────

test('the editor email allowlist is parsed and normalized', () => {
  assert.deepEqual(parseContentEditorEmails('  SEO@Example.com , other@x.co '), [
    'seo@example.com',
    'other@x.co',
  ])
})

test('an empty or unset allowlist yields nothing', () => {
  // Combined with resolveContentRole requiring membership, an unset variable
  // means nobody is authorized — fail closed.
  assert.deepEqual(parseContentEditorEmails(undefined), [])
  assert.deepEqual(parseContentEditorEmails(''), [])
  assert.deepEqual(parseContentEditorEmails('  ,  , '), [])
})
