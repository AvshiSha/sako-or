import 'server-only'

/**
 * Provider-agnostic shipment contract.
 *
 * Every carrier adapter normalizes its own wire format into these shapes, so the
 * ingestion pipeline, the shipment service and the database layer never learn
 * anything carrier-specific. Adding a courier means writing one adapter, not
 * touching the pipeline.
 */

/** A single carrier status transition, already normalized. */
export interface NormalizedShipmentEvent {
  /** Carrier status code, kept as a string — codes are opaque identifiers, not numbers. */
  statusCode: string
  statusDesc: string | null
  /** UTC instant. Callers guarantee this is set before persisting. */
  occurredAt: Date | null
  location: string | null
  city: string | null
  /** The untouched carrier status object, for debugging undocumented formats. */
  raw: unknown
}

/** The full normalized view of one carrier webhook delivery. */
export interface NormalizedShipmentUpdate {
  provider: string
  /**
   * The carrier's shipment id. May be null here; the shipment service substitutes
   * a deterministic `order:<orderNumber>` sentinel so the unique key is never null.
   */
  providerShipmentNo: string | null
  /** Candidate references to match an order on, in priority order. */
  referenceCandidates: string[]
  providerRandomId: string | null
  /** The carrier's raw "delivered" flag — true even for a parcel returned to sender. */
  isDelivered: boolean
  /**
   * Parcel was returned to the sender. Arrives alongside `isDelivered: true`, so it
   * must be checked before treating a shipment as successfully delivered to the
   * customer — otherwise a returned parcel triggers a review request.
   */
  isReturnedToSender: boolean
  isCanceled: boolean
  events: NormalizedShipmentEvent[]
  /** The complete raw payload as received. */
  raw: unknown
}

/** Outcome of authenticating an inbound webhook request. */
export type WebhookAuthOutcome = 'verified' | 'unauthenticated' | 'rejected'

export interface WebhookAuthResult {
  outcome: WebhookAuthOutcome
  /** Human-readable reason, logged and stored on rejection. */
  reason?: string
}

/** Result of parsing a raw carrier payload. */
export type ShipmentParseResult =
  | { ok: true; update: NormalizedShipmentUpdate }
  | { ok: false; error: string }

/**
 * The seam a new carrier plugs into. Implement this, register it, and point a
 * thin route at the shared ingestion service.
 */
export interface ShippingProviderAdapter {
  /** Stable provider key, persisted in `shipments.provider`. */
  readonly name: string
  /** Authenticates an inbound webhook request. */
  verifyAuth(headers: Headers, rawBody: string): WebhookAuthResult
  /** Normalizes an already-JSON-parsed body. Must never throw. */
  parse(json: unknown): ShipmentParseResult
}
