import * as Sentry from '@sentry/nextjs'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/server/auth'
import { listReviews, type ReviewFilter } from '@/lib/reviews/admin-reviews'

/**
 * GET /api/admin/reviews
 *
 * Lists submitted customer reviews for the admin console, with the counts that
 * drive the filter tabs — most importantly "awaiting points", the queue of
 * reviewers who have not yet been credited by hand.
 */

export const dynamic = 'force-dynamic'

const FILTERS: ReviewFilter[] = [
  'all',
  'not_credited',
  'awaiting_points',
  'not_registered',
  'awarded',
  'unpublished',
]

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request)
    if (auth instanceof NextResponse) return auth

    const { searchParams } = new URL(request.url)
    const rawFilter = searchParams.get('filter') ?? 'all'
    const filter = FILTERS.includes(rawFilter as ReviewFilter)
      ? (rawFilter as ReviewFilter)
      : 'all'

    const page = Math.max(parseInt(searchParams.get('page') ?? '1', 10) || 1, 1)
    const limit = Math.min(
      Math.max(parseInt(searchParams.get('limit') ?? '25', 10) || 25, 1),
      100
    )

    const result = await listReviews({ filter, page, limit })

    return NextResponse.json({ success: true, ...result, page, limit, filter })
  } catch (error) {
    Sentry.captureException(error, { tags: { route: 'admin-reviews' } })
    console.error('[ADMIN_REVIEWS_ERROR]', error)
    return NextResponse.json(
      { success: false, error: 'Failed to load reviews' },
      { status: 500 }
    )
  }
}
