/**
 * The serialised shape of a stored warehouse location.
 *
 * In its own pure module because both sides need it: the service in
 * `lib/server/warehouse-locations.ts` (which is `server-only`) produces it, and
 * the client island that renders and edits it consumes it. A client component
 * cannot import from a `server-only` module, so the type cannot live there.
 */
import type { WarehousePlacement } from './warehouse-config'

export type StoredLocation = {
  modelCode: string
  colorCode: string
  room: number
  route: number
  /** Null when, and only when, `placement` is `FLOOR`. */
  drawer: number | null
  /** `DRAWER` for a numbered drawer, `FLOOR` for stock kept on the floor. */
  placement: WarehousePlacement
  /**
   * Optimistic-concurrency token. The client holds whatever it was shown and
   * sends it back on save; the server refuses a mismatch rather than
   * overwriting a newer assignment.
   */
  version: number
  updatedAt: string
  /**
   * The authenticated account, which on the shared warehouse device is the
   * shared account and NOT the individual who made the change. Displayed as-is,
   * never dressed up as an operator identity.
   */
  updatedBy: string | null
}
