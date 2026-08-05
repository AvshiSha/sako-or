import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { processDueReviewRequests } from '@/lib/reviews/review-request-job'

/**
 * GET /api/cron/review-requests
 *
 * Sends post-delivery review requests whose scheduled time has arrived. Requests are
 * created by the HFD shipment webhook when a parcel is confirmed delivered, dated
 * 24h out; this job is what actually delivers them.
 *
 * Protected by CRON_SECRET. Schedule: every 30 minutes.
 *
 * Runs may overlap — the job claims each row with a conditional UPDATE, so a
 * concurrent run cannot double-send.
 */

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret) {
      console.error('[CRON_REVIEW_REQUESTS] CRON_SECRET environment variable is not set')
      return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
    }

    const authHeader = request.headers.get('authorization')
    const vercelCronSecret = request.headers.get('x-vercel-cron-secret')
    const cronSecretHeader = request.headers.get('x-cron-secret')

    const providedSecret =
      vercelCronSecret || cronSecretHeader || authHeader?.replace(/^Bearer /i, '')

    if (!providedSecret || providedSecret !== cronSecret) {
      console.warn('[CRON_REVIEW_REQUESTS] Unauthorized access attempt')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const batchSizeParam = request.nextUrl.searchParams.get('batchSize')
    const parsedBatchSize = batchSizeParam ? parseInt(batchSizeParam, 10) : NaN
    const batchSize =
      Number.isFinite(parsedBatchSize) && parsedBatchSize > 0 ? parsedBatchSize : undefined

    const summary = await Sentry.withMonitor(
      'review-requests',
      () => processDueReviewRequests({ batchSize }),
      {
        schedule: { type: 'crontab', value: '*/30 * * * *' },
        checkinMargin: 5,
        maxRuntime: 5,
        timezone: 'UTC',
      }
    )

    console.log('[CRON_REVIEW_REQUESTS] Completed', summary)

    return NextResponse.json(
      {
        success: summary.failed === 0,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        summary,
        errors: summary.errors,
      },
      // 207 signals partial failure without telling Vercel the whole run died.
      { status: summary.failed === 0 ? 200 : 207 }
    )
  } catch (error) {
    Sentry.captureException(error, { tags: { cron: 'review-requests' } })
    console.error('[CRON_REVIEW_REQUESTS] Unexpected error', error)

    return NextResponse.json(
      {
        success: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
