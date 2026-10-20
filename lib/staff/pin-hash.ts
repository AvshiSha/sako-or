/**
 * Manager PIN shape rules and comparison.
 *
 * `bcryptjs` is pure JavaScript and imports nothing server-only, so the
 * comparison itself is unit testable against a committed hash of a throwaway
 * PIN. Reading `STAFF_MANAGER_PIN_HASH` is the server half, in
 * `lib/server/staff-pin.ts`, which is the same pure/IO split this repository
 * uses for `lib/turnstile.ts` vs `lib/server/turnstile.ts`.
 *
 * On strength, plainly: a six-digit PIN is about a million possibilities, so
 * the bcrypt hash protects it at rest but would not survive an offline attack
 * on the hash for long. The controls that matter are that the hash never ships
 * in the client bundle, that verification happens server-side, and that
 * `lib/staff/pin-throttle.ts` caps online guessing at five attempts per ten
 * minutes. Treat the hash as a secret, not as a hard barrier.
 */

import bcrypt from 'bcryptjs'

/** Short enough to type on a tablet, long enough not to be guessable at a glance. */
export const MIN_PIN_LENGTH = 6
export const MAX_PIN_LENGTH = 12

/** Cost factor for generated hashes. */
export const PIN_BCRYPT_ROUNDS = 12

/**
 * PINs that appear in this repository and are therefore public knowledge.
 *
 * `246813` is the fixture in `lib/__tests__/staff-pin-hash.test.ts`. The
 * repository is public, so anyone can read it, and a comment saying "do not use
 * this in production" is not a control -- it is a hope. These are enforced in
 * three places instead:
 *
 *  1. `hashPin` refuses to produce a hash for one, so `scripts/hash-staff-pin.ts`
 *     cannot create the bad configuration in the first place.
 *  2. `lib/server/staff-pin.ts` checks the CONFIGURED hash against this list at
 *     runtime and refuses every location edit if it matches -- which catches a
 *     hash pasted in from anywhere, not just one made by our script.
 *  3. A unit test asserts the list is enforced.
 *
 * Point 2 is the one that matters: it is salt-independent, so it catches any
 * hash of a blocked PIN rather than only the literal string committed here.
 *
 * Add to this list any PIN that ever appears in the repo, in a ticket, or in a
 * chat log. Removing one is almost never right.
 */
export const PUBLIC_TEST_PINS: readonly string[] = Object.freeze(['246813'])

/** True when the PIN is published somewhere and must never protect anything. */
export function isPublicTestPin(pin: string | null | undefined): boolean {
  if (pin === null || pin === undefined) return false
  return PUBLIC_TEST_PINS.includes(String(pin))
}

export type PinShapeError = 'EMPTY' | 'NON_DIGIT' | 'TOO_SHORT' | 'TOO_LONG'

/**
 * Validates the shape of a PIN before it is compared or hashed.
 *
 * Applied to the entered PIN as well as to a new one, so the setup script
 * cannot create a PIN the login screen would then refuse.
 */
export function checkPinShape(pin: string | null | undefined): PinShapeError | null {
  if (pin === null || pin === undefined) return 'EMPTY'
  const value = String(pin)
  if (!value.trim()) return 'EMPTY'
  // No trimming beyond the emptiness check: a space is not a digit, and
  // silently stripping one would accept a PIN that was not the PIN.
  if (!/^\d+$/.test(value)) return 'NON_DIGIT'
  if (value.length < MIN_PIN_LENGTH) return 'TOO_SHORT'
  if (value.length > MAX_PIN_LENGTH) return 'TOO_LONG'
  return null
}

/**
 * Compares an entered PIN against a stored bcrypt hash.
 *
 * Async `compare`, not `compareSync`: this runs inside a request handler, and
 * bcrypt at cost 12 blocks for long enough that the synchronous form would
 * stall the event loop for every other request in flight.
 *
 * Returns false -- never throws -- for a missing hash, a malformed hash, or a
 * PIN of the wrong shape, so a misconfigured deployment denies edits rather
 * than crashing or, worse, allowing them.
 */
export async function comparePin(
  pin: string | null | undefined,
  hash: string | null | undefined
): Promise<boolean> {
  if (!hash || !String(hash).trim()) return false
  if (checkPinShape(pin) !== null) return false

  try {
    return await bcrypt.compare(String(pin), String(hash))
  } catch {
    // A malformed stored hash lands here. Denying is the safe answer.
    return false
  }
}

/** Hashes a new PIN. Used by `scripts/hash-staff-pin.ts`, never at request time. */
export async function hashPin(pin: string): Promise<string> {
  const shapeError = checkPinShape(pin)
  if (shapeError) throw new Error(`PIN rejected: ${shapeError}`)

  // Refused at the point of creation, so the setup script cannot mint a
  // configuration that the runtime guard would then have to reject.
  if (isPublicTestPin(pin)) {
    throw new Error(
      'PIN rejected: PUBLIC_TEST_PIN - this value appears in the public ' +
        'repository and cannot be used to protect anything. Choose another.'
    )
  }

  return bcrypt.hash(pin, PIN_BCRYPT_ROUNDS)
}

/**
 * Whether a stored hash is a hash of one of the published test PINs.
 *
 * Salt-independent on purpose: it compares against the PIN values, not against
 * the committed hash string, so it catches a hash produced anywhere by anyone.
 *
 * Costs one bcrypt comparison per blocked PIN, so callers memoise it rather
 * than running it per request.
 */
export async function hashIsPublicTestPin(
  hash: string | null | undefined
): Promise<boolean> {
  if (!hash || !String(hash).trim()) return false

  for (const pin of PUBLIC_TEST_PINS) {
    try {
      if (await bcrypt.compare(pin, String(hash))) return true
    } catch {
      // A malformed hash is not a match; `comparePin` rejects it separately.
    }
  }

  return false
}
