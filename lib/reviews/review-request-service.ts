import 'server-only'
import { Prisma } from '@prisma/client'
import { prisma } from '../prisma'

/**
 * Scheduling of post-delivery review requests.
 *
 * This module only ever *schedules*. Nothing is emailed or texted here — the webhook
 * that calls it must return quickly, and sending is the cron job's job (Phase 2).
 */

const DEFAULT_DELAY_HOURS = 24

/** Review delay in hours, overridable via env for testing. */
function getDelayHours(): number {
  const raw = process.env.REVIEW_REQUEST_DELAY_HOURS
  if (!raw) return DEFAULT_DELAY_HOURS
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_DELAY_HOURS
}

export type ScheduleReviewRequestResult =
  | { scheduled: true; scheduledFor: Date }
  | { scheduled: false; reason: 'already_exists' }

/**
 * Schedules a review request for `deliveredAt + REVIEW_REQUEST_DELAY_HOURS`.
 *
 * Idempotency comes from the `review_requests.order_id` unique constraint rather
 * than a findFirst-then-create, which would race under concurrent webhook delivery.
 * We attempt the insert and treat a P2002 unique violation as "already scheduled" —
 * the same approach `lib/points.ts` uses for its @@unique([orderId, kind]) guard.
 *
 * The constraint is on order_id with no status qualifier, so a request that has
 * already been sent, skipped or failed will never be silently re-created either.
 */
export async function scheduleReviewRequest(params: {
  orderId: string
  orderNumber: string
  deliveredAt: Date
}): Promise<ScheduleReviewRequestResult> {
  const { orderId, orderNumber, deliveredAt } = params

  const scheduledFor = new Date(deliveredAt.getTime() + getDelayHours() * 60 * 60 * 1000)

  try {
    await prisma.reviewRequest.create({
      data: {
        orderId,
        orderNumber,
        status: 'pending',
        scheduledFor,
      },
    })

    console.log('[REVIEW_REQUEST] Scheduled review request', {
      orderNumber,
      scheduledFor: scheduledFor.toISOString(),
    })

    return { scheduled: true, scheduledFor }
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      console.log('[REVIEW_REQUEST] Already scheduled, skipping', { orderNumber })
      return { scheduled: false, reason: 'already_exists' }
    }
    throw error
  }
}
