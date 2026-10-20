import 'server-only'

import { comparePin, hashIsPublicTestPin } from '@/lib/staff/pin-hash'

/**
 * Server half of the manager PIN check. The comparison itself is pure and unit
 * tested in `lib/staff/pin-hash.ts`; this module reads the secret and refuses
 * to operate on an unsafe configuration. Same pure/IO split as
 * `lib/turnstile.ts` vs `lib/server/turnstile.ts`.
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
 *
 * ## The published-PIN guard
 *
 * This repository is public, and it contains a test PIN (`lib/staff/pin-hash.ts`,
 * `PUBLIC_TEST_PINS`). `hashPin` refuses to hash one, but that only protects
 * configurations made with our script -- someone can paste any hash into the
 * environment variable. So the configured hash is checked HERE too, against the
 * PIN values rather than the committed hash string, which makes the check
 * salt-independent: any hash of a published PIN is caught, however it was made.
 *
 * A deployment configured with a published PIN refuses every location edit and
 * says why, rather than appearing to be protected.
 */

export type ManagerPinStatus =
  /** A usable PIN is configured. */
  | 'ok'
  /** `STAFF_MANAGER_PIN_HASH` is unset or blank. */
  | 'missing'
  /** The configured hash is a hash of a PIN published in this repository. */
  | 'public_test_pin'

/**
 * Memoised per hash value.
 *
 * The guard costs one bcrypt comparison per blocked PIN -- roughly a quarter of
 * a second at cost 12 -- which is far too much to pay on every unlock request.
 * Keying the cache on the hash means a rotation is re-checked on its first use
 * rather than surviving on a stale verdict.
 */
let cachedForHash: string | null = null
let cachedStatus: Promise<ManagerPinStatus> | null = null

async function resolveStatus(hash: string): Promise<ManagerPinStatus> {
  if (await hashIsPublicTestPin(hash)) {
    console.error(
      '[STAFF_PIN] STAFF_MANAGER_PIN_HASH is a hash of a PIN published in this ' +
        'repository. Location editing is disabled until it is replaced. ' +
        'Run `npm run staff:pin` to generate a new one.'
    )
    return 'public_test_pin'
  }
  return 'ok'
}

/**
 * The configuration's status.
 *
 * Async because the published-PIN check is a bcrypt comparison. Callers use it
 * to tell staff "no PIN is configured" or "the configured PIN is not safe"
 * instead of letting them burn attempts against something that can never work.
 */
export async function getManagerPinStatus(): Promise<ManagerPinStatus> {
  const hash = process.env.STAFF_MANAGER_PIN_HASH

  if (!hash?.trim()) {
    console.error(
      '[STAFF_PIN] STAFF_MANAGER_PIN_HASH is not set; refusing every location edit'
    )
    cachedForHash = null
    cachedStatus = null
    return 'missing'
  }

  if (cachedForHash !== hash || !cachedStatus) {
    cachedForHash = hash
    cachedStatus = resolveStatus(hash)
  }

  return cachedStatus
}

/** True when a usable PIN is configured. */
export async function isManagerPinConfigured(): Promise<boolean> {
  return (await getManagerPinStatus()) === 'ok'
}

/**
 * Verifies an entered PIN.
 *
 * Returns false -- never throws -- for a missing hash, a malformed hash, a
 * published test PIN, or a PIN of the wrong shape, so a misconfigured
 * deployment denies edits rather than crashing or, far worse, allowing them.
 *
 * The status check runs before the comparison, so a published PIN is refused
 * even when the entered value matches it.
 */
export async function verifyManagerPin(pin: string | null | undefined): Promise<boolean> {
  const status = await getManagerPinStatus()
  if (status !== 'ok') return false

  return comparePin(pin, process.env.STAFF_MANAGER_PIN_HASH)
}

/** Test seam: drops the memoised verdict so a changed env var is re-read. */
export function resetManagerPinStatusCache(): void {
  cachedForHash = null
  cachedStatus = null
}
