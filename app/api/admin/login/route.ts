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
 * Server-side admin login.
 *
 * The point of this route is that Turnstile becomes enforceable. Previously
 * the admin login called `signInWithEmailAndPassword` straight from the
 * browser to Google, so our server never saw a login attempt and a widget on
 * the form was decoration — an attacker simply posted to Identity Toolkit.
 *
 * It returns TWO credentials, and both are needed:
 *   - an httpOnly session cookie, which the server trusts for page and API
 *     authorization (see lib/server/admin-session.ts and the admin layout);
 *   - a custom token, which the browser exchanges via signInWithCustomToken
 *     for an ordinary Firebase session, because admin pages write to Firestore
 *     through the CLIENT SDK and firestore.rules gates those writes on the
 *     `admin` claim. A server-only session would break every admin write.
 *
 * Read the step order below as the security design, not as housekeeping.
 *
 * KNOWN LIMIT: this does not stop an attacker posting directly to
 * identitytoolkit.googleapis.com with the public API key. See
 * docs/admin-security-hardening.md, "Residual risk".
 */

export const dynamic = 'force-dynamic'

const IDENTITY_TOOLKIT_URL =
  'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword'
const SIGN_IN_TIMEOUT_MS = 10_000

const bodySchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
  turnstileToken: z.string().optional(),
})

function fail(code: string, status: number, message?: string) {
  return NextResponse.json({ error: message ?? 'Login failed', code }, { status })
}

type RestSignInResult =
  | { ok: true; idToken: string; localId: string }
  | { ok: false; code: string; status: number }

async function restSignIn(email: string, password: string): Promise<RestSignInResult> {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
  if (!apiKey) {
    console.error('[ADMIN_LOGIN] NEXT_PUBLIC_FIREBASE_API_KEY is not configured')
    return { ok: false, code: ADMIN_LOGIN_ERROR_CODES.LOGIN_FAILED, status: 500 }
  }

  let payload: any
  try {
    const resp = await fetch(`${IDENTITY_TOOLKIT_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
      signal: AbortSignal.timeout(SIGN_IN_TIMEOUT_MS),
    })
    payload = await resp.json()
  } catch (error) {
    Sentry.captureException(error)
    console.error('[ADMIN_LOGIN] identity toolkit unreachable', error)
    return { ok: false, code: ADMIN_LOGIN_ERROR_CODES.LOGIN_FAILED, status: 500 }
  }

  if (payload?.idToken && payload?.localId) {
    return { ok: true, idToken: payload.idToken, localId: payload.localId }
  }

  const upstream: string = payload?.error?.message ?? 'UNKNOWN'

  // TOO_MANY_ATTEMPTS_TRY_LATER gets its own code on purpose. Every attempt
  // now leaves Vercel's shared egress IPs, so Google's per-IP throttle can be
  // tripped by other tenants — surfacing that as "wrong password" would send
  // the admin hunting for a credential problem that does not exist.
  if (upstream.startsWith('TOO_MANY_ATTEMPTS_TRY_LATER')) {
    return { ok: false, code: ADMIN_LOGIN_ERROR_CODES.UPSTREAM_THROTTLED, status: 429 }
  }
  if (upstream === 'USER_DISABLED') {
    return { ok: false, code: ADMIN_LOGIN_ERROR_CODES.ACCOUNT_DISABLED, status: 403 }
  }
  // EMAIL_NOT_FOUND / INVALID_PASSWORD / INVALID_LOGIN_CREDENTIALS all collapse
  // into one generic answer so the route is not an account-existence oracle.
  return { ok: false, code: ADMIN_LOGIN_ERROR_CODES.INVALID_CREDENTIALS, status: 401 }
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers)
  const userAgent = request.headers.get('user-agent')
  let emailHash = ''

  try {
    // 1 — shape
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
    const { password, turnstileToken } = parsed.data
    const email = normalizeEmail(parsed.data.email) ?? parsed.data.email
    emailHash = hashEmail(email)

    const audit = (outcome: 'success' | 'failure', reason: string) =>
      recordLoginAttempt({ emailHash, ip, userAgent, outcome, reason })

    // 2 — throttle, before anything expensive or anything that talks to Google
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

    // 3 — Turnstile, before the password is looked at
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
        await recordLoginOutcome(emailHash, 'failure')
        await audit('failure', `${ADMIN_LOGIN_ERROR_CODES.TURNSTILE_FAILED}:${result.reason}`)
        return fail(
          ADMIN_LOGIN_ERROR_CODES.TURNSTILE_FAILED,
          403,
          'Security verification failed. Please try again.'
        )
      }
    } else {
      console.warn('[ADMIN_LOGIN] TURNSTILE BYPASS ACTIVE — local development only')
    }

    // 4 — admin-ness BEFORE any password check.
    // Without this the Turnstile-protected admin login doubles as a password
    // oracle for every customer account in the project.
    const isAdminEmailAddress = await resolveIsAdmin(email, null)
    if (!isAdminEmailAddress) {
      await recordLoginOutcome(emailHash, 'failure')
      await audit('failure', ADMIN_LOGIN_ERROR_CODES.INVALID_CREDENTIALS)
      return fail(ADMIN_LOGIN_ERROR_CODES.INVALID_CREDENTIALS, 401, 'Invalid email or password.')
    }

    // 5 — user record, and make sure the claim is on it before the token is minted
    let user
    try {
      user = await adminAuth.getUserByEmail(email)
    } catch {
      await recordLoginOutcome(emailHash, 'failure')
      await audit('failure', ADMIN_LOGIN_ERROR_CODES.INVALID_CREDENTIALS)
      return fail(ADMIN_LOGIN_ERROR_CODES.INVALID_CREDENTIALS, 401, 'Invalid email or password.')
    }

    if (user.disabled) {
      await audit('failure', ADMIN_LOGIN_ERROR_CODES.ACCOUNT_DISABLED)
      return fail(ADMIN_LOGIN_ERROR_CODES.ACCOUNT_DISABLED, 403, 'This account has been disabled.')
    }

    if (user.customClaims?.admin !== true) {
      // Spread the existing claims: this must not clobber anything else set on
      // the user record.
      await adminAuth.setCustomUserClaims(user.uid, { ...(user.customClaims ?? {}), admin: true })
    }

    // 6 — the actual password check
    const signIn = await restSignIn(email, password)
    if (!signIn.ok) {
      // An upstream throttle is not a credential failure; do not punish the
      // account's own counter for it.
      if (signIn.code !== ADMIN_LOGIN_ERROR_CODES.UPSTREAM_THROTTLED) {
        await recordLoginOutcome(emailHash, 'failure')
      }
      await audit('failure', signIn.code)
      const message =
        signIn.code === ADMIN_LOGIN_ERROR_CODES.UPSTREAM_THROTTLED
          ? 'Sign-in is temporarily rate limited upstream. Please try again shortly.'
          : signIn.code === ADMIN_LOGIN_ERROR_CODES.ACCOUNT_DISABLED
            ? 'This account has been disabled.'
            : 'Invalid email or password.'
      return fail(signIn.code, signIn.status, message)
    }

    // 7 — re-confirm against the token we just received, not against the input
    const decoded = await adminAuth.verifyIdToken(signIn.idToken)
    if (decoded.uid !== user.uid || !(await resolveIsAdmin(email, decoded.uid))) {
      await recordLoginOutcome(emailHash, 'failure')
      await audit('failure', ADMIN_LOGIN_ERROR_CODES.INVALID_CREDENTIALS)
      return fail(ADMIN_LOGIN_ERROR_CODES.INVALID_CREDENTIALS, 401, 'Invalid email or password.')
    }

    // 8 — both credentials
    const sessionCookie = await mintAdminSessionCookie(signIn.idToken)
    const customToken = await adminAuth.createCustomToken(user.uid, { admin: true })

    await recordLoginOutcome(emailHash, 'success')
    await audit('success', 'OK')

    const response = NextResponse.json({ ok: true, customToken })
    response.cookies.set(ADMIN_SESSION_COOKIE, sessionCookie, adminSessionCookieOptions())
    return response
  } catch (error) {
    Sentry.captureException(error)
    console.error('[ADMIN_LOGIN]', error)
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
