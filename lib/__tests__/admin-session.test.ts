import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  ADMIN_LOGIN_ERROR_CODES,
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_TTL_MS,
  FIREBASE_SESSION_COOKIE_MAX_TTL_MS,
} from '../admin-session'

describe('admin session constants', () => {
  it('stays inside the TTL range Firebase accepts for a session cookie', () => {
    const FIVE_MINUTES = 5 * 60 * 1000
    assert.ok(
      ADMIN_SESSION_TTL_MS >= FIVE_MINUTES,
      'createSessionCookie rejects anything under 5 minutes'
    )
    assert.ok(
      ADMIN_SESSION_TTL_MS <= FIREBASE_SESSION_COOKIE_MAX_TTL_MS,
      'createSessionCookie rejects anything over 14 days'
    )
  })

  it('uses a cookie name matching the current environment', () => {
    // __Host- requires Secure, which Safari refuses on http://localhost — so
    // the prefixed name is production-only and local dev gets a plain one.
    if (process.env.NODE_ENV === 'production') {
      assert.equal(ADMIN_SESSION_COOKIE, '__Host-sako_admin')
    } else {
      assert.equal(ADMIN_SESSION_COOKIE, 'sako_admin_dev')
    }
  })

  it('never uses a __Host- name without the constraints that prefix requires', () => {
    // A __Host- cookie MUST be Secure, Path=/ and have no Domain. If the name
    // is ever made unconditional, adminSessionCookieOptions has to match.
    if (ADMIN_SESSION_COOKIE.startsWith('__Host-')) {
      assert.equal(process.env.NODE_ENV, 'production')
    }
  })

  it('exposes every login error code as its own literal value', () => {
    for (const [key, value] of Object.entries(ADMIN_LOGIN_ERROR_CODES)) {
      assert.equal(key, value, 'codes are used as wire values; key and value must agree')
    }
  })
})
