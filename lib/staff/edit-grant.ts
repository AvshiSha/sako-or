/**
 * Validity rules for a manager edit grant.
 *
 * A grant is what a correct manager PIN buys: a narrowly scoped, short-lived
 * permission to change ONE model/colour location, bound to the session that
 * asked for it. The brief requires exactly that shape -- "bind the resulting
 * permission to the authenticated session and the intended model/color edit,
 * with a short expiry and one successful save" -- so a grant covers one colour
 * and is consumed by one save. Editing five colours means entering the PIN five
 * times; that is the specified behaviour, not an oversight.
 *
 * The authoritative check is a conditional `updateMany` inside the save
 * transaction, which is what makes consumption atomic. This module is the same
 * rule expressed as a predicate, so the failure modes can be unit tested and so
 * the unlock endpoint can answer without a round trip.
 */

/** Three minutes: long enough to pick three dropdowns, short enough to matter. */
export const EDIT_GRANT_TTL_MS = 3 * 60 * 1000

export type EditGrantRecord = {
  id: string
  firebaseUid: string
  modelCode: string
  colorCode: string
  expiresAt: Date
  consumedAt: Date | null
  revokedAt: Date | null
}

export type EditGrantTarget = {
  firebaseUid: string
  modelCode: string
  colorCode: string
}

export type GrantRejection =
  | 'NOT_FOUND'
  | 'WRONG_SESSION'
  | 'WRONG_TARGET'
  | 'EXPIRED'
  | 'CONSUMED'
  | 'REVOKED'

export type GrantCheck = { ok: true } | { ok: false; reason: GrantRejection }

/**
 * Checks a grant against the session and the edit it is being used for.
 *
 * Order matters for what gets reported, not for security -- every rejection
 * produces the same 403. `WRONG_SESSION` is checked before expiry so that a
 * grant belonging to someone else never reports "expired", which would imply it
 * was ever valid for this caller.
 */
export function checkEditGrant(
  grant: EditGrantRecord | null | undefined,
  target: EditGrantTarget,
  now: Date = new Date()
): GrantCheck {
  if (!grant) return { ok: false, reason: 'NOT_FOUND' }

  if (grant.firebaseUid !== target.firebaseUid) {
    return { ok: false, reason: 'WRONG_SESSION' }
  }

  if (grant.modelCode !== target.modelCode || grant.colorCode !== target.colorCode) {
    return { ok: false, reason: 'WRONG_TARGET' }
  }

  if (grant.revokedAt) return { ok: false, reason: 'REVOKED' }
  if (grant.consumedAt) return { ok: false, reason: 'CONSUMED' }
  if (grant.expiresAt.getTime() <= now.getTime()) return { ok: false, reason: 'EXPIRED' }

  return { ok: true }
}

/** Expiry for a grant minted now. */
export function editGrantExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + EDIT_GRANT_TTL_MS)
}

/**
 * Whether a rejection should tell the user to re-enter the PIN rather than
 * simply report a refusal. Expiry and consumption are ordinary, recoverable
 * states on a shared device; the others mean something is wrong.
 */
export function shouldPromptForPinAgain(reason: GrantRejection): boolean {
  return reason === 'EXPIRED' || reason === 'CONSUMED' || reason === 'NOT_FOUND'
}
