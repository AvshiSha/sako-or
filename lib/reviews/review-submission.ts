import 'server-only'
import { Prisma } from '@prisma/client'
import { prisma } from '../prisma'
import { verifyReviewToken } from '../server/review-token'
import {
  refreshRewardEligibility,
  resolveRewardEligibility,
  type RewardStatus,
} from './review-reward'

/**
 * Loading and submitting customer reviews.
 *
 * Authorization is the signed link and nothing else — there is no login step, because
 * the link is delivered to the customer by email/SMS. Every entry point therefore
 * re-verifies the token server-side; the page having rendered is never taken as
 * evidence that a submission is allowed.
 */

export const SIZING_FIT_VALUES = ['runs_small', 'true_to_size', 'runs_large'] as const
export type SizingFit = (typeof SIZING_FIT_VALUES)[number]

export interface ReviewableOrderItem {
  id: string
  productName: string
  productSku: string
  colorName: string | null
  size: string | null
  primaryImage: string | null
  quantity: number
}

/**
 * Loyalty-reward state for this order, resolved entirely server-side.
 *
 * Never derived from anything the client sends. The brief is explicit that
 * `isRegistered`, the point count and eligibility must not be trusted from the
 * frontend, and the review page has an additional reason to compute this on the
 * server: for the first couple of seconds it runs under a lightweight auth stub that
 * reports `user: null, loading: false`, which is indistinguishable from signed-out.
 */
export interface ReviewRewardInfo {
  isRegistered: boolean
  points: number
  /** Null until a review exists. */
  status: RewardStatus | null
}

export interface ReviewableOrder {
  orderId: string
  orderNumber: string
  customerName: string | null
  items: ReviewableOrderItem[]
  /** True when a review already exists — the page renders a thank-you instead. */
  alreadyReviewed: boolean
  reward: ReviewRewardInfo
}

export type LoadReviewableOrderResult =
  | { ok: true; order: ReviewableOrder }
  | { ok: false; reason: 'invalid_token' | 'not_found' }

/**
 * Loads the order behind a review link, after verifying the token authorizes it.
 *
 * The token is checked *before* the database is touched, so an invalid link cannot be
 * used to probe which order numbers exist.
 */
export async function loadReviewableOrder(params: {
  orderNumber: string
  token: string | null | undefined
}): Promise<LoadReviewableOrderResult> {
  if (!verifyReviewToken(params.orderNumber, params.token)) {
    return { ok: false, reason: 'invalid_token' }
  }

  const order = await prisma.order.findUnique({
    where: { orderNumber: params.orderNumber },
    select: {
      id: true,
      orderNumber: true,
      customerName: true,
      orderItems: {
        select: {
          id: true,
          productName: true,
          productSku: true,
          colorName: true,
          size: true,
          primaryImage: true,
          quantity: true,
        },
      },
      review: { select: { id: true, rewardStatus: true, rewardPoints: true } },
    },
  })

  if (!order) {
    return { ok: false, reason: 'not_found' }
  }

  const eligibility = await resolveRewardEligibility({ orderId: order.id })

  // A guest who reviewed and has since registered should not have to do anything to
  // become eligible — re-check on load and promote if an account now exists.
  if (order.review && order.review.rewardStatus === 'not_eligible' && eligibility.isRegistered) {
    await refreshRewardEligibility({ reviewId: order.review.id, orderId: order.id })
  }

  return {
    ok: true,
    order: {
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      items: order.orderItems,
      alreadyReviewed: order.review !== null,
      reward: {
        isRegistered: eligibility.isRegistered,
        points: order.review?.rewardPoints ?? eligibility.points,
        status: order.review
          ? eligibility.isRegistered && order.review.rewardStatus === 'not_eligible'
            ? 'pending'
            : (order.review.rewardStatus as RewardStatus)
          : null,
      },
    },
  }
}

export interface ProductReviewInput {
  orderItemId: string
  rating: number
  body?: string | null
  sizingFit?: SizingFit | null
  photoUrl?: string | null
}

export interface SubmitReviewInput {
  orderNumber: string
  token: string | null | undefined
  /** The only required rating. */
  overallRating: number
  /** Optional aspect ratings, 1-5. */
  serviceRating?: number | null
  deliveryRating?: number | null
  /** Condition the products arrived in, as opposed to the courier's handling. */
  packagingRating?: number | null
  serviceComment?: string | null
  deliveryComment?: string | null
  packagingComment?: string | null
  /** Catch-all "anything else" box. */
  generalComment?: string | null
  language: 'he' | 'en'
  products: ProductReviewInput[]
}

export type SubmitReviewResult =
  | {
      ok: true
      reviewId: string
      /** Reward outcome, so the success screen can say the right thing. Never a
       *  reason for the submission itself to fail. */
      reward: { status: RewardStatus; points: number; isRegistered: boolean }
    }
  | {
      ok: false
      reason: 'invalid_token' | 'not_found' | 'already_reviewed' | 'invalid_items'
    }

export async function submitReview(input: SubmitReviewInput): Promise<SubmitReviewResult> {
  // Re-verified here even though the page already checked: this function is reachable
  // directly from the API route, and the page's check protects nothing on its own.
  if (!verifyReviewToken(input.orderNumber, input.token)) {
    return { ok: false, reason: 'invalid_token' }
  }

  const order = await prisma.order.findUnique({
    where: { orderNumber: input.orderNumber },
    select: {
      id: true,
      userId: true,
      orderItems: { select: { id: true, productSku: true } },
    },
  })

  if (!order) {
    return { ok: false, reason: 'not_found' }
  }

  // Every submitted item must belong to THIS order. Without this a valid token for
  // one order could attach reviews to another order's items.
  const skuByItemId = new Map(order.orderItems.map((item) => [item.id, item.productSku]))
  const allItemsBelong = input.products.every((product) => skuByItemId.has(product.orderItemId))

  if (!allItemsBelong) {
    return { ok: false, reason: 'invalid_items' }
  }

  // Resolved BEFORE the insert so the reward state is written in the same statement.
  // The brief requires that a review never fails because of the reward; folding the
  // decision into the create means there is no second write that could fail after the
  // review is already durable. A lookup failure here would surface as a submission
  // error before anything is saved, which is recoverable by retrying.
  const eligibility = await resolveRewardEligibility({ orderId: order.id })

  try {
    const review = await prisma.review.create({
      data: {
        orderId: order.id,
        orderNumber: input.orderNumber,
        // Prefer the resolved account over Order.userId: guest checkouts leave that
        // null even when the reviewer does have an account.
        userId: eligibility.userId ?? order.userId,
        rewardStatus: eligibility.status,
        rewardPoints: eligibility.points,
        overallRating: input.overallRating,
        // `?? null` rather than `|| null`: these are optional 1-5 ratings, and a
        // falsy-check would be fine today but silently swallow a 0 if the scale
        // ever gained one.
        serviceRating: input.serviceRating ?? null,
        deliveryRating: input.deliveryRating ?? null,
        packagingRating: input.packagingRating ?? null,
        serviceComment: input.serviceComment?.trim() || null,
        deliveryComment: input.deliveryComment?.trim() || null,
        packagingComment: input.packagingComment?.trim() || null,
        generalComment: input.generalComment?.trim() || null,
        language: input.language,
        productReviews: {
          create: input.products.map((product) => ({
            orderItemId: product.orderItemId,
            productSku: skuByItemId.get(product.orderItemId)!,
            rating: product.rating,
            body: product.body?.trim() || null,
            sizingFit: product.sizingFit ?? null,
            photoUrl: product.photoUrl?.trim() || null,
          })),
        },
      },
      select: { id: true },
    })

    console.log('[REVIEW] Submitted', {
      orderNumber: input.orderNumber,
      overallRating: input.overallRating,
      productCount: input.products.length,
      rewardStatus: eligibility.status,
      rewardPoints: eligibility.points,
    })

    return {
      ok: true,
      reviewId: review.id,
      reward: {
        status: eligibility.status,
        points: eligibility.points,
        isRegistered: eligibility.isRegistered,
      },
    }
  } catch (error) {
    // The reviews.order_id unique constraint is what makes double submission
    // impossible — including two requests racing from a double-tapped button.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { ok: false, reason: 'already_reviewed' }
    }
    throw error
  }
}
