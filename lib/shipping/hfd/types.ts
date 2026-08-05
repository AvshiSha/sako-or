import 'server-only'

/**
 * HFD wire format.
 *
 * These interfaces describe HFD's **actual PUSH payload**, confirmed by HFD directly.
 * It is considerably richer than both the example in their PDF and the
 * `ShipmentDetails` schema in their OpenAPI spec, and it differs in ways that matter:
 *
 *  - `ship_delivered_back_yn` marks a parcel returned to sender. It coexists with
 *    `ship_delivered_yn: "y"`, so delivery detection must consider both or a returned
 *    parcel reads as a successful delivery.
 *  - Each status carries an explicit `status_timezone` (e.g. "GMT+2").
 *  - The status description key is inconsistent: HFD's own sample uses `status_desc`
 *    on one entry and `desc_status` on the next.
 *  - `ref2_with_prefix` carries a customer-prefixed variant of ref2.
 *  - Extra collections (`documentation`, `electronic_message`) and a nested `source`
 *    object are present and simply passed through.
 *
 * Everything remains optional: fields are still only as reliable as the sample, and
 * the parser must not reject a real delivery notification over an unexpected shape.
 */

/** One status transition in HFD's `status` array. */
export interface HfdStatusEntry {
  status_code?: string | number | null
  /** HFD sends this key on some entries... */
  status_desc?: string | null
  /** ...and this one on others. Both are read. */
  desc_status?: string | null
  /** DD/MM/YYYY. */
  status_date?: string | null
  /** HH:mm:ss. */
  status_time?: string | null
  /** Explicit offset, e.g. "GMT+2". Authoritative when present. */
  status_timezone?: string | null
  /** Combined datetime; empty in HFD's sample but preferred when populated. */
  status_dt?: string | null
  status_customer_code?: string | number | null
  status_foreign_code?: string | number | null
  status_location?: string | null
  status_city?: string | null
  status_country?: string | null
  status_province?: string | null
  status_post_code?: string | null
}

/** Proof-of-delivery / documentation entries. Stored raw; not interpreted. */
export interface HfdDocumentationEntry {
  tiud_code?: string | number | null
  tiud_desc?: string | null
  tiud_freetext?: string | null
  tiud_date?: string | null
  tiud_time?: string | null
}

/** Notifications HFD sent to the consignee. Stored raw; not interpreted. */
export interface HfdElectronicMessageEntry {
  draft_code?: string | number | null
  draft_desc?: string | null
  failed?: string | null
  media_type?: string | null
  message_date?: string | null
  message_time?: string | null
  message_body?: string | null
}

/** HFD's PUSH envelope. */
export interface HfdShipmentPayload {
  ship_no?: string | number | null
  master_customer_id?: string | number | null
  customer_id?: string | number | null
  external_customer_no?: string | null

  /** Customer references — our order number arrives in ref1 or ref2. */
  ref1?: string | null
  ref2?: string | null
  /** ref2 with a customer prefix applied by HFD. */
  ref2_with_prefix?: string | null

  random_id?: string | number | null

  /** "y" / "n" flags. */
  ship_delivered_yn?: string | null
  /** Parcel returned to sender — NOT a successful customer delivery. */
  ship_delivered_back_yn?: string | null
  ship_canceled_yn?: string | null
  /** Error flag ("shgiya" = error). */
  shgiya_yn?: string | null
  unusual_city_yn?: string | null

  message?: string | null
  shipment_direction?: string | null
  consignee_name?: string | null
  consignee_phone?: string | null

  /** Pickup-point (PUDO) destination details. */
  pudo_destination_code?: string | number | null
  pudo_destination_desc?: string | null
  city_destination?: string | null

  shipmnet_type?: string | number | null
  shipment_type_name?: string | null

  status?: HfdStatusEntry[] | HfdStatusEntry | null
  documentation?: HfdDocumentationEntry[] | null
  electronic_message?: HfdElectronicMessageEntry[] | null
}

/**
 * Status codes observed in HFD's documentation and sample payload. Informational
 * only — delivery detection keys off the `ship_*_yn` flags, never off a code, since
 * the code set is not contractually stable.
 */
export const HFD_STATUS_INTERNET = '5'
export const HFD_STATUS_DELIVERY_COMPLETED = '27'
