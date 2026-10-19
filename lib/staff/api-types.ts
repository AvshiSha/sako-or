/**
 * The wire shape of the staff API, shared by the route handlers and the client
 * island so the two cannot drift.
 *
 * Pure types only -- no `server-only`, no runtime imports beyond the view model
 * -- because the client components import them too.
 */

import type { StaffColorCard } from './combine-stock'
import type { RoomRoutes } from './warehouse-config'
import type { StoredLocation } from './location-types'

/**
 * How the stock half of the lookup turned out.
 *
 * Three values, not two, and the distinction is the point:
 *  - `ok`        Verifone answered and returned rows.
 *  - `empty`     Verifone answered successfully with no rows. NOT "not found":
 *                the response cannot tell a missing model from a model with no
 *                stock rows, so the screen does not claim either.
 *  - `unavailable` Verifone failed, timed out, or reported an error. Must never
 *                render as a quantity of zero.
 */
export type StockState = 'ok' | 'empty' | 'unavailable'

/** Whether our own location read succeeded. Never conflated with "unassigned". */
export type LocationsState = 'ok' | 'error'

export type StaffStockResponse = {
  modelCode: string
  productName: string | null
  /** When the upstream call actually happened, for the "last updated" line. */
  fetchedAt: string
  stock: { state: StockState; detail: string | null }
  locations: { state: LocationsState }
  colors: StaffColorCard[]
  /** Null whenever stock is not known, so a failure cannot read as "no stock". */
  totalQuantity: number | null
  warehouse: {
    roomRoutes: RoomRoutes
    configError: string | null
  }
}

export type UnlockResponse = {
  ok: true
  grantId: string
  expiresAt: string
  modelCode: string
  colorCode: string
}

export type SaveLocationResponse = {
  ok: true
  location: StoredLocation
  /** False when the save was a no-op, so the UI can stay quiet about it. */
  changed: boolean
}

/** Error body shape shared by every staff endpoint. */
export type StaffApiError = {
  error: string
  code?: string
  reason?: string
  retryAfterSeconds?: number
  current?: StoredLocation | null
  issues?: unknown
}
