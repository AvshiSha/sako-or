import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { z } from 'zod'
import * as Sentry from '@sentry/nextjs'
import { adminAuth } from '@/lib/firebase-admin'
import { resolveIsAdmin } from '@/lib/server/admin'
import { normalizeEmail } from '@/lib/admin'
import { getClientIp, isTurnstileBypassEnabled, parseAllowedHostnames } from '@/lib/turnstile'
import { verifyTurnstileToken } from '@/lib/server/turnstile'
import { ADMIN_LOGIN_ERROR_CODES, ADMIN_SESSION_COOKIE } from '@/lib/admin-session'
import { adminSessionCookieOptions, mintAdminSessionCookie } from '@/lib/server/admin-session'
import {
  checkLoginThrottle,
  hashEmail,
  recordLoginAttempt,
  recordLoginOutcome,
} from '@/lib/server/admin-login-throttle'

/**
 * Exchanges a freshly minted Firebase ID token for an admin session cookie,
 * gated on Cloudflare Turnstile.
 *
 * ## Why the password is NOT checked here
 *
 * The first version of this route took { email, password } and verified the
 * password server-side against the Identity Toolkit REST API. That is
 * incompatible with this project's Firebase Web API keys, which carry an HTTP
 * referrer restriction: a browser sends a matching Referer, a Vercel function
 * sends none, and Google answers
 *
 *     403 "Requests from referer <empty> are blocked."
 *
 * Both keys in the project behave this way, and supplying the site's own
 * Referer from the server did not help either. It reached production as
 * "Invalid email or password" on every admin login, because the old error
 * mapping collapsed unrecognised upstream errors into INVALID_CREDENTIALS.
 *
 * So the password is verified where the referrer is valid — in the browser,
 * by signInWithEmailAndPassword, exactly as before this work. This route then
 * requires a *fresh* ID token proving that sign-in succeeded, plus a valid
 * Turnstile token, before it will mint the session cookie that the admin
 * pages and APIs actually trust.
 *
 * What that does and does not buy, stated honestly:
 *  - Turnstile is still strictly enforced for ADMIN ACCESS: no Turnstile, no
 *    session cookie, and without the cookie /admin is unreachable.
 *  - It does NOT stop someone brute-forcing identitytoolkit.googleapis.com
 *    directly. It never did — see docs/admin-security-hardening.md,
 *    "Residual risk". That hole closes by removing the password provider.
 *
 * This shape is also the one compatible with Firebase App Check, since the
 * App Check token is produced in the browser.
 */

export const dynamic = 'force-dynamic'

/**
 * How old the ID token may be. Stops a token captured earlier from being
 * replayed to mint a fresh 12h session, and comfortably inside the 5 minutes
 * createSessionCookie itself allows.
 */
const MAX_AUTH_AGE_MS = 5 * 60 * 1000

const bodySchema = z.object({
  idToken: z.string().min(1),
  turnstileToken: z.string().optional(),
})

function fail(code: string, status: number, message?: string) {
  return NextResponse.json({ error: message ?? 'Login failed', code }, { status })
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers)
  const userAgent = request.headers.get('user-agent')
  let emailHash = ''

  try {
    const json = await request.json().catch(() => null)
    const parsed = bodySchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          code: ADMIN_LOGIN_ERROR_CODES.INVALID_REQUEST,
          issues: parsed.error.issues,
        },
        { status: 400 }
      )
    }
    const { idToken, turnstileToken } = parsed.data

    // 1 — Turnstile first, before any token work. A bot gets no further than
    // this, and the check cannot be reached by omitting the field.
    if (!isTurnstileBypassEnabled()) {
      const result = await verifyTurnstileToken({
        token: turnstileToken,
        remoteIp: ip,
        expectedAction: 'admin-login',
        expectedHostnames: parseAllowedHostnames(process.env.TURNSTILE_ALLOWED_HOSTNAMES),
        mode: 'reject',
        idempotencyKey: randomUUID(),
        logTag: 'ADMIN_LOGIN',
      })
      if (!result.ok) {
        await recordLoginAttempt({
          emailHash: '',
          ip,
          userAgent,
          outcome: 'failure',
          reason: `${ADMIN_LOGIN_ERROR_CODES.TURNSTILE_FAILED}:${result.reason}`,
        })
        return fail(
          ADMIN_LOGIN_ERROR_CODES.TURNSTILE_FAILED,
          403,
          'Security verification failed. Please try again.'
        )
      }
    } else {
      console.warn('[ADMIN_LOGIN] TURNSTILE BYPASS ACTIVE — local development only')
    }

    // 2 — the ID token must be real and not revoked.
    let decoded
    try {
      decoded = await adminAuth.verifyIdToken(idToken, true)
    } catch (error) {
      console.warn('[ADMIN_LOGIN] ID token rejected:', (error as any)?.errorInfo?.code ?? error)
      return fail(
        ADMIN_LOGIN_ERROR_CODES.INVALID_CREDENTIALS,
        401,
        'Your sign-in could not be verified. Please try again.'
      )
    }

    const email = normalizeEmail(decoded.email ?? null)
    emailHash = email ? hashEmail(email) : ''

    const audit = (outcome: 'success' | 'failure', reason: string) =>
      recordLoginAttempt({ emailHash, ip, userAgent, outcome, reason })

    // 3 — throttle the cookie-minting step itself.
    if (emailHash) {
      const throttle = await checkLoginThrottle(emailHash)
      if (throttle.lockedOut) {
        await audit('failure', ADMIN_LOGIN_ERROR_CODES.TOO_MANY_ATTEMPTS)
        return NextResponse.json(
          {
            error: 'Too many failed attempts. Please try again later.',
            code: ADMIN_LOGIN_ERROR_CODES.TOO_MANY_ATTEMPTS,
            retryAfterSeconds: throttle.retryAfterSeconds,
          },
          { status: 429, headers: { 'Retry-After': String(throttle.retryAfterSeconds) } }
        )
      }
    }

    // 4 — the sign-in must be recent. createSessionCookie enforces 5 minutes on
    // the token itself; auth_time pins the actual credential entry.
    const authAgeMs = Date.now() - (decoded.auth_time ?? 0) * 1000
    if (!decoded.auth_time || authAgeMs > MAX_AUTH_AGE_MS) {
      await recordLoginOutcome(emailHash, 'failure')
      await audit('failure', 'STALE_SIGN_IN')
      return fail(
        ADMIN_LOGIN_ERROR_CODES.INVALID_CREDENTIALS,
        401,
        'Your sign-in has expired. Please sign in again.'
      )
    }

    // 5 — admin authorization.
    const isAdmin = await resolveIsAdmin(email, decoded.uid)
    if (!isAdmin) {
      await recordLoginOutcome(emailHash, 'failure')
      await audit('failure', 'NOT_ADMIN')
      return fail(
        ADMIN_LOGIN_ERROR_CODES.INVALID_CREDENTIALS,
        403,
        'This account does not have admin access.'
      )
    }

    const user = await adminAuth.getUser(decoded.uid)
    if (user.disabled) {
      await audit('failure', ADMIN_LOGIN_ERROR_CODES.ACCOUNT_DISABLED)
      return fail(ADMIN_LOGIN_ERROR_CODES.ACCOUNT_DISABLED, 403, 'This account has been disabled.')
    }

    // Spread existing claims so nothing else on the record is clobbered. The
    // browser force-refreshes afterwards; firestore.rules needs this claim.
    if (user.customClaims?.admin !== true) {
      await adminAuth.setCustomUserClaims(user.uid, { ...(user.customClaims ?? {}), admin: true })
    }

    const sessionCookie = await mintAdminSessionCookie(idToken)

    await recordLoginOutcome(emailHash, 'success')
    await audit('success', 'OK')

    const response = NextResponse.json({ ok: true, claimUpdated: user.customClaims?.admin !== true })
    response.cookies.set(ADMIN_SESSION_COOKIE, sessionCookie, adminSessionCookieOptions())
    return response
  } catch (error) {
    Sentry.captureException(error)
    // Log the real cause. The previous version logged nothing on the failure
    // path, which is why a 403 from Google surfaced as "Invalid email or
    // password" with no way to tell what had actually gone wrong.
    console.error('[ADMIN_LOGIN] unexpected failure:', error)
    if (emailHash) {
      await recordLoginAttempt({
        emailHash,
        ip,
        userAgent,
        outcome: 'failure',
        reason: ADMIN_LOGIN_ERROR_CODES.LOGIN_FAILED,
      })
    }
    return fail(ADMIN_LOGIN_ERROR_CODES.LOGIN_FAILED, 500)
  }
}
