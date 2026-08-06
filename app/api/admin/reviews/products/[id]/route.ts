import * as Sentry from '@sentry/nextjs'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/server/auth'
import { setProductReviewPublished } from '@/lib/reviews/admin-reviews'

/**
 * PATCH /api/admin/reviews/products/[id]
 *
 * Publishes or unpublishes one product review. Reviews are held unpublished on
 * submission, so nothing a customer writes reaches the storefront until an admin
 * approves it here.
 */

export const dynamic = 'force-dynamic'

const bodySchema = z.object({ isPublished: z.boolean() })

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin(request)
    if (auth instanceof NextResponse) return auth

    const { id } = await params
    const { isPublished } = bodySchema.parse(await request.json())

    const updated = await setProductReviewPublished({ productReviewId: id, isPublished })

    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'Product review not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, isPublished })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request', details: error.flatten() },
        { status: 400 }
      )
    }

    Sentry.captureException(error, { tags: { route: 'admin-review-publish' } })
    console.error('[ADMIN_REVIEW_PUBLISH_ERROR]', error)
    return NextResponse.json({ success: false, error: 'Failed to update' }, { status: 500 })
  }
}
