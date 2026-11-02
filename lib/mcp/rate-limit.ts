/**
 * Best-effort in-process rate limiting for the MCP tools.
 *
 * Same shape and the same caveat as lib/chatbase/rate-limit.ts: counters live
 * in module scope, so they are per serverless instance and reset on a cold
 * start. This is not a security control -- the OAuth token is -- it is a brake
 * on a runaway agent loop, which is a realistic failure for an LLM client that
 * retries a validation error it has misread.
 *
 * Two separate budgets, because the costs differ by orders of magnitude. A
 * search is a Firestore read; an image upload moves megabytes into Storage and
 * can fetch a remote URL. At one or two articles a day the normal load is
 * nowhere near either limit, so a 429 here means something has gone wrong.
 */

const WINDOW_MS = 60_000
const MAX_CALLS_PER_WINDOW = 60
const MAX_UPLOADS_PER_WINDOW = 12

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

function consume(key: string, max: number, now: number): boolean {
  const bucket = buckets.get(key)

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return true
  }
  if (bucket.count >= max) return false

  bucket.count += 1
  return true
}

/**
 * Record one tool call against a subject.
 *
 * Keyed by email rather than by tool name so one client cannot multiply its
 * budget by spreading calls across tools.
 */
export function consumeToolCall(subject: string, now: number = Date.now()): boolean {
  return consume(`tool:${subject}`, MAX_CALLS_PER_WINDOW, now)
}

export function consumeUpload(subject: string, now: number = Date.now()): boolean {
  return consume(`upload:${subject}`, MAX_UPLOADS_PER_WINDOW, now)
}

/** Test-only: drop all counters so cases cannot leak into one another. */
export function resetMcpRateLimits(): void {
  buckets.clear()
}

export const MCP_RATE_LIMIT_WINDOW_MS = WINDOW_MS
export const MCP_RATE_LIMIT_MAX_CALLS = MAX_CALLS_PER_WINDOW
export const MCP_RATE_LIMIT_MAX_UPLOADS = MAX_UPLOADS_PER_WINDOW
