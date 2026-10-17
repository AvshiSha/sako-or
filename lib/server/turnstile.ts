// Deliberately NO `import 'server-only'`, unlike its neighbours in lib/server/.
//
// pages/api/contact.js is the repo's last Pages Router route and is not
// compiled in the react-server layer, so a server-only import there throws at
// runtime: "This module cannot be imported from a Client Component module."
// That is a 500 on the contact form, which is how this was found.
//
// Nothing leaks as a result. TURNSTILE_SECRET_KEY is not NEXT_PUBLIC_, so it
// is never inlined into a browser bundle; if this module were ever imported
// client-side the secret would be undefined and verifyTurnstileToken would
// fail closed with MISSING_SECRET rather than verifying anything.
import * as Sentry from '@sentry/nextjs'
import {
  evaluateTurnstileResponse,
  type TurnstileExpectations,
  type TurnstileResult,
  type TurnstileSiteverifyResponse,
} from '@/lib/turnstile'

/**
 * Cloudflare Turnstile — I/O half. The verdict logic lives in `lib/turnstile.ts`
 * so it can be unit tested; this file only talks to Cloudflare.
 */

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

/** A hung siteverify must not hang a login. */
const SITEVERIFY_TIMEOUT_MS = 5000

export type VerifyTurnstileArgs = {
  token: string | null | undefined
  remoteIp?: string | null
  /**
   * Lets the SAME token be re-verified safely after a network error. Without
   * it a retry hits Cloudflare's single-use rule and comes back
   * `timeout-or-duplicate`, which is indistinguishable from a replay attempt.
   */
  idempotencyKey?: string
  expectedHostnames?: readonly string[]
  expectedAction?: string
  mode?: TurnstileExpectations['mode']
  /** Defaults to TURNSTILE_SECRET_KEY. */
  secret?: string
  /** Tag used in log lines, e.g. 'ADMIN_LOGIN'. */
  logTag?: string
}

export async function verifyTurnstileToken(args: VerifyTurnstileArgs): Promise<TurnstileResult> {
  const tag = args.logTag ?? 'TURNSTILE_VERIFY'
  const token = (args.token ?? '').trim()

  if (!token) {
    return { ok: false, reason: 'MISSING_TOKEN', errorCodes: ['missing-input-response'] }
  }

  const secret = args.secret ?? process.env.TURNSTILE_SECRET_KEY
  if (!secret) {
    // Fail closed. The previous implementations sent `secret: ''` and let
    // Cloudflare reject it, which produced a misleading "bad token" rather than
    // a visible misconfiguration.
    console.error(`[${tag}] TURNSTILE_SECRET_KEY is not configured`)
    return { ok: false, reason: 'MISSING_SECRET', errorCodes: ['missing-input-secret'] }
  }

  const params = new URLSearchParams()
  params.append('secret', secret)
  params.append('response', token)
  if (args.remoteIp) params.append('remoteip', args.remoteIp)
  if (args.idempotencyKey) params.append('idempotency_key', args.idempotencyKey)

  let body: TurnstileSiteverifyResponse | null = null
  try {
    const resp = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      signal: AbortSignal.timeout(SITEVERIFY_TIMEOUT_MS),
    })
    body = (await resp.json()) as TurnstileSiteverifyResponse
  } catch (error) {
    Sentry.captureException(error)
    console.error(`[${tag}] siteverify unreachable`, error)
    return { ok: false, reason: 'SITEVERIFY_UNREACHABLE', errorCodes: ['http-error'] }
  }

  return evaluateTurnstileResponse(body, {
    expectedHostnames: args.expectedHostnames,
    expectedAction: args.expectedAction,
    mode: args.mode,
    onMismatch: (detail) => {
      // shadow mode only: records what production actually sends so the checks
      // can be flipped to 'reject' with real values rather than guesses.
      console.warn(
        `[${tag}] turnstile shadow mismatch`,
        JSON.stringify({ reason: detail.reason, expected: detail.expected, observed: detail.observed })
      )
    },
  })
}
