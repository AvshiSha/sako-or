import { timingSafeEqual } from 'node:crypto'

export type ChatbaseAuthResult =
  | { ok: true }
  /** The server has no secret configured. Fail closed, and say so in the log, not to the caller. */
  | { ok: false; reason: 'not_configured' }
  | { ok: false; reason: 'unauthorized' }

function secretMatches(provided: string, expected: string): boolean {
  const providedBytes = Buffer.from(provided, 'utf8')
  const expectedBytes = Buffer.from(expected, 'utf8')
  // timingSafeEqual throws on a length mismatch, so the lengths must be compared
  // first. Length is not secret; the contents are.
  if (providedBytes.length !== expectedBytes.length) return false
  return timingSafeEqual(providedBytes, expectedBytes)
}

/**
 * Shared secret check for every Chatbase route.
 *
 * The secret travels in a header only - never the body or the query string - so
 * it is configured once as a static header in the Chatbase action and is never
 * a model-generated parameter. Neither the expected nor the provided value is
 * ever logged or returned.
 */
export function verifyChatbaseRequest(request: Request): ChatbaseAuthResult {
  const expected = process.env.CHATBASE_API_SECRET
  if (!expected) {
    return { ok: false, reason: 'not_configured' }
  }

  const provided =
    request.headers.get('x-chatbase-secret') ||
    request.headers.get('authorization')?.replace(/^Bearer /i, '') ||
    ''

  if (!provided || !secretMatches(provided, expected)) {
    return { ok: false, reason: 'unauthorized' }
  }

  return { ok: true }
}
