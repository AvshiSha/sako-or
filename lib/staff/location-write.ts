/**
 * The concurrency decision for a location save, extracted so it is testable.
 *
 * Prisma's `upsert` selects by unique key only and cannot express "update only
 * if `version = N`", so an upsert here would quietly become last-write-wins and
 * the brief explicitly forbids silently overwriting a newer location. The write
 * therefore branches, and this function is the branch.
 *
 * `version` rather than comparing `updated_at`: `@updatedAt` is written by the
 * Prisma client at millisecond granularity, and the client would be comparing
 * against a value it had just overwritten itself.
 */

export type ExistingLocationVersion = { version: number } | null

export type WriteDecision =
  /** No row yet, and the caller did not claim one existed. */
  | { kind: 'create' }
  /** A row exists and the caller holds the current version. */
  | { kind: 'update'; version: number }
  /** Someone else got there first, or the caller is working from stale data. */
  | { kind: 'conflict'; reason: ConflictReason }

export type ConflictReason =
  /** Caller expected a specific version but no row exists. */
  | 'EXPECTED_EXISTING_BUT_ABSENT'
  /** Caller expected no row, but one exists. */
  | 'EXPECTED_ABSENT_BUT_EXISTS'
  /** Caller holds an older version. */
  | 'VERSION_MISMATCH'

/**
 * @param expectedVersion the version the client was shown, or null when the
 *   client was shown "no location assigned"
 * @param current the row as it is right now, or null when there is none
 */
export function decideWrite(
  expectedVersion: number | null,
  current: ExistingLocationVersion
): WriteDecision {
  if (!current) {
    // Creating. A client that thought it was editing an existing row is working
    // from data that has since been deleted -- rare, but not something to paper
    // over by creating a fresh row under its nose.
    if (expectedVersion !== null) {
      return { kind: 'conflict', reason: 'EXPECTED_EXISTING_BUT_ABSENT' }
    }
    return { kind: 'create' }
  }

  // A row exists. A client that thought there was none would be overwriting an
  // assignment it never saw.
  if (expectedVersion === null) {
    return { kind: 'conflict', reason: 'EXPECTED_ABSENT_BUT_EXISTS' }
  }

  if (expectedVersion !== current.version) {
    return { kind: 'conflict', reason: 'VERSION_MISMATCH' }
  }

  return { kind: 'update', version: current.version }
}

/**
 * True when the new values are identical to what is already stored.
 *
 * A no-op save still consumes the manager grant -- the manager did authorize an
 * edit -- but it must not write a history entry claiming a change that did not
 * happen.
 */
export function isNoOpWrite(
  current: {
    room: number
    route: number
    drawer: number | null
    placement: string
  } | null,
  next: { room: number; route: number; drawer: number | null; placement: string }
): boolean {
  if (!current) return false
  return (
    current.room === next.room &&
    current.route === next.route &&
    current.drawer === next.drawer &&
    // Placement is part of the identity of a location: moving stock from
    // drawer 7 to the floor of the same route is a real change.
    current.placement === next.placement
  )
}
