import * as Sentry from '@sentry/nextjs'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/server/auth'
import { setReviewFeatured } from '@/lib/reviews/admin-reviews'

/**
 * PATCH /api/admin/reviews/[id]/featured
 *
 * Adds or removes one review from the About page carousel. Featuring is an
 * editorial act - it publishes a customer's words and first name on the brand
 * page - so it is admin-only and never automatic.
 */

export const dynamic = 'force-dynamic'

const bodySchema = z.object({ isFeatured: z.boolean() })

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin(request)
    if (auth instanceof NextResponse) return auth

    const { id } = await params
    const { isFeatured } = bodySchema.parse(await request.json())

    const { updated, featuredAt } = await setReviewFeatured({ reviewId: id, isFeatured })

    if (!updated) {
      return NextResponse.json({ success: false, error: 'Review not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, featuredAt })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request', details: error.flatten() },
        { status: 400 }
      )
    }

    Sentry.captureException(error, { tags: { route: 'admin-review-featured' } })
    console.error('[ADMIN_REVIEW_FEATURED_ERROR]', error)
    return NextResponse.json({ success: false, error: 'Failed to update' }, { status: 500 })
  }
}
