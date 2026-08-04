import 'server-only'
import * as Sentry from '@sentry/nextjs'
import { Prisma } from '@prisma/client'
import { prisma } from '../prisma'
import { scheduleReviewRequest } from '../reviews/review-request-service'
import { getShippingAdapter } from './registry'
import { resolveReferenceCandidates } from './reference'
import { applyShipmentUpdate } from './shipment-service'
import type { WebhookAuthOutcome } from './types'

/**
 * Inbound carrier-webhook ingestion pipeline.
 *
 * Shared by every provider: the route layer only supplies the provider key and the
 * raw request. This function never throws — a webhook endpoint that 500s teaches the
 * carrier to retry, and for most failure modes (unparseable body, unknown order) a
 * retry cannot possibly succeed. Failures are recorded and reported instead.
 */

/** How the caller should respond. Only a rejected credential is worth a non-200. */
export type IngestStatus =
  | 'processed'
  | 'ignored'
  | 'invalid'
  | 'unknown_order'
  | 'error'
  | 'rejected'

export interface IngestResult {
  status: IngestStatus
  httpStatus: number
  orderNumber?: string
  shipmentId?: string
  becameDelivered?: boolean
  reviewScheduled?: boolean
  error?: string
}

/**
 * Records the raw delivery. Best-effort: a logging failure must never mask the
 * webhook's real outcome, so this swallows its own errors.
 */
async function recordWebhookEvent(params: {
  provider: string
  authOutcome: WebhookAuthOutcome
  status: IngestStatus
  payload: unknown
  orderNumber?: string | null
  error?: string | null
}): Promise<void> {
  try {
    await prisma.webhookEvent.create({
      data: {
        provider: params.provider,
        authOutcome: params.authOutcome,
        status: params.status,
        orderNumber: params.orderNumber ?? null,
        // Store something JSON-valid even when the body was not JSON at all.
        payload: (params.payload ?? {}) as Prisma.InputJsonValue,
        error: params.error ?? null,
      },
    })
  } catch (error) {
    Sentry.captureException(error, { tags: { webhook: params.provider, stage: 'log' } })
    console.error('[SHIPPING_WEBHOOK] Failed to persist webhook event', error)
  }
}

/** Finds the order matching any of the carrier's reference candidates. */
async function findOrderByReference(candidates: string[]) {
  for (const candidate of candidates) {
    const order = await prisma.order.findUnique({
      where: { orderNumber: candidate },
      select: { id: true, orderNumber: true },
    })
    if (order) return order
  }
  return null
}

export async function ingestShipmentWebhook(params: {
  provider: string
  rawBody: string
  headers: Headers
}): Promise<IngestResult> {
  const { provider, rawBody, headers } = params
  const logTag = `[${provider.toUpperCase()}_WEBHOOK]`

  const adapter = getShippingAdapter(provider)
  if (!adapter) {
    console.error(`${logTag} No adapter registered for provider`, { provider })
    return { status: 'error', httpStatus: 500, error: `Unknown provider: ${provider}` }
  }

  // 1. Authenticate. Done against the raw body so HMAC stays available.
  const auth = adapter.verifyAuth(headers, rawBody)

  if (auth.outcome === 'rejected') {
    console.warn(`${logTag} Rejected unauthorized request`, { reason: auth.reason })
    await recordWebhookEvent({
      provider,
      authOutcome: 'rejected',
      status: 'rejected',
      payload: { rawBodyPreview: rawBody.slice(0, 2000) },
      error: auth.reason,
    })
    return { status: 'rejected', httpStatus: 401, error: auth.reason }
  }

  if (auth.outcome === 'unauthenticated') {
    // Loud on purpose: the endpoint is currently open because HFD has not told us
    // how their PUSH authenticates. This line is the reminder to close it.
    console.warn(
      `${logTag} Accepting UNAUTHENTICATED request — no auth mode configured. ` +
        `Set ${provider.toUpperCase()}_WEBHOOK_AUTH_MODE once the carrier confirms its mechanism.`
    )
  }

  // 2. Parse. A body that will never parse must not be retried, so this is a 200.
  let json: unknown
  try {
    json = JSON.parse(rawBody)
  } catch {
    console.error(`${logTag} Body is not valid JSON`, { preview: rawBody.slice(0, 500) })
    await recordWebhookEvent({
      provider,
      authOutcome: auth.outcome,
      status: 'invalid',
      payload: { rawBodyPreview: rawBody.slice(0, 2000) },
      error: 'Body is not valid JSON',
    })
    return { status: 'invalid', httpStatus: 200, error: 'Invalid JSON' }
  }

  const parsed = adapter.parse(json)
  if (!parsed.ok) {
    console.error(`${logTag} Payload failed validation`, { error: parsed.error })
    await recordWebhookEvent({
      provider,
      authOutcome: auth.outcome,
      status: 'invalid',
      payload: json,
      error: parsed.error,
    })
    return { status: 'invalid', httpStatus: 200, error: parsed.error }
  }

  const update = parsed.update
  const candidates = resolveReferenceCandidates(update.referenceCandidates)

  if (candidates.length === 0) {
    console.warn(`${logTag} Payload carried no usable order reference`)
    await recordWebhookEvent({
      provider,
      authOutcome: auth.outcome,
      status: 'ignored',
      payload: json,
      error: 'No usable order reference',
    })
    return { status: 'ignored', httpStatus: 200, error: 'No usable order reference' }
  }

  // 3. Locate the order.
  try {
    const order = await findOrderByReference(candidates)

    if (!order) {
      console.warn(`${logTag} Unknown order`, { candidates })
      await recordWebhookEvent({
        provider,
        authOutcome: auth.outcome,
        status: 'unknown_order',
        payload: json,
        orderNumber: candidates[0],
        error: `No order matched: ${candidates.join(', ')}`,
      })
      return { status: 'unknown_order', httpStatus: 200, orderNumber: candidates[0] }
    }

    // 4. Persist shipment state.
    const result = await applyShipmentUpdate({
      orderId: order.id,
      orderNumber: order.orderNumber,
      update,
    })

    // 5. Schedule the review request — only on the transition into delivered.
    let reviewScheduled = false
    if (result.becameDelivered && result.shipment.deliveredAt) {
      const scheduling = await scheduleReviewRequest({
        orderId: order.id,
        orderNumber: order.orderNumber,
        deliveredAt: result.shipment.deliveredAt,
      })
      reviewScheduled = scheduling.scheduled
    }

    console.log(`${logTag} Processed`, {
      orderNumber: order.orderNumber,
      shipmentId: result.shipment.id,
      newEvents: result.newEventCount,
      becameDelivered: result.becameDelivered,
      reviewScheduled,
    })

    await recordWebhookEvent({
      provider,
      authOutcome: auth.outcome,
      status: 'processed',
      payload: json,
      orderNumber: order.orderNumber,
    })

    return {
      status: 'processed',
      httpStatus: 200,
      orderNumber: order.orderNumber,
      shipmentId: result.shipment.id,
      becameDelivered: result.becameDelivered,
      reviewScheduled,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    Sentry.captureException(error, { tags: { webhook: provider, stage: 'process' } })
    console.error(`${logTag} Processing error`, error)

    await recordWebhookEvent({
      provider,
      authOutcome: auth.outcome,
      status: 'error',
      payload: json,
      orderNumber: candidates[0],
      error: message,
    })

    // 200 on purpose: the payload is recorded and replayable from webhook_events,
    // and a 500 would only trigger carrier retries of work that may have partially
    // succeeded. Sentry is the alerting path here, not the HTTP status.
    return { status: 'error', httpStatus: 200, error: message }
  }
}
