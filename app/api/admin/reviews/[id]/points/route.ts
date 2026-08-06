import * as Sentry from '@sentry/nextjs'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/server/auth'
import { awardPoints } from '@/lib/reviews/admin-reviews'

/**
 * POST /api/admin/reviews/[id]/points
 *
 * Records that loyalty points were credited by hand for a review, and optionally
 * notifies the customer that their balance moved from X to Y.
 *
 * The award itself happens in Verifone, outside this system — this endpoint only
 * records that it was done, which is what makes the "awaiting points" queue and the
 * customer notification possible.
 */

export const dynamic = 'force-dynamic'

const bodySchema = z
  .object({
    pointsBefore: z.number().min(0).max(1_000_000),
    pointsAfter: z.number().min(0).max(1_000_000),
    notifyCustomer: z.boolean().default(true),
  })
  .refine((data) => data.pointsAfter >= data.pointsBefore, {
    message: 'pointsAfter must be greater than or equal to pointsBefore',
    path: ['pointsAfter'],
  })

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin(request)
    if (auth instanceof NextResponse) return auth

    const { id } = await params
    const payload = bodySchema.parse(await request.json())

    const result = await awardPoints({
      reviewId: id,
      pointsBefore: payload.pointsBefore,
      pointsAfter: payload.pointsAfter,
      // Recorded so there is an audit trail of who paid out.
      adminEmail: auth.email ?? 'unknown',
      notifyCustomer: payload.notifyCustomer,
    })

    if (!result.ok) {
      return NextResponse.json({ success: false, error: 'Review not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      alreadyAwarded: result.alreadyAwarded,
      notify: result.notify,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request', details: error.flatten() },
        { status: 400 }
      )
    }

    Sentry.captureException(error, { tags: { route: 'admin-review-points' } })
    console.error('[ADMIN_REVIEW_POINTS_ERROR]', error)
    return NextResponse.json(
      { success: false, error: 'Failed to record points' },
      { status: 500 }
    )
  }
}
