import 'server-only'
import { Prisma } from '@prisma/client'
import { prisma } from '../prisma'
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
  overallRating: number
  serviceRating: number | null
  deliveryRating: number | null
  packagingRating: number | null
  serviceComment: string | null
  deliveryComment: string | null
  packagingComment: string | null
  pointsAwardedAt: string | null
  pointsBefore: string | null
  pointsAfter: string | null
  pointsAwardedBy: string | null
  notifiedAt: string | null
  notifyResult: unknown
  products: AdminReviewProduct[]
}

export interface AdminReviewsPage {
  reviews: AdminReview[]
  total: number
  counts: { all: number; awaitingPoints: number; awarded: number; unpublished: number }
}

function whereFor(filter: ReviewFilter): Prisma.ReviewWhereInput {
  switch (filter) {
    case 'awaiting_points':
      return { pointsAwardedAt: null }
    case 'awarded':
      return { pointsAwardedAt: { not: null } }
    case 'unpublished':
      return { productReviews: { some: { isPublished: false } } }
    default:
      return {}
  }
}

export async function listReviews(params: {
  filter?: ReviewFilter
  page?: number
  limit?: number
}): Promise<AdminReviewsPage> {
  const filter = params.filter ?? 'all'
  const page = Math.max(params.page ?? 1, 1)
  const limit = Math.min(Math.max(params.limit ?? 25, 1), 100)

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

  return {
    total,
    counts: { all, awaitingPoints, awarded, unpublished },
    reviews: rows.map((review) => ({
      id: review.id,
      orderNumber: review.orderNumber,
      submittedAt: review.submittedAt.toISOString(),
      language: review.language,
      customerName: review.order.customerName,
      customerEmail: review.order.customerEmail,
      customerPhone: review.user?.phone ?? review.order.customerPhone,
      currentPointsBalance: review.user?.pointsBalance?.toString() ?? null,
      // A Verifone customer number is our proxy for club membership; guests have none.
      isClubMember: Boolean(review.user?.verifoneCustomerNo),
      overallRating: review.overallRating,
      serviceRating: review.serviceRating,
      deliveryRating: review.deliveryRating,
      packagingRating: review.packagingRating,
      serviceComment: review.serviceComment,
      deliveryComment: review.deliveryComment,
      packagingComment: review.packagingComment,
      pointsAwardedAt: review.pointsAwardedAt?.toISOString() ?? null,
      pointsBefore: review.pointsBefore?.toString() ?? null,
      pointsAfter: review.pointsAfter?.toString() ?? null,
      pointsAwardedBy: review.pointsAwardedBy,
      notifiedAt: review.notifiedAt?.toISOString() ?? null,
      notifyResult: review.notifyResult,
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
    })),
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
