import 'server-only'

import { comparePin } from '@/lib/staff/pin-hash'

/**
 * Server half of the manager PIN check. The comparison itself is pure and unit
 * tested in `lib/staff/pin-hash.ts`; this module exists only to read the
 * secret, which is the same pure/IO split as `lib/turnstile.ts` vs
 * `lib/server/turnstile.ts`.
 *
 * The PIN is stored as a bcrypt hash in `STAFF_MANAGER_PIN_HASH`, using the
 * project's existing secret handling: an environment variable in Vercel,
 * alongside `TURNSTILE_SECRET_KEY` and the rest. Nothing is hardcoded, nothing
 * is logged, and nothing is committed -- `scripts/hash-staff-pin.ts` generates
 * the hash locally and only the hash is pasted into the environment.
 *
 * There is NO default PIN. An unconfigured deployment refuses every edit, which
 * is the correct failure: a fallback PIN in the source would be a published
 * one, and a blank-means-allow would be worse.
 */

/** True when the environment has a PIN configured at all. */
export function isManagerPinConfigured(): boolean {
  return Boolean(process.env.STAFF_MANAGER_PIN_HASH?.trim())
}

/**
 * Verifies an entered PIN.
 *
 * Returns false -- never throws -- for a missing or malformed hash, so a
 * misconfigured environment denies edits rather than erroring in a way a caller
 * might mishandle. Callers distinguish the two cases with
 * `isManagerPinConfigured`, so staff get "no PIN is configured, ask an admin"
 * instead of "wrong PIN" and five fruitless attempts.
 */
export async function verifyManagerPin(pin: string | null | undefined): Promise<boolean> {
  const hash = process.env.STAFF_MANAGER_PIN_HASH
  if (!hash?.trim()) {
    console.error(
      '[STAFF_PIN] STAFF_MANAGER_PIN_HASH is not set; refusing every location edit'
    )
    return false
  }

  return comparePin(pin, hash)
}
