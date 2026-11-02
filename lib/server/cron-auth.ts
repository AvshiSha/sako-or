import 'server-only'

import { timingSafeEqual } from 'node:crypto'

/**
 * CRON_SECRET verification.
 *
 * The four existing cron routes each inline this block with a plain `!==`
 * comparison. Extracted here for the new one, with a constant-time compare to
 * match how every other credential in the project is checked
 * (lib/chatbase/auth.ts, lib/webhooks/auth.ts). The existing routes are left
 * alone deliberately -- changing four working jobs is not part of this feature.
 *
 * Fails closed on an unset secret, like verifyChatbaseRequest: no secret means
 * the job is not configured, not that anybody may run it.
 */
export type CronAuthResult =
  | { ok: true }
  | { ok: false; reason: 'not_configured' | 'unauthorized' }

function matches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, 'utf8')
  const b = Buffer.from(expected, 'utf8')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export function verifyCronRequest(request: Request): CronAuthResult {
  const expected = process.env.CRON_SECRET
  if (!expected) return { ok: false, reason: 'not_configured' }

  // The three headers the existing cron routes accept, so a manual trigger that
  // works against them works against this one too.
  const provided =
    request.headers.get('x-vercel-cron-secret') ||
    request.headers.get('x-cron-secret') ||
    request.headers.get('authorization')?.replace(/^Bearer /i, '') ||
    ''

  if (!provided || !matches(provided, expected)) {
    return { ok: false, reason: 'unauthorized' }
  }
  return { ok: true }
}
