import 'server-only'
import { Prisma } from '@prisma/client'
import { prisma } from '../prisma'
import { lookupAccount, resolveAccountsByContact } from './account-lookup'
import { notifyPointsUpdated } from './points-notification'

/**
 * Admin-side review management: listing, moderation, and the manual
 * loyalty-points follow-up.
 */

export type ReviewFilter = 'all' | 'awaiting_points' | 'awarded' | 'unpublished'

export interface AdminReviewProduct {
  id: string
  productSku: string
  productName: string
  size: string | null
  colorName: string | null
  primaryImage: string | null
  rating: number
  body: string | null
  sizingFit: string | null
  isPublished: boolean
}

export interface AdminReview {
  id: string
  orderNumber: string
  submittedAt: string
  language: string
  customerName: string | null
  customerEmail: string | null
  customerPhone: string | null
  /** Current balance from our mirror of Verifone, to pre-fill the "from" box. */
  currentPointsBalance: string | null
  isClubMember: boolean
  /** Account was matched by email/phone rather than Order.userId — i.e. the
   *  customer registered after placing the order. */
  joinedAfterOrder: boolean
  overallRating: number
  serviceRating: number | null
  deliveryRating: number | null
  packagingRating: number | null
  serviceComment: string | null
  deliveryComment: string | null
  packagingComment: string | null
  generalComment: string | null
  pointsAwardedAt: string | null
  pointsBefore: string | null
  pointsAfter: string | null
  pointsAwardedBy: string | null
  notifiedAt: string | null
  notifyResult: unknown
  /** pending | credited | not_eligible | failed */
  rewardStatus: string
  rewardPoints: number | null
  products: AdminReviewProduct[]
}

export interface AdminReviewsPage {
  reviews: AdminReview[]
  total: number
  counts: { all: number; awaitingPoints: number; awarded: number; unpublished: number }
}

function whereFor(filter: ReviewFilter): Prisma.ReviewWhereInput {
  switch (filter) {
    // Keyed on rewardStatus rather than `pointsAwardedAt: null`, so guest reviews
    // with no account to credit stay out of the payout queue instead of sitting
    // there permanently unactionable.
    case 'awaiting_points':
      return { rewardStatus: 'pending' }
    case 'awarded':
      return { rewardStatus: 'credited' }
    case 'unpublished':
      return { productReviews: { some: { isPublished: false } } }
    default:
      return {}
  }
}

/** How many recent guest reviews to re-check per admin page load. */
const PROMOTION_SCAN_LIMIT = 200

/**
 * Promotes guest reviews whose customer has registered since submitting.
 *
 * Only ever moves `not_eligible` -> `pending`; the guarded `updateMany` means a
 * credited reward can never be walked backwards into the queue, and two concurrent
 * admin page loads cannot double-promote.
 */
async function promoteNewlyEligibleReviews(): Promise<number> {
  const candidates = await prisma.review.findMany({
    where: { rewardStatus: 'not_eligible' },
    orderBy: { submittedAt: 'desc' },
    take: PROMOTION_SCAN_LIMIT,
    select: {
      id: true,
      order: { select: { customerEmail: true, customerPhone: true } },
    },
  })

  if (candidates.length === 0) return 0

  const accounts = await resolveAccountsByContact(
    candidates.map((review) => ({
      email: review.order.customerEmail,
      phone: review.order.customerPhone,
    }))
  )

  const eligibleIds = candidates
    .filter(
      (review) =>
        lookupAccount(accounts, {
          email: review.order.customerEmail,
          phone: review.order.customerPhone,
        }) !== null
    )
    .map((review) => review.id)

  if (eligibleIds.length === 0) return 0

  const promoted = await prisma.review.updateMany({
    where: { id: { in: eligibleIds }, rewardStatus: 'not_eligible' },
    data: { rewardStatus: 'pending' },
  })

  if (promoted.count > 0) {
    console.log('[ADMIN_REVIEW] Promoted reviews to pending after registration', {
      count: promoted.count,
    })
  }
  return promoted.count
}

export async function listReviews(params: {
  filter?: ReviewFilter
  page?: number
  limit?: number
}): Promise<AdminReviewsPage> {
  const filter = params.filter ?? 'all'
  const page = Math.max(params.page ?? 1, 1)
  const limit = Math.min(Math.max(params.limit ?? 25, 1), 100)

  // Self-healing eligibility, run before the page query.
  //
  // A guest review is stored `not_eligible` because there was no account to credit
  // at submission time. If that customer has since registered — exactly what the
  // review message asks them to do — nothing else would move the row into the payout
  // queue unless they happened to re-open their review link.
  //
  // This has to be a separate pass rather than folded into the page query: when the
  // admin is looking at the "awaiting points" tab the query filters on
  // `rewardStatus: 'pending'`, so a `not_eligible` row is never fetched and could
  // never promote itself.
  //
  // Bounded to the most recent rows so this stays a cheap fixed cost rather than a
  // full-table scan that grows with the review count.
  await promoteNewlyEligibleReviews()

  const where = whereFor(filter)

  const [rows, total, all, awaitingPoints, awarded, unpublished] = await Promise.all([
    prisma.review.findMany({
      where,
      orderBy: { submittedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        productReviews: {
          include: {
            orderItem: {
              select: {
                productName: true,
                size: true,
                colorName: true,
                primaryImage: true,
              },
            },
          },
        },
        order: {
          select: { customerName: true, customerEmail: true, customerPhone: true },
        },
        user: {
          select: { pointsBalance: true, verifoneCustomerNo: true, phone: true },
        },
      },
    }),
    prisma.review.count({ where }),
    prisma.review.count(),
    prisma.review.count({ where: whereFor('awaiting_points') }),
    prisma.review.count({ where: whereFor('awarded') }),
    prisma.review.count({ where: whereFor('unpublished') }),
  ])

  // Reviews from guest checkouts have no linked user, but the person may well have
  // registered since — including in direct response to our own "join before you
  // review" prompt. Resolve those by contact details.
  const guestAccounts = await resolveAccountsByContact(
    rows
      .filter((review) => !review.user)
      .map((review) => ({
        email: review.order.customerEmail,
        phone: review.order.customerPhone,
      }))
  )

  function accountFor(review: (typeof rows)[number]) {
    if (review.user) return { account: review.user, matchedLater: false }

    const found = lookupAccount(guestAccounts, {
      email: review.order.customerEmail,
      phone: review.order.customerPhone,
    })

    return { account: found, matchedLater: Boolean(found) }
  }

  return {
    total,
    counts: { all, awaitingPoints, awarded, unpublished },
    reviews: rows.map((review) => {
      const { account, matchedLater } = accountFor(review)

      return {
      id: review.id,
      orderNumber: review.orderNumber,
      submittedAt: review.submittedAt.toISOString(),
      language: review.language,
      customerName: review.order.customerName,
      customerEmail: review.order.customerEmail,
      customerPhone: account?.phone ?? review.order.customerPhone,
      currentPointsBalance: account?.pointsBalance?.toString() ?? null,
      // A Verifone customer number is our proxy for club membership; guests have none.
      isClubMember: Boolean(account?.verifoneCustomerNo),
      /** True when the account was found by contact details, not by Order.userId. */
      joinedAfterOrder: matchedLater,
      overallRating: review.overallRating,
      serviceRating: review.serviceRating,
      deliveryRating: review.deliveryRating,
      packagingRating: review.packagingRating,
      serviceComment: review.serviceComment,
      deliveryComment: review.deliveryComment,
      packagingComment: review.packagingComment,
      generalComment: review.generalComment,
      pointsAwardedAt: review.pointsAwardedAt?.toISOString() ?? null,
      pointsBefore: review.pointsBefore?.toString() ?? null,
      pointsAfter: review.pointsAfter?.toString() ?? null,
      pointsAwardedBy: review.pointsAwardedBy,
      notifiedAt: review.notifiedAt?.toISOString() ?? null,
      notifyResult: review.notifyResult,
      rewardStatus: review.rewardStatus,
      rewardPoints: review.rewardPoints,
      products: review.productReviews.map((product) => ({
        id: product.id,
        productSku: product.productSku,
        productName: product.orderItem.productName,
        size: product.orderItem.size,
        colorName: product.orderItem.colorName,
        primaryImage: product.orderItem.primaryImage,
        rating: product.rating,
        body: product.body,
        sizingFit: product.sizingFit,
        isPublished: product.isPublished,
      })),
      }
    }),
  }
}

export type AwardPointsResult =
  | {
      ok: true
      alreadyAwarded: boolean
      notify: { attempted: boolean; ok: boolean; skipped?: boolean; reason?: string; error?: string }
    }
  | { ok: false; reason: 'not_found' }

/**
 * Records that points were credited by hand, and optionally tells the customer.
 *
 * The write is guarded by a conditional update on `pointsAwardedAt: null`, so a
 * double-clicked button cannot record the award twice or fire a second message —
 * the same claim pattern used by the review-request job.
 */
export async function awardPoints(params: {
  reviewId: string
  pointsBefore: number
  pointsAfter: number
  adminEmail: string
  notifyCustomer: boolean
}): Promise<AwardPointsResult> {
  const review = await prisma.review.findUnique({
    where: { id: params.reviewId },
    select: {
      id: true,
      orderNumber: true,
      pointsAwardedAt: true,
      order: { select: { customerName: true, customerEmail: true, customerPhone: true } },
      user: { select: { phone: true } },
    },
  })

  if (!review) return { ok: false, reason: 'not_found' }

  const claimed = await prisma.review.updateMany({
    where: { id: params.reviewId, pointsAwardedAt: null },
    data: {
      pointsAwardedAt: new Date(),
      pointsBefore: new Prisma.Decimal(params.pointsBefore),
      pointsAfter: new Prisma.Decimal(params.pointsAfter),
      pointsAwardedBy: params.adminEmail,
      // Discharge the reward obligation in the same guarded write, so the state
      // machine can never disagree with the manual record beside it.
      rewardStatus: 'credited',
      rewardCreditedAt: new Date(),
      rewardTransactionId: params.adminEmail,
      rewardError: null,
    },
  })

  if (claimed.count !== 1) {
    // Already recorded by an earlier click or another admin — not an error, but we
    // must not send a second notification.
    return {
      ok: true,
      alreadyAwarded: true,
      notify: { attempted: false, ok: false, reason: 'Points were already recorded' },
    }
  }

  console.log('[ADMIN_REVIEW] Points recorded', {
    orderNumber: review.orderNumber,
    before: params.pointsBefore,
    after: params.pointsAfter,
    by: params.adminEmail,
  })

  if (!params.notifyCustomer) {
    return { ok: true, alreadyAwarded: false, notify: { attempted: false, ok: false } }
  }

  const notification = await notifyPointsUpdated({
    orderNumber: review.orderNumber,
    customerName: review.order.customerName,
    customerEmail: review.order.customerEmail,
    customerPhone: review.user?.phone ?? review.order.customerPhone,
    pointsBefore: params.pointsBefore,
    pointsAfter: params.pointsAfter,
  })

  await prisma.review.update({
    where: { id: params.reviewId },
    data: {
      notifiedAt: notification.ok ? new Date() : null,
      notifyResult: {
        ...notification,
        at: new Date().toISOString(),
      } as Prisma.InputJsonValue,
    },
  })

  return {
    ok: true,
    alreadyAwarded: false,
    notify: {
      attempted: true,
      ok: notification.ok,
      skipped: notification.skipped,
      reason: notification.reason,
      error: notification.error,
    },
  }
}

/** Publishes or unpublishes a single product review. */
export async function setProductReviewPublished(params: {
  productReviewId: string
  isPublished: boolean
}): Promise<boolean> {
  const updated = await prisma.productReview.updateMany({
    where: { id: params.productReviewId },
    data: { isPublished: params.isPublished },
  })
  return updated.count === 1
}
