import 'server-only'
import { Prisma } from '@prisma/client'
import { prisma } from '../prisma'
import { getVerifoneCustomerByCellular } from '../verifone'
import { isTestOrderNumber } from '../shipping/reference'
import { buildReviewUrl, buildSignupUrl } from '../server/review-token'
import { getEnabledReviewChannels } from './channels'
import type { ReviewChannelResult } from './channels'
import { buildReviewMessage, resolveReviewLanguage } from './review-messages'

/**
 * Sends review requests whose scheduled time has arrived.
 *
 * Driven by cron rather than a queue, because Vercel Cron is the only scheduling
 * primitive available in this project. Correctness therefore cannot rely on a job
 * running exactly once — overlapping runs are assumed, and every send is gated behind
 * an atomic claim.
 */

const DEFAULT_BATCH_SIZE = 50
const MAX_ATTEMPTS = 5
const BACKOFF_BASE_MS = 15 * 60 * 1000 // 15 minutes

export interface ReviewRequestJobSummary {
  totalDue: number
  sent: number
  skipped: number
  failed: number
  durationMs: number
  errors: { orderNumber: string; error: string }[]
}

/** Retry delay grows exponentially: 30m, 1h, 2h, 4h. */
function backoffFor(attempts: number): Date {
  return new Date(Date.now() + BACKOFF_BASE_MS * Math.pow(2, attempts))
}

/**
 * Whether an order should still receive a review request at send time.
 *
 * Re-checked now rather than trusted from scheduling time, because 24 hours is long
 * enough for an order to be cancelled after delivery.
 *
 * TODO: there is no refund state in the schema today. When one exists, a fully
 * refunded order should become ineligible here.
 */
function checkEligibility(order: {
  orderNumber: string
  status: string
  paymentStatus: string
  customerEmail: string | null
  customerPhone: string | null
}): { eligible: boolean; reason?: string } {
  if (isTestOrderNumber(order.orderNumber)) {
    return { eligible: false, reason: 'Test order' }
  }
  if (order.status === 'cancelled' || order.status === 'failed') {
    return { eligible: false, reason: `Order status is ${order.status}` }
  }
  if (order.paymentStatus !== 'completed') {
    return { eligible: false, reason: `Payment status is ${order.paymentStatus}` }
  }
  if (!order.customerEmail && !order.customerPhone) {
    return { eligible: false, reason: 'No email or phone to contact' }
  }
  return { eligible: true }
}

/**
 * Determines loyalty-club membership.
 *
 * A stored `verifoneCustomerNo` is taken as proof without a network call. Otherwise
 * Verifone is asked. On any lookup failure we assume NOT a member: showing the signup
 * link to an existing member is harmless, whereas hiding it from a non-member costs
 * them the points they were promised.
 */
async function resolveClubMembership(params: {
  verifoneCustomerNo: string | null | undefined
  phone: string | null
  orderNumber: string
}): Promise<boolean> {
  if (params.verifoneCustomerNo) return true
  if (!params.phone) return false

  try {
    const result = await getVerifoneCustomerByCellular(params.phone)
    return Boolean(result.success && result.customer?.isClubMember)
  } catch (error) {
    console.warn('[REVIEW_REQUEST] Club lookup failed, assuming non-member', {
      orderNumber: params.orderNumber,
      error: error instanceof Error ? error.message : String(error),
    })
    return false
  }
}

function firstNameOf(customerName: string | null, userFirstName: string | null): string {
  if (userFirstName?.trim()) return userFirstName.trim()
  return customerName?.trim().split(/\s+/)[0] ?? ''
}

async function processOne(
  request: { id: string; orderId: string; orderNumber: string; attempts: number }
): Promise<'sent' | 'skipped' | 'failed'> {
  const now = new Date()

  // ATOMIC CLAIM. Two overlapping cron runs both see this row as due; the conditional
  // UPDATE means exactly one of them gets count === 1 and proceeds. Without this,
  // "never send twice" would depend on timing.
  const claimed = await prisma.reviewRequest.updateMany({
    where: { id: request.id, status: 'pending' },
    data: { status: 'processing', attempts: { increment: 1 }, lastAttemptAt: now },
  })

  if (claimed.count !== 1) {
    return 'skipped'
  }

  const attempts = request.attempts + 1

  try {
    const order = await prisma.order.findUnique({
      where: { id: request.orderId },
      select: {
        orderNumber: true,
        status: true,
        paymentStatus: true,
        customerName: true,
        customerEmail: true,
        customerPhone: true,
        user: {
          select: { firstName: true, language: true, phone: true, verifoneCustomerNo: true },
        },
      },
    })

    if (!order) {
      await prisma.reviewRequest.update({
        where: { id: request.id },
        data: { status: 'skipped', lastError: 'Order no longer exists' },
      })
      return 'skipped'
    }

    const eligibility = checkEligibility(order)
    if (!eligibility.eligible) {
      console.log('[REVIEW_REQUEST] Not eligible, skipping', {
        orderNumber: order.orderNumber,
        reason: eligibility.reason,
      })
      await prisma.reviewRequest.update({
        where: { id: request.id },
        data: { status: 'skipped', lastError: eligibility.reason },
      })
      return 'skipped'
    }

    const language = resolveReviewLanguage(order.user?.language)
    const phone = order.user?.phone ?? order.customerPhone
    const isClubMember = await resolveClubMembership({
      verifoneCustomerNo: order.user?.verifoneCustomerNo,
      phone,
      orderNumber: order.orderNumber,
    })

    const reviewUrl = buildReviewUrl({ orderNumber: order.orderNumber, language })
    const signupUrl = buildSignupUrl(language)

    const firstName = firstNameOf(order.customerName, order.user?.firstName ?? null)

    const copy = buildReviewMessage(language, {
      firstName,
      reviewUrl,
      signupUrl,
      isClubMember,
    })

    const channels = getEnabledReviewChannels()
    const results: ReviewChannelResult[] = []

    for (const channel of channels) {
      const result = await channel.send({
        orderNumber: order.orderNumber,
        attempt: attempts,
        language,
        copy,
        reviewUrl,
        signupUrl,
        isClubMember,
        customerName: order.customerName,
        firstName,
        customerEmail: order.customerEmail,
        customerPhone: phone,
      })
      results.push(result)
    }

    const anySucceeded = results.some((result) => result.ok)
    const channelsJson = results as unknown as Prisma.InputJsonValue

    if (anySucceeded) {
      // Marked sent only after at least one channel confirmed delivery.
      await prisma.reviewRequest.update({
        where: { id: request.id },
        data: {
          status: 'sent',
          sentAt: new Date(),
          channels: channelsJson,
          lastError: null,
          nextAttemptAt: null,
        },
      })

      console.log('[REVIEW_REQUEST] Sent', {
        orderNumber: order.orderNumber,
        isClubMember,
        language,
        channels: results.map((r) => `${r.channel}:${r.ok ? 'ok' : r.skipped ? 'skipped' : 'failed'}`),
      })
      return 'sent'
    }

    // Every channel skipped (nothing configured / no address) is a dead end, not a
    // transient fault — retrying it would just burn the budget to the same result.
    const allSkipped = results.length === 0 || results.every((result) => result.skipped)

    if (allSkipped) {
      await prisma.reviewRequest.update({
        where: { id: request.id },
        data: {
          status: 'skipped',
          channels: channelsJson,
          lastError: 'No channel was able to send',
        },
      })
      return 'skipped'
    }

    const errorText = results
      .filter((result) => !result.ok && !result.skipped)
      .map((result) => `${result.channel}: ${result.error}`)
      .join('; ')

    const exhausted = attempts >= MAX_ATTEMPTS

    await prisma.reviewRequest.update({
      where: { id: request.id },
      data: {
        status: exhausted ? 'failed' : 'pending',
        channels: channelsJson,
        lastError: errorText,
        nextAttemptAt: exhausted ? null : backoffFor(attempts),
      },
    })

    console.error('[REVIEW_REQUEST] Send failed', {
      orderNumber: order.orderNumber,
      attempts,
      exhausted,
      error: errorText,
    })
    return 'failed'
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const exhausted = attempts >= MAX_ATTEMPTS

    // Release the claim so the row is retried rather than stranded in "processing".
    await prisma.reviewRequest
      .update({
        where: { id: request.id },
        data: {
          status: exhausted ? 'failed' : 'pending',
          lastError: message,
          nextAttemptAt: exhausted ? null : backoffFor(attempts),
        },
      })
      .catch((updateError) => {
        console.error('[REVIEW_REQUEST] Failed to release claim', updateError)
      })

    console.error('[REVIEW_REQUEST] Unexpected error', {
      orderNumber: request.orderNumber,
      error: message,
    })
    return 'failed'
  }
}

export async function processDueReviewRequests(
  options: { batchSize?: number } = {}
): Promise<ReviewRequestJobSummary> {
  const startedAt = Date.now()
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE
  const now = new Date()

  const due = await prisma.reviewRequest.findMany({
    where: {
      status: 'pending',
      scheduledFor: { lte: now },
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
    },
    orderBy: { scheduledFor: 'asc' },
    take: batchSize,
    select: { id: true, orderId: true, orderNumber: true, attempts: true },
  })

  const summary: ReviewRequestJobSummary = {
    totalDue: due.length,
    sent: 0,
    skipped: 0,
    failed: 0,
    durationMs: 0,
    errors: [],
  }

  // Sequential on purpose: batches are small, and this keeps concurrent load on
  // Resend, Verifone and Inforu predictable. Each item is isolated so one bad row
  // cannot abort the run.
  for (const request of due) {
    try {
      const outcome = await processOne(request)
      summary[outcome] += 1
    } catch (error) {
      summary.failed += 1
      summary.errors.push({
        orderNumber: request.orderNumber,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  summary.durationMs = Date.now() - startedAt
  return summary
}
