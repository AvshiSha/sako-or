import * as Sentry from '@sentry/nextjs'
import { NextRequest, NextResponse } from 'next/server'
import { ingestShipmentWebhook } from '@/lib/shipping/webhook-service'

/**
 * POST /api/webhook/hfd
 *
 * Receives HFD shipment status PUSH notifications. HFD posts a JSON body each time a
 * tracking status changes; we match it to an order via the reference we supplied when
 * the shipment was created (expected in `ref2`), record the shipment state, and — on
 * the transition into "delivered" — schedule a review request for 24h later.
 *
 * All business logic lives in `lib/shipping/*`. This handler only marshals the
 * request and picks a status code, so a second carrier is a near-identical file.
 *
 * Response policy: everything except a rejected credential returns 200. HFD retries
 * on failure, and none of our failure modes (unparseable body, unknown order) become
 * more likely to succeed on a retry. Every delivery is persisted to `webhook_events`
 * regardless of outcome, so nothing is lost by answering 200.
 */

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // Read the body as text exactly once: HMAC verification must run against the
    // raw bytes, and consuming the stream twice is not possible.
    const rawBody = await request.text()

    const result = await ingestShipmentWebhook({
      provider: 'hfd',
      rawBody,
      headers: request.headers,
    })

    if (result.httpStatus === 401) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json(
      { success: result.status === 'processed', status: result.status },
      { status: result.httpStatus }
    )
  } catch (error) {
    // Defence in depth — ingestShipmentWebhook already handles its own failures.
    Sentry.captureException(error, { tags: { webhook: 'hfd' } })
    console.error('[HFD_WEBHOOK] Unhandled error', error)
    return NextResponse.json({ success: false }, { status: 200 })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers':
        'Content-Type, Authorization, x-webhook-secret, x-webhook-signature',
    },
  })
}
