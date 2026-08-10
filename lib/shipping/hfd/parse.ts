import 'server-only'
import { z } from 'zod'
import { parseHfdDateTimeDetailed } from '../../date/hfd-date'
import type {
  NormalizedShipmentEvent,
  NormalizedShipmentUpdate,
  ShipmentParseResult,
} from '../types'
import type { HfdStatusEntry } from './types'

/**
 * Defensive normalizer for HFD payloads.
 *
 * Validation is deliberately permissive: the schema accepts unknown keys, tolerates
 * scalars of the wrong primitive type, and accepts `status` as either an array or a
 * bare object. The only genuinely fatal condition is a body that is not a JSON object
 * at all — silently dropping a delivery notification is far worse than storing a
 * partially-understood one, and the raw body is persisted regardless.
 */

/**
 * Coerces any scalar to a trimmed string.
 *
 * Booleans are accepted deliberately, not incidentally. HFD documents the `_yn`
 * fields as "y"/"n", but a JSON `true` is a plausible variant, and without
 * `z.boolean()` in this union such a body would fail validation outright — losing
 * the one signal the review automation depends on.
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
    // HFD's own sample uses `status_desc` on one entry and `desc_status` on the next.
    desc_status: looseString,
    status_date: looseString,
    status_time: looseString,
    status_timezone: looseString,
    status_dt: looseString,
    status_customer_code: looseString,
    status_foreign_code: looseString,
    status_location: looseString,
    status_city: looseString,
    status_country: looseString,
    status_province: looseString,
    status_post_code: looseString,
  })
  .passthrough()

const payloadSchema = z
  .object({
    // --- Documented (snake_case) shape ---
    ship_no: looseString,
    ref1: looseString,
    ref2: looseString,
    ref2_with_prefix: looseString,
    ship_delivered_yn: looseString,
    ship_delivered_back_yn: looseString,
    ship_canceled_yn: looseString,
    random_id: looseString,
    status: z
      .union([z.array(statusEntrySchema), statusEntrySchema, z.null()])
      .optional(),

    // --- Actual PUSH (camelCase, flat) shape ---
    // HFD's live webhook does NOT send the format in their documentation. It sends
    // one notification per status change, with the status fields flattened onto the
    // envelope rather than nested in a `status[]` array, and different field names
    // throughout. Both shapes are accepted so the documented format keeps working
    // (their PULL API still uses it) and a future change back does not break us.
    shipmentId: looseString,
    reference1: looseString,
    reference2: looseString,
    randomNum: looseString,
    IsShipDelivered: looseString,
    IsShipCanceled: looseString,
    statusCode: looseString,
    statusDesc: looseString,
    /** Combined local datetime, e.g. "2026-08-10T14:58:12" — no offset marker. */
    statusDate: looseString,
  })
  .passthrough()

/**
 * HFD documents "y"/"n". Accept the obvious variants too — a boolean `true` or a
 * numeric `1` must not be read as "not delivered".
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

  // `status_dt` is empty in HFD's sample but is preferred when populated, since a
  // combined datetime removes any ambiguity between the split date/time fields.
  const parsed = entry.status_dt
    ? parseHfdDateTimeDetailed(entry.status_dt, null, entry.status_timezone)
    : parseHfdDateTimeDetailed(entry.status_date, entry.status_time, entry.status_timezone)

  if (parsed.explicitDisagreedWithZone) {
    // Surfaced rather than silently trusted: if HFD hardcodes "GMT+2" year-round,
    // every summer timestamp is an hour off and this is how we find out.
    console.warn('[HFD_PARSE] status_timezone disagrees with Israel local time', {
      statusCode,
      statusDate: entry.status_date,
      statusTime: entry.status_time,
      statusTimezone: entry.status_timezone,
      appliedOffsetMinutes: parsed.appliedOffsetMinutes,
    })
  }

  return {
    statusCode,
    // Read both spellings HFD uses for the description.
    statusDesc: entry.status_desc ?? entry.desc_status ?? null,
    occurredAt: parsed.date,
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

  // Our order number arrives in the reference fields. ref2/reference2 is tried first
  // because that is where we ask for it (ref1 is capped at 24 chars, which the
  // 25-char SAKO- format overflows). The rest are genuine fallbacks.
  const referenceCandidates = [
    data.ref2,
    data.reference2,
    data.ref1,
    data.reference1,
    data.ref2_with_prefix,
    typeof (json as Record<string, unknown>).reference === 'string'
      ? ((json as Record<string, unknown>).reference as string)
      : null,
  ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0)

  const events = toStatusArray(data.status as HfdStatusEntry[] | HfdStatusEntry | null)
    .map(normalizeEvent)
    .filter((event): event is NormalizedShipmentEvent => event !== null)

  // Flat shape: the status fields sit on the envelope, so synthesise the single
  // event they describe. Only when the nested array did not already supply events.
  if (events.length === 0 && data.statusCode) {
    const flatEvent = normalizeEvent({
      status_code: data.statusCode,
      status_desc: data.statusDesc,
      // statusDate carries date AND time in one string; parseHfdDateTime extracts
      // both. No offset is provided, so it is read as Israel local time.
      status_date: data.statusDate,
      status_time: null,
      status_timezone: null,
    })
    if (flatEvent) events.push(flatEvent)
  }

  const update: NormalizedShipmentUpdate = {
    provider: 'hfd',
    providerShipmentNo: data.ship_no ?? data.shipmentId,
    referenceCandidates,
    providerRandomId: data.random_id ?? data.randomNum,
    isDelivered: isAffirmative(data.ship_delivered_yn ?? data.IsShipDelivered),
    // The live payload has no returned-to-sender field. Absent means false, which is
    // the safe default: worst case a returned parcel is treated as delivered and one
    // review request goes out early, rather than every delivery being suppressed.
    isReturnedToSender: isAffirmative(data.ship_delivered_back_yn),
    isCanceled: isAffirmative(data.ship_canceled_yn ?? data.IsShipCanceled),
    events,
    raw: json,
  }

  return { ok: true, update }
}
