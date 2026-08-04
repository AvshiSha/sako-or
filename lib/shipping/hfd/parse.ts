import 'server-only'
import { z } from 'zod'
import { parseHfdDateTime } from '../../date/hfd-date'
import type {
  NormalizedShipmentEvent,
  NormalizedShipmentUpdate,
  ShipmentParseResult,
} from '../types'
import type { HfdStatusEntry } from './types'

/**
 * Defensive normalizer for HFD payloads.
 *
 * The PUSH format is undocumented, so validation is deliberately permissive: the
 * schema accepts unknown keys, tolerates numbers where strings are documented, and
 * accepts `status` as either an array or a bare object. The only genuinely fatal
 * condition is a body that is not a JSON object at all — anything else is recorded
 * and processed as best we can, because silently dropping a delivery notification
 * is far worse than storing a partially-understood one.
 */

/**
 * Coerces any scalar to a trimmed string.
 *
 * Booleans are accepted deliberately, not incidentally. HFD documents
 * `ship_delivered_yn` as "y"/"n", but the PUSH format is unverified and a JSON
 * `true` is a plausible variant. Without `z.boolean()` in this union such a body
 * would fail validation outright and the entire delivery notification would be
 * discarded as invalid — losing the one signal the review automation depends on.
 * Being permissive here costs nothing; the raw body is stored either way.
 */
const looseString = z
  .union([z.string(), z.number(), z.boolean(), z.null()])
  .optional()
  .transform((value) =>
    value === null || value === undefined ? null : String(value).trim() || null
  )

const statusEntrySchema = z
  .object({
    status_code: looseString,
    status_desc: looseString,
    status_date: looseString,
    status_time: looseString,
    status_customer_code: looseString,
    status_foreign_code: looseString,
    status_location: looseString,
    status_city: looseString,
  })
  .passthrough()

const payloadSchema = z
  .object({
    ship_no: looseString,
    ref1: looseString,
    ref2: looseString,
    ship_delivered_yn: looseString,
    ship_canceled_yn: looseString,
    random_id: looseString,
    status: z
      .union([z.array(statusEntrySchema), statusEntrySchema, z.null()])
      .optional(),
  })
  .passthrough()

/**
 * HFD documents "y"/"n". Accept the obvious variants too — a boolean `true` or a
 * numeric `1` in the PUSH body must not be read as "not delivered".
 */
function isAffirmative(value: string | null): boolean {
  if (!value) return false
  const normalized = value.trim().toLowerCase()
  return normalized === 'y' || normalized === 'yes' || normalized === 'true' || normalized === '1'
}

/** Accepts `status` as an array, a single object, or nothing at all. */
function toStatusArray(
  status: HfdStatusEntry[] | HfdStatusEntry | null | undefined
): HfdStatusEntry[] {
  if (!status) return []
  return Array.isArray(status) ? status : [status]
}

function normalizeEvent(entry: HfdStatusEntry): NormalizedShipmentEvent | null {
  const statusCode = entry.status_code == null ? null : String(entry.status_code).trim()

  // A status with no code cannot be deduplicated, so it is not worth a row.
  // The whole payload is still persisted in webhook_events.
  if (!statusCode) return null

  return {
    statusCode,
    statusDesc: entry.status_desc ?? null,
    occurredAt: parseHfdDateTime(entry.status_date, entry.status_time),
    location: entry.status_location ?? null,
    city: entry.status_city ?? null,
    raw: entry,
  }
}

export function normalizeHfdPayload(json: unknown): ShipmentParseResult {
  if (json === null || typeof json !== 'object' || Array.isArray(json)) {
    return { ok: false, error: 'Payload is not a JSON object' }
  }

  const parsed = payloadSchema.safeParse(json)
  if (!parsed.success) {
    return {
      ok: false,
      error: `Payload failed validation: ${JSON.stringify(parsed.error.flatten())}`,
    }
  }

  const data = parsed.data

  // ref2 first: that is where we put our own order number when the shipment is
  // created. ref1 and a generic `reference` are fallbacks in case PUSH differs.
  const referenceCandidates = [
    data.ref2,
    data.ref1,
    typeof (json as Record<string, unknown>).reference === 'string'
      ? ((json as Record<string, unknown>).reference as string)
      : null,
  ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0)

  const events = toStatusArray(data.status as HfdStatusEntry[] | HfdStatusEntry | null)
    .map(normalizeEvent)
    .filter((event): event is NormalizedShipmentEvent => event !== null)

  const update: NormalizedShipmentUpdate = {
    provider: 'hfd',
    providerShipmentNo: data.ship_no,
    referenceCandidates,
    providerRandomId: data.random_id,
    isDelivered: isAffirmative(data.ship_delivered_yn),
    isCanceled: isAffirmative(data.ship_canceled_yn),
    events,
    raw: json,
  }

  return { ok: true, update }
}
