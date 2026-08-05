import 'server-only'
import { Prisma } from '@prisma/client'
import type { Shipment } from '@prisma/client'
import { prisma } from '../prisma'
import type { NormalizedShipmentUpdate } from './types'

/**
 * Persists normalized carrier shipment updates.
 *
 * Every write here is idempotent. Carriers retry, and HFD explicitly may send the
 * same status more than once, so replaying an identical payload must converge on the
 * same rows rather than accumulating duplicates or re-firing automations.
 */

export interface ApplyShipmentUpdateResult {
  shipment: Shipment
  /**
   * True only on the single call that transitioned this shipment to delivered.
   * Derived from a conditional UPDATE, so concurrent deliveries of the same webhook
   * produce exactly one `true` — this is what makes review scheduling safe.
   */
  becameDelivered: boolean
  /** Number of genuinely new status rows written (0 on a replay). */
  newEventCount: number
}

/**
 * The carrier's shipment id, or a deterministic sentinel when it is absent.
 *
 * `shipments.provider_shipment_no` is NOT NULL because Postgres considers NULLs
 * distinct in a unique index — a nullable column would let every ship_no-less
 * webhook insert another duplicate row for the same parcel. The sentinel is derived
 * from the order number so repeated deliveries still collapse onto one row.
 */
function resolveShipmentKey(update: NormalizedShipmentUpdate, orderNumber: string): string {
  const shipNo = update.providerShipmentNo?.trim()
  return shipNo && shipNo.length > 0 ? shipNo : `order:${orderNumber}`
}

/** The most recent event in this payload, used for the denormalized latest-status columns. */
function latestEvent(update: NormalizedShipmentUpdate, fallbackDate: Date) {
  const dated = update.events.map((event) => ({
    ...event,
    occurredAt: event.occurredAt ?? fallbackDate,
  }))

  if (dated.length === 0) return null

  return dated.reduce((latest, candidate) =>
    candidate.occurredAt.getTime() >= latest.occurredAt.getTime() ? candidate : latest
  )
}

/**
 * `prisma.upsert` compiles to a read followed by an insert-or-update, which is not
 * atomic: two concurrent deliveries of the same webhook can both find no row and
 * race to insert, and the loser gets a P2002 unique violation. Retrying once is
 * sufficient, because by then the row provably exists and the retry takes the
 * update path.
 */
async function upsertShipmentWithRetry(
  args: Prisma.ShipmentUpsertArgs
): Promise<Shipment> {
  try {
    return await prisma.shipment.upsert(args)
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      console.warn('[SHIPMENT] Concurrent upsert race, retrying once')
      return await prisma.shipment.upsert(args)
    }
    throw error
  }
}

export async function applyShipmentUpdate(params: {
  orderId: string
  orderNumber: string
  update: NormalizedShipmentUpdate
  receivedAt?: Date
}): Promise<ApplyShipmentUpdateResult> {
  const { orderId, orderNumber, update } = params
  const receivedAt = params.receivedAt ?? new Date()

  const providerShipmentNo = resolveShipmentKey(update, orderNumber)
  const latest = latestEvent(update, receivedAt)

  // Upsert on the carrier identity. Note this intentionally does NOT write
  // is_delivered — that transition is handled separately below so we can detect
  // whether *this* call was the one that flipped it.
  //
  // Wrapped in a single retry because `upsert` is not atomic against a concurrent
  // insert: if two copies of the same webhook arrive together, both can miss the
  // row on read and one loses the race with P2002. Retrying once turns that into
  // the ordinary update path.
  const shipment = await upsertShipmentWithRetry({
    where: {
      provider_providerShipmentNo: {
        provider: update.provider,
        providerShipmentNo,
      },
    },
    create: {
      orderId,
      orderNumber,
      provider: update.provider,
      providerShipmentNo,
      providerRef: update.referenceCandidates[0] ?? null,
      providerRandomId: update.providerRandomId,
      isReturnedToSender: update.isReturnedToSender,
      returnedAt: update.isReturnedToSender ? receivedAt : null,
      isCanceled: update.isCanceled,
      canceledAt: update.isCanceled ? receivedAt : null,
      lastStatusCode: latest?.statusCode ?? null,
      lastStatusDesc: latest?.statusDesc ?? null,
      lastStatusAt: latest?.occurredAt ?? null,
      lastWebhookReceivedAt: receivedAt,
      rawLatestPayload: update.raw as Prisma.InputJsonValue,
    },
    update: {
      providerRandomId: update.providerRandomId ?? undefined,
      // `|| undefined` so a later payload omitting the flag never un-sets it:
      // returned and canceled are terminal states, not transient ones.
      isReturnedToSender: update.isReturnedToSender || undefined,
      returnedAt: update.isReturnedToSender ? receivedAt : undefined,
      isCanceled: update.isCanceled || undefined,
      canceledAt: update.isCanceled ? receivedAt : undefined,
      lastStatusCode: latest?.statusCode ?? undefined,
      lastStatusDesc: latest?.statusDesc ?? undefined,
      lastStatusAt: latest?.occurredAt ?? undefined,
      lastWebhookReceivedAt: receivedAt,
      rawLatestPayload: update.raw as Prisma.InputJsonValue,
    },
  })

  // Status history. The @@unique([shipmentId, statusCode, occurredAt]) constraint
  // does the deduplication, so a replayed payload inserts nothing.
  let newEventCount = 0
  if (update.events.length > 0) {
    const created = await prisma.shipmentEvent.createMany({
      data: update.events.map((event) => ({
        shipmentId: shipment.id,
        statusCode: event.statusCode,
        statusDesc: event.statusDesc,
        // Never null: an undatable status still deserves a row, timestamped at receipt.
        occurredAt: event.occurredAt ?? receivedAt,
        location: event.location,
        city: event.city,
        raw: event.raw as Prisma.InputJsonValue,
      })),
      skipDuplicates: true,
    })
    newEventCount = created.count
  }

  // Delivery transition, as a guarded conditional UPDATE rather than read-then-write.
  // `count === 1` can only happen once even if two identical webhooks are processed
  // concurrently, which is precisely the guarantee the review automation needs.
  //
  // A returned parcel is explicitly NOT a delivery. HFD sends ship_delivered_back_yn
  // alongside ship_delivered_yn: "y", so keying only off the latter would mark a
  // parcel that came back to the warehouse as delivered and ask the customer to
  // review an order they never received.
  const deliveredToCustomer = update.isDelivered && !update.isReturnedToSender

  if (update.isDelivered && update.isReturnedToSender) {
    console.warn('[SHIPMENT] Parcel returned to sender — not treating as delivered', {
      orderNumber,
      providerShipmentNo,
    })
  }

  let becameDelivered = false
  let finalShipment = shipment

  if (deliveredToCustomer && !shipment.isDelivered) {
    const deliveredAt = latest?.occurredAt ?? receivedAt

    const transitioned = await prisma.shipment.updateMany({
      where: { id: shipment.id, isDelivered: false },
      data: { isDelivered: true, deliveredAt },
    })

    becameDelivered = transitioned.count === 1

    if (becameDelivered) {
      finalShipment = { ...shipment, isDelivered: true, deliveredAt }
    }
  }

  return { shipment: finalShipment, becameDelivered, newEventCount }
}
