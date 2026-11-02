/**
 * Which fields a write actually changed.
 *
 * Kept out of lib/mcp/audit.ts, which imports the Firebase Admin SDK and is
 * therefore `server-only` -- and a `server-only` module throws when imported by
 * the project's node:test runner. This is pure, so it lives here where it can
 * be tested.
 */
export function changedFieldNames(
  before: Record<string, unknown> | null,
  after: Record<string, unknown>
): string[] {
  if (!before) return Object.keys(after).sort()
  return Object.keys(after)
    .filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
    .sort()
}
