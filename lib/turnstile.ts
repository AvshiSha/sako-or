/**
 * Cloudflare Turnstile — pure half.
 *
 * Deliberately free of `fetch`, React and `server-only`: `npm test` only globs
 * `lib/**\/*.test.ts` and anything importing `'server-only'` throws on import
 * under plain `tsx`, so the decision logic has to live somewhere a unit test
 * can reach it. The I/O half is `lib/server/turnstile.ts`.
 *
 * This replaces two hand-rolled copies of the same verification — one in
 * `app/api/otp/send/route.ts` (fetch) and one in `pages/api/contact.js`
 * (axios). Neither checked the `hostname` or `action` fields of the siteverify
 * response, only `success`. That is the gap this module exists to close: a
 * token minted by ANY widget using the public sitekey — the contact form's,
 * say — was accepted at any endpoint. Pinning `action` stops cross-endpoint
 * replay; pinning `hostname` stops a token solved somewhere else entirely.
 */

/** https://developers.cloudflare.com/turnstile/get-started/server-side-validation/ */
export type TurnstileSiteverifyResponse = {
  success: boolean
  'error-codes'?: string[]
  challenge_ts?: string
  hostname?: string
  action?: string
  cdata?: string
}

export type TurnstileFailureReason =
  | 'MISSING_TOKEN'
  | 'MISSING_SECRET'
  | 'SITEVERIFY_UNREACHABLE'
  | 'TOKEN_REJECTED'
  | 'HOSTNAME_MISMATCH'
  | 'ACTION_MISMATCH'

export type TurnstileResult =
  | { ok: true; hostname: string | null; action: string | null; challengeTs: string | null }
  | {
      ok: false
      reason: TurnstileFailureReason
      errorCodes: string[]
      observed?: { hostname?: string | null; action?: string | null }
    }

export type TurnstileExpectations = {
  /** Undefined means "do not check". An empty array also means "do not check". */
  expectedHostnames?: readonly string[]
  /** Undefined means "do not check". */
  expectedAction?: string
  /**
   * `shadow` reports a hostname/action mismatch through `onMismatch` but still
   * returns ok. Used to roll the new checks out across the storefront endpoints
   * without risking a regression before the real values have been observed in
   * production logs. `reject` is the real thing.
   */
  mode?: 'reject' | 'shadow'
  /** Called once per mismatch in `shadow` mode. Keeps logging out of this module. */
  onMismatch?: (detail: { reason: TurnstileFailureReason; expected: string; observed: string | null }) => void
}

function normalizeHostname(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim().toLowerCase()
  return trimmed === '' ? null : trimmed
}

/**
 * Turns a siteverify body plus a set of expectations into a verdict.
 *
 * `body === null` means the call never produced a parsable response; the caller
 * reports that as SITEVERIFY_UNREACHABLE rather than as a rejected token,
 * because the two want different handling — a rejected token is the visitor's
 * problem, an unreachable Cloudflare is ours.
 */
export function evaluateTurnstileResponse(
  body: TurnstileSiteverifyResponse | null,
  expectations: TurnstileExpectations = {}
): TurnstileResult {
  if (body === null) {
    return { ok: false, reason: 'SITEVERIFY_UNREACHABLE', errorCodes: ['http-error'] }
  }

  const errorCodes = body['error-codes'] ?? []

  if (!body.success) {
    return { ok: false, reason: 'TOKEN_REJECTED', errorCodes }
  }

  const mode = expectations.mode ?? 'reject'
  const observedHostname = normalizeHostname(body.hostname)
  const observedAction = (body.action ?? '').trim() || null

  const allowed = (expectations.expectedHostnames ?? [])
    .map(normalizeHostname)
    .filter((h): h is string => h !== null)

  if (allowed.length > 0 && (observedHostname === null || !allowed.includes(observedHostname))) {
    if (mode === 'reject') {
      return {
        ok: false,
        reason: 'HOSTNAME_MISMATCH',
        errorCodes,
        observed: { hostname: observedHostname },
      }
    }
    expectations.onMismatch?.({
      reason: 'HOSTNAME_MISMATCH',
      expected: allowed.join(','),
      observed: observedHostname,
    })
  }

  if (expectations.expectedAction !== undefined && observedAction !== expectations.expectedAction) {
    if (mode === 'reject') {
      return {
        ok: false,
        reason: 'ACTION_MISMATCH',
        errorCodes,
        observed: { action: observedAction },
      }
    }
    expectations.onMismatch?.({
      reason: 'ACTION_MISMATCH',
      expected: expectations.expectedAction,
      observed: observedAction,
    })
  }

  return {
    ok: true,
    hostname: observedHostname,
    action: observedAction,
    challengeTs: body.challenge_ts ?? null,
  }
}

/**
 * Client IP, preferring `cf-connecting-ip`.
 *
 * Order matters. Cloudflare proxies this site, so `cf-connecting-ip` is written
 * by Cloudflare and the first entry of `x-forwarded-for` is, in principle,
 * attacker-supplied. The pre-existing call sites read `x-forwarded-for` first;
 * switching the preference is an intentional behaviour change.
 */
export function getClientIp(headers: Headers): string | null {
  const cf = headers.get('cf-connecting-ip')?.trim()
  if (cf) return cf

  const real = headers.get('x-real-ip')?.trim()
  if (real) return real

  const forwarded = headers.get('x-forwarded-for')
  const first = forwarded?.split(',')[0]?.trim()
  return first || null
}

/** Comma- or whitespace-separated env list -> normalized lowercase hostnames. */
export function parseAllowedHostnames(raw: string | undefined): string[] {
  if (!raw) return []
  return raw
    .split(/[\s,]+/)
    .map(normalizeHostname)
    .filter((h): h is string => h !== null)
}

/**
 * Whether Turnstile verification may be skipped entirely.
 *
 * Requires BOTH an explicit opt-in flag AND the absence of `VERCEL`. Vercel
 * sets `VERCEL=1` in every environment it runs — production, preview and
 * development — so the bypass cannot be switched on from the Vercel dashboard
 * even by someone who adds the variable there.
 *
 * `NODE_ENV` is deliberately NOT part of this condition. `next build &&
 * next start` locally sets `NODE_ENV=production`, and that local production
 * build is exactly what Playwright runs against; keying off NODE_ENV would
 * either disable the bypass where it is wanted or enable it where it is not.
 * QA does not use this flag at all — it uses Cloudflare's always-pass test
 * keys, so the real verifier runs end to end.
 */
export function isTurnstileBypassEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.VERCEL) return false
  return env.TURNSTILE_DEV_BYPASS === '1'
}
