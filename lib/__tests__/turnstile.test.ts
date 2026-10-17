import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  evaluateTurnstileResponse,
  getClientIp,
  isTurnstileBypassEnabled,
  parseAllowedHostnames,
  type TurnstileSiteverifyResponse,
} from '../turnstile'

const ok = (over: Partial<TurnstileSiteverifyResponse> = {}): TurnstileSiteverifyResponse => ({
  success: true,
  hostname: 'www.sako-or.com',
  action: 'admin-login',
  challenge_ts: '2026-10-17T10:00:00.000Z',
  ...over,
})

describe('evaluateTurnstileResponse', () => {
  it('accepts a successful response when nothing is pinned', () => {
    const result = evaluateTurnstileResponse(ok())
    assert.equal(result.ok, true)
    if (result.ok) {
      assert.equal(result.hostname, 'www.sako-or.com')
      assert.equal(result.action, 'admin-login')
      assert.equal(result.challengeTs, '2026-10-17T10:00:00.000Z')
    }
  })

  it('rejects an unsuccessful response and surfaces the error codes', () => {
    const result = evaluateTurnstileResponse({
      success: false,
      'error-codes': ['timeout-or-duplicate'],
    })
    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.equal(result.reason, 'TOKEN_REJECTED')
      assert.deepEqual(result.errorCodes, ['timeout-or-duplicate'])
    }
  })

  it('reports an unreachable siteverify distinctly from a rejected token', () => {
    const result = evaluateTurnstileResponse(null)
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.reason, 'SITEVERIFY_UNREACHABLE')
  })

  it('rejects a hostname mismatch in reject mode', () => {
    const result = evaluateTurnstileResponse(ok({ hostname: 'evil.example' }), {
      expectedHostnames: ['www.sako-or.com'],
    })
    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.equal(result.reason, 'HOSTNAME_MISMATCH')
      assert.equal(result.observed?.hostname, 'evil.example')
    }
  })

  it('accepts a hostname mismatch in shadow mode, but reports it', () => {
    const seen: string[] = []
    const result = evaluateTurnstileResponse(ok({ hostname: 'evil.example' }), {
      expectedHostnames: ['www.sako-or.com'],
      mode: 'shadow',
      onMismatch: (d) => seen.push(d.reason),
    })
    assert.equal(result.ok, true)
    assert.deepEqual(seen, ['HOSTNAME_MISMATCH'])
  })

  it('matches hostnames case-insensitively and ignores surrounding space', () => {
    const result = evaluateTurnstileResponse(ok({ hostname: '  WWW.Sako-Or.COM ' }), {
      expectedHostnames: ['www.sako-or.com'],
    })
    assert.equal(result.ok, true)
  })

  it('rejects an action mismatch — a contact-form token replayed at the login route', () => {
    const result = evaluateTurnstileResponse(ok({ action: 'contact' }), {
      expectedAction: 'admin-login',
    })
    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.equal(result.reason, 'ACTION_MISMATCH')
      assert.equal(result.observed?.action, 'contact')
    }
  })

  it('skips both checks when no expectations are given', () => {
    // This is what the pre-existing OTP/contact behaviour relied on; the
    // refactor must not start rejecting tokens it used to accept.
    const result = evaluateTurnstileResponse(ok({ hostname: 'anything', action: 'whatever' }))
    assert.equal(result.ok, true)
  })

  it('treats an empty expectedHostnames array as "do not check"', () => {
    const result = evaluateTurnstileResponse(ok({ hostname: 'anything' }), {
      expectedHostnames: [],
    })
    assert.equal(result.ok, true)
  })

  it('rejects a missing hostname when one is pinned', () => {
    const result = evaluateTurnstileResponse(ok({ hostname: undefined }), {
      expectedHostnames: ['www.sako-or.com'],
    })
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.reason, 'HOSTNAME_MISMATCH')
  })
})

describe('getClientIp', () => {
  it('prefers cf-connecting-ip over x-forwarded-for', () => {
    // Cloudflare writes cf-connecting-ip; the first x-forwarded-for entry is
    // attacker-supplied in principle. The preference is the whole point.
    const headers = new Headers({
      'cf-connecting-ip': '203.0.113.9',
      'x-real-ip': '198.51.100.2',
      'x-forwarded-for': '1.2.3.4, 5.6.7.8',
    })
    assert.equal(getClientIp(headers), '203.0.113.9')
  })

  it('falls back to x-real-ip, then to the first x-forwarded-for entry', () => {
    assert.equal(
      getClientIp(new Headers({ 'x-real-ip': '198.51.100.2', 'x-forwarded-for': '1.2.3.4' })),
      '198.51.100.2'
    )
    assert.equal(
      getClientIp(new Headers({ 'x-forwarded-for': '  1.2.3.4 , 5.6.7.8' })),
      '1.2.3.4'
    )
  })

  it('returns null when nothing identifies the caller', () => {
    assert.equal(getClientIp(new Headers()), null)
    assert.equal(getClientIp(new Headers({ 'x-forwarded-for': '   ' })), null)
  })
})

describe('parseAllowedHostnames', () => {
  it('splits on commas and whitespace and normalizes case', () => {
    assert.deepEqual(parseAllowedHostnames('www.sako-or.com, SAKO-OR.com\n localhost'), [
      'www.sako-or.com',
      'sako-or.com',
      'localhost',
    ])
  })

  it('returns an empty list for undefined or blank input', () => {
    assert.deepEqual(parseAllowedHostnames(undefined), [])
    assert.deepEqual(parseAllowedHostnames('   '), [])
  })
})

describe('isTurnstileBypassEnabled', () => {
  it('is false on Vercel even when the flag is set', () => {
    // The load-bearing case: Vercel sets VERCEL=1 in production, preview AND
    // development, so the bypass cannot be switched on from the dashboard.
    assert.equal(isTurnstileBypassEnabled({ TURNSTILE_DEV_BYPASS: '1', VERCEL: '1' } as any), false)
  })

  it('is false on Vercel regardless of NODE_ENV', () => {
    assert.equal(
      isTurnstileBypassEnabled({
        TURNSTILE_DEV_BYPASS: '1',
        VERCEL: '1',
        NODE_ENV: 'development',
      } as any),
      false
    )
  })

  it('is false when the flag is absent or not exactly "1"', () => {
    assert.equal(isTurnstileBypassEnabled({} as any), false)
    assert.equal(isTurnstileBypassEnabled({ TURNSTILE_DEV_BYPASS: 'true' } as any), false)
    assert.equal(isTurnstileBypassEnabled({ TURNSTILE_DEV_BYPASS: '0' } as any), false)
  })

  it('is true only for the exact local-development combination', () => {
    assert.equal(isTurnstileBypassEnabled({ TURNSTILE_DEV_BYPASS: '1' } as any), true)
  })

  it('stays true under a local production build, which is the Playwright target', () => {
    // next build && next start sets NODE_ENV=production locally. Keying the
    // bypass off NODE_ENV would break local production-build debugging; the
    // VERCEL check is what provides the real protection.
    assert.equal(
      isTurnstileBypassEnabled({ TURNSTILE_DEV_BYPASS: '1', NODE_ENV: 'production' } as any),
      true
    )
  })
})
