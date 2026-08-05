import 'server-only'
import { Prisma } from '@prisma/client'
import { prisma } from '../prisma'
import { verifyReviewToken } from '../server/review-token'

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

export interface ReviewableOrder {
  orderId: string
  orderNumber: string
  customerName: string | null
  items: ReviewableOrderItem[]
  /** True when a review already exists — the page renders a thank-you instead. */
  alreadyReviewed: boolean
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
      review: { select: { id: true } },
    },
  })

  if (!order) {
    return { ok: false, reason: 'not_found' }
  }

  return {
    ok: true,
    order: {
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      items: order.orderItems,
      alreadyReviewed: order.review !== null,
    },
  }
}

export interface ProductReviewInput {
  orderItemId: string
  rating: number
  title?: string | null
  body?: string | null
  sizingFit?: SizingFit | null
  photoUrl?: string | null
}

export interface SubmitReviewInput {
  orderNumber: string
  token: string | null | undefined
  overallRating: number
  serviceComment?: string | null
  deliveryComment?: string | null
  language: 'he' | 'en'
  products: ProductReviewInput[]
}

export type SubmitReviewResult =
  | { ok: true; reviewId: string }
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

  try {
    const review = await prisma.review.create({
      data: {
        orderId: order.id,
        orderNumber: input.orderNumber,
        userId: order.userId,
        overallRating: input.overallRating,
        serviceComment: input.serviceComment?.trim() || null,
        deliveryComment: input.deliveryComment?.trim() || null,
        language: input.language,
        productReviews: {
          create: input.products.map((product) => ({
            orderItemId: product.orderItemId,
            productSku: skuByItemId.get(product.orderItemId)!,
            rating: product.rating,
            title: product.title?.trim() || null,
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
    })

    return { ok: true, reviewId: review.id }
  } catch (error) {
    // The reviews.order_id unique constraint is what makes double submission
    // impossible — including two requests racing from a double-tapped button.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { ok: false, reason: 'already_reviewed' }
    }
    throw error
  }
}
