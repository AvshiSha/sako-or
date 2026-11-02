import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import * as Sentry from '@sentry/nextjs'

import { recordAudit } from '@/lib/mcp/audit'
import { articleRevalidationPaths } from '@/lib/mcp/urls'
import { verifyCronRequest } from '@/lib/server/cron-auth'
import {
  findDueScheduledArticlesAdmin,
  publishScheduledArticleAdmin,
} from '@/lib/server/blog-mutations'
import { publishDueArticles, type PublishJobDeps } from '@/lib/blog-publish-job'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/publish-scheduled-articles
 *
 * Flips articles with status 'scheduled' and a due publishedAt to 'published'.
 * This is the only code path in the application that publishes a blog article
 * without a human clicking Publish, which is why it is a cron route protected
 * by CRON_SECRET rather than anything the MCP endpoint can reach: the SEO
 * integration can queue an article, and only this job puts it live.
 *
 * Schedule: every 15 minutes. That sets the granularity -- an article scheduled
 * for 09:00 goes live between 09:00 and 09:15. For an editorial calendar that
 * is indistinguishable from on-time, and a tighter schedule would mean 96 more
 * invocations a day to shave off minutes nobody is watching.
 *
 * Overlapping runs are safe: publishScheduledArticleAdmin re-checks the status
 * inside a transaction, so a second run finds the article already published and
 * skips it rather than double-counting or re-stamping its date.
 */

/**
 * Bind the injected job to the real Admin SDK calls.
 *
 * The decision logic lives in lib/blog-publish-job.ts so it can be unit tested
 * without publishing anything; this is the only place the two halves meet.
 */
function jobDeps(now: Date): PublishJobDeps {
  return {
    findDue: (at, limit) =>
      findDueScheduledArticlesAdmin(at, limit).then((articles) =>
        articles.map((a) => ({
          id: a.id,
          slug: a.slug,
          status: String(a.status),
          publishedAt: String(a.publishedAt),
        }))
      ),
    publish: (id) => publishScheduledArticleAdmin(id),
    audit: (article) =>
      recordAudit({
        action: 'cron_publish',
        contentType: 'blog_article',
        contentId: article.id,
        actor: 'system',
        changedFields: ['status'],
        via: 'cron',
        requestId: `cron-${now.toISOString()}`,
        statusFrom: 'scheduled',
        statusTo: 'published',
      }),
  }
}

/**
 * Flush the caches a new article affects.
 *
 * The news routes are `force-dynamic` today, so this is mostly a no-op for them
 * -- a published article is visible on the next request either way. It is done
 * anyway because the sitemap is not dynamic, and because the day somebody adds
 * ISR to /news (every other CMS page already has it) a publish would otherwise
 * sit invisible until the window expired, which is a very hard bug to find.
 *
 * Non-throwing: the article is already published by this point, and a failed
 * cache flush must not turn a successful publish into a 500 that Vercel retries.
 */
function revalidatePublishedArticles(slugs: string[]): void {
  const paths = new Set<string>(['/sitemap.xml'])
  for (const slug of slugs) {
    for (const path of articleRevalidationPaths(slug)) paths.add(path)
  }

  for (const path of paths) {
    try {
      revalidatePath(path)
    } catch (error) {
      console.error('[CRON_PUBLISH_ARTICLES] Failed to revalidate', path, error)
    }
  }
}

export async function GET(request: Request) {
  const startedAt = Date.now()

  const auth = verifyCronRequest(request)
  if (!auth.ok) {
    if (auth.reason === 'not_configured') {
      console.error('[CRON_PUBLISH_ARTICLES] CRON_SECRET is not set')
      return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
    }
    console.warn('[CRON_PUBLISH_ARTICLES] Unauthorized access attempt')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now = new Date()

    const summary = await Sentry.withMonitor(
      'publish-scheduled-articles',
      () => publishDueArticles(now, jobDeps(now)),
      {
        schedule: { type: 'crontab', value: '*/15 * * * *' },
        checkinMargin: 5,
        maxRuntime: 2,
        timezone: 'UTC',
      }
    )

    if (summary.published > 0) {
      revalidatePublishedArticles(summary.slugs)
    }

    console.log(
      '[CRON_PUBLISH_ARTICLES] Completed',
      JSON.stringify({ ...summary, durationMs: Date.now() - startedAt })
    )

    return NextResponse.json(
      { ok: true, ...summary, durationMs: Date.now() - startedAt },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    Sentry.captureException(error, { tags: { route: 'cron_publish_articles' } })
    console.error('[CRON_PUBLISH_ARTICLES] Failed:', error)
    return NextResponse.json({ error: 'Publish job failed' }, { status: 500 })
  }
}
