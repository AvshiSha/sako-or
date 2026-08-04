import 'server-only'

/**
 * HFD wire format.
 *
 * Field names below are verified against HFD's published OpenAPI schema
 * (https://api.hfd.co.il/openapi.json, `ShipmentDetails`) — note it carries more
 * fields than the example in HFD's PDF: `random_id` on the envelope and
 * `status_customer_code` / `status_foreign_code` / `status_location` / `status_city`
 * on each status entry.
 *
 * IMPORTANT: this is the shape of the **PULL** (tracking) response. HFD's PUSH
 * payload is undocumented and is only assumed to match. Everything is therefore
 * optional, and the parser tolerates missing or differently-shaped fields rather
 * than rejecting the delivery. The full raw body is persisted on every request so
 * the first real PUSH tells us definitively what HFD sends.
 */

/** One status transition in HFD's `status` array. */
export interface HfdStatusEntry {
  status_code?: string | number | null
  status_desc?: string | null
  /** DD/MM/YYYY, Israel local time. */
  status_date?: string | null
  /** HH:mm:ss, Israel local time. */
  status_time?: string | null
  status_customer_code?: string | number | null
  status_foreign_code?: string | number | null
  status_location?: string | null
  status_city?: string | null
}

/** HFD's shipment envelope. */
export interface HfdShipmentPayload {
  ship_no?: string | number | null
  /** Customer reference 1. */
  ref1?: string | null
  /** Customer reference 2 — where we expect our own order number. */
  ref2?: string | null
  /** "y" / "n" flags. */
  ship_delivered_yn?: string | null
  ship_canceled_yn?: string | null
  random_id?: string | number | null
  /** Documented as an array; the parser also accepts a single object. */
  status?: HfdStatusEntry[] | HfdStatusEntry | null
}

/**
 * HFD status codes seen in their documentation. Used only for readability in logs —
 * delivery detection keys off `ship_delivered_yn`, never off a code, because the
 * code set is not contractually stable.
 */
export const HFD_STATUS_DELIVERY_COMPLETED = '27'
