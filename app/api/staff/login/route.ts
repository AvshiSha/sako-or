import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { z } from 'zod'
import * as Sentry from '@sentry/nextjs'

import { adminAuth } from '@/lib/firebase-admin'
import { normalizeEmail } from '@/lib/admin'
import { resolveStaffAccess } from '@/lib/server/staff'
import { getClientIp, isTurnstileBypassEnabled, parseAllowedHostnames } from '@/lib/turnstile'
import { verifyTurnstileToken } from '@/lib/server/turnstile'
import { STAFF_LOGIN_ERROR_CODES, STAFF_SESSION_COOKIE } from '@/lib/staff-session'
import {
  mintStaffSessionCookie,
  staffSessionCookieOptions,
} from '@/lib/server/staff-session'
import {
  checkLoginThrottle,
  hashEmail,
  recordLoginAttempt,
  recordLoginOutcome,
} from '@/lib/server/admin-login-throttle'

/**
 * Exchanges a freshly minted Firebase ID token for a staff session cookie,
 * gated on Cloudflare Turnstile.
 *
 * Deliberately the same shape as `app/api/admin/login/route.ts`, including the
 * part that looks wrong at first glance: **the password is verified in the
 * browser, not here.** This project's Firebase Web API keys carry an HTTP
 * referrer restriction, so an Identity Toolkit call from a Vercel function gets
 * `403 Requests from referer <empty> are blocked`. That is documented at length
 * in the admin route and in docs/admin-security-hardening.md; this route is
 * subject to exactly the same constraint, and the same residual risk applies.
 *
 * What this route does provide: Turnstile is enforced before any token work, a
 * replayed token cannot mint a session, warehouse access is resolved from the
 * database rather than trusted, and the resulting cookie is httpOnly.
 *
 * ## No custom claim is set
 *
 * The admin login sets `admin: true` because admin pages write to Firestore
 * through the client SDK and `firestore.rules` gates on that claim. The
 * warehouse screen writes nothing from the browser -- every change goes through
 * this API with the session cookie -- so the staff account is given no claim at
 * all and gains no direct Firestore or Storage access.
 */

export const dynamic = 'force-dynamic'

/** Same five-minute ceiling as the admin login, for the same replay reason. */
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
          code: STAFF_LOGIN_ERROR_CODES.INVALID_REQUEST,
          issues: parsed.error.issues,
        },
        { status: 400 }
      )
    }
    const { idToken, turnstileToken } = parsed.data

    // 1 - Turnstile first, before any token work.
    if (!isTurnstileBypassEnabled()) {
      const result = await verifyTurnstileToken({
        token: turnstileToken,
        remoteIp: ip,
        expectedAction: 'staff-login',
        expectedHostnames: parseAllowedHostnames(process.env.TURNSTILE_ALLOWED_HOSTNAMES),
        mode: 'reject',
        idempotencyKey: randomUUID(),
        logTag: 'STAFF_LOGIN',
      })
      if (!result.ok) {
        await recordLoginAttempt({
          emailHash: '',
          ip,
          userAgent,
          outcome: 'failure',
          reason: `STAFF:${STAFF_LOGIN_ERROR_CODES.TURNSTILE_FAILED}:${result.reason}`,
        })
        return fail(
          STAFF_LOGIN_ERROR_CODES.TURNSTILE_FAILED,
          403,
          'Security verification failed. Please try again.'
        )
      }
    } else {
      console.warn('[STAFF_LOGIN] TURNSTILE BYPASS ACTIVE - local development only')
    }

    // 2 - the ID token must be real and not revoked.
    let decoded
    try {
      decoded = await adminAuth.verifyIdToken(idToken, true)
    } catch (error) {
      console.warn('[STAFF_LOGIN] ID token rejected:', (error as any)?.errorInfo?.code ?? error)
      return fail(
        STAFF_LOGIN_ERROR_CODES.INVALID_CREDENTIALS,
        401,
        'Your sign-in could not be verified. Please try again.'
      )
    }

    const email = normalizeEmail(decoded.email ?? null)
    emailHash = email ? hashEmail(email) : ''

    // Shares the admin login's throttle store. The key is a hash of the email,
    // and the warehouse account is a different email from any admin, so the
    // counters do not collide. The `STAFF:` prefix on the reason keeps the two
    // apart in the audit collection.
    const audit = (outcome: 'success' | 'failure', reason: string) =>
      recordLoginAttempt({ emailHash, ip, userAgent, outcome, reason: `STAFF:${reason}` })

    // 3 - throttle the cookie-minting step itself.
    if (emailHash) {
      const throttle = await checkLoginThrottle(emailHash)
      if (throttle.lockedOut) {
        await audit('failure', STAFF_LOGIN_ERROR_CODES.TOO_MANY_ATTEMPTS)
        return NextResponse.json(
          {
            error: 'Too many failed attempts. Please try again later.',
            code: STAFF_LOGIN_ERROR_CODES.TOO_MANY_ATTEMPTS,
            retryAfterSeconds: throttle.retryAfterSeconds,
          },
          { status: 429, headers: { 'Retry-After': String(throttle.retryAfterSeconds) } }
        )
      }
    }

    // 4 - the sign-in must be recent.
    const authAgeMs = Date.now() - (decoded.auth_time ?? 0) * 1000
    if (!decoded.auth_time || authAgeMs > MAX_AUTH_AGE_MS) {
      await recordLoginOutcome(emailHash, 'failure')
      await audit('failure', 'STALE_SIGN_IN')
      return fail(
        STAFF_LOGIN_ERROR_CODES.INVALID_CREDENTIALS,
        401,
        'Your sign-in has expired. Please sign in again.'
      )
    }

    // 5 - warehouse authorization, resolved from the database.
    const role = await resolveStaffAccess(email, decoded.uid)
    if (!role) {
      await recordLoginOutcome(emailHash, 'failure')
      await audit('failure', STAFF_LOGIN_ERROR_CODES.NO_STAFF_ACCESS)
      return fail(
        STAFF_LOGIN_ERROR_CODES.NO_STAFF_ACCESS,
        403,
        'This account does not have warehouse access.'
      )
    }

    const user = await adminAuth.getUser(decoded.uid)
    if (user.disabled) {
      await audit('failure', STAFF_LOGIN_ERROR_CODES.ACCOUNT_DISABLED)
      return fail(
        STAFF_LOGIN_ERROR_CODES.ACCOUNT_DISABLED,
        403,
        'This account has been disabled.'
      )
    }

    const sessionCookie = await mintStaffSessionCookie(idToken)

    await recordLoginOutcome(emailHash, 'success')
    await audit('success', 'OK')

    const response = NextResponse.json({ ok: true, role })
    response.cookies.set(STAFF_SESSION_COOKIE, sessionCookie, staffSessionCookieOptions())
    return response
  } catch (error) {
    Sentry.captureException(error)
    console.error('[STAFF_LOGIN] unexpected failure:', error)
    if (emailHash) {
      await recordLoginAttempt({
        emailHash,
        ip,
        userAgent,
        outcome: 'failure',
        reason: `STAFF:${STAFF_LOGIN_ERROR_CODES.LOGIN_FAILED}`,
      })
    }
    return fail(STAFF_LOGIN_ERROR_CODES.LOGIN_FAILED, 500)
  }
}
