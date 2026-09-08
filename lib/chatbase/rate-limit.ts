/**
 * Best-effort in-process rate limiting for the Chatbase routes.
 *
 * The project has no shared limiter store (no Redis, KV or Upstash), and the
 * shared secret is the real access gate - this only blunts a runaway agent loop
 * or a stuck retry. Counters live in module scope, so they are per serverless
 * instance and reset on a cold start: treat the limit as "roughly N per window
 * per instance", never as a security control.
 *
 * Sized so a normal conversation - a handful of tool calls per customer turn -
 * never sees a 429.
 */

const WINDOW_MS = 60_000
const MAX_REQUESTS_PER_WINDOW = 120

type Bucket = {
  count: number
  /** Epoch ms at which `count` resets. */
  resetAt: number
}

const buckets = new Map<string, Bucket>()

/**
 * Records one request against `key` and reports whether it is allowed.
 * Returns false once the window's budget is spent.
 */
export function consumeRateLimit(key: string, now: number = Date.now()): boolean {
  const bucket = buckets.get(key)

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return true
  }

  if (bucket.count >= MAX_REQUESTS_PER_WINDOW) {
    return false
  }

  bucket.count += 1
  return true
}

/** Test-only: drop all counters so cases cannot leak into one another. */
export function resetRateLimits(): void {
  buckets.clear()
}

export const RATE_LIMIT_WINDOW_MS = WINDOW_MS
export const RATE_LIMIT_MAX_REQUESTS = MAX_REQUESTS_PER_WINDOW
