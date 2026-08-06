import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { z } from 'zod'
import { submitReview, SIZING_FIT_VALUES } from '@/lib/reviews/review-submission'

/**
 * POST /api/reviews
 *
 * Submits a customer review for a delivered order. Authorization is the signed token
 * from the review link — re-verified inside `submitReview`, never trusted from the
 * page that rendered the form.
 */

export const dynamic = 'force-dynamic'

/** 1-5 star rating that the customer may leave unanswered. */
const optionalRating = z.number().int().min(1).max(5).nullable().optional()

const productReviewSchema = z.object({
  orderItemId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  body: z.string().trim().max(4000).nullable().optional(),
  sizingFit: z.enum(SIZING_FIT_VALUES).nullable().optional(),
  photoUrl: z.string().url().max(2048).nullable().optional(),
})

const requestSchema = z.object({
  orderNumber: z.string().min(1),
  token: z.string().min(1),
  overallRating: z.number().int().min(1).max(5),
  serviceRating: optionalRating,
  deliveryRating: optionalRating,
  packagingRating: optionalRating,
  serviceComment: z.string().trim().max(4000).nullable().optional(),
  deliveryComment: z.string().trim().max(4000).nullable().optional(),
  packagingComment: z.string().trim().max(4000).nullable().optional(),
  language: z.enum(['he', 'en']).default('he'),
  products: z.array(productReviewSchema).min(1).max(50),
})

/** Bilingual error envelope, matching `app/api/coupons/apply/route.ts`. */
const MESSAGES = {
  INVALID_REQUEST: {
    en: 'Some details are missing or invalid.',
    he: 'חלק מהפרטים חסרים או שגויים.',
  },
  INVALID_TOKEN: {
    en: 'This review link is invalid or has expired.',
    he: 'קישור הביקורת אינו תקין או שפג תוקפו.',
  },
  NOT_FOUND: {
    en: 'We could not find that order.',
    he: 'לא הצלחנו למצוא את ההזמנה.',
  },
  ALREADY_REVIEWED: {
    en: 'A review has already been submitted for this order. Thank you!',
    he: 'כבר נשלחה ביקורת עבור הזמנה זו. תודה!',
  },
  INVALID_ITEMS: {
    en: 'Some products do not belong to this order.',
    he: 'חלק מהמוצרים אינם שייכים להזמנה זו.',
  },
  UNKNOWN_ERROR: {
    en: 'We could not save your review right now. Please try again.',
    he: 'לא הצלחנו לשמור את הביקורת כרגע. אנא נסי שוב.',
  },
} as const

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const payload = requestSchema.parse(body)

    const result = await submitReview(payload)

    if (result.ok) {
      return NextResponse.json({ success: true, reviewId: result.reviewId }, { status: 201 })
    }

    // 200 for already_reviewed: from the customer's point of view the goal is met,
    // and the UI shows the thank-you state rather than an error.
    const responses = {
      invalid_token: { code: 'INVALID_TOKEN', status: 401 },
      not_found: { code: 'NOT_FOUND', status: 404 },
      already_reviewed: { code: 'ALREADY_REVIEWED', status: 200 },
      invalid_items: { code: 'INVALID_ITEMS', status: 400 },
    } as const

    const { code, status } = responses[result.reason]

    return NextResponse.json(
      {
        success: false,
        code,
        alreadyReviewed: result.reason === 'already_reviewed',
        messages: MESSAGES[code],
      },
      { status }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          code: 'INVALID_REQUEST',
          messages: MESSAGES.INVALID_REQUEST,
          details: error.flatten(),
        },
        { status: 400 }
      )
    }

    Sentry.captureException(error, { tags: { route: 'reviews' } })
    console.error('[REVIEW_SUBMIT_ERROR]', error)

    return NextResponse.json(
      { success: false, code: 'UNKNOWN_ERROR', messages: MESSAGES.UNKNOWN_ERROR },
      { status: 500 }
    )
  }
}
