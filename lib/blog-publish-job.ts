import { isDueForPublication } from '@/lib/blog-schedule'

/**
 * The scheduled-publication job, with its data access injected.
 *
 * Separated from the cron route for one reason: this is the only code in the
 * application that puts a blog article live without a human clicking Publish,
 * and the only honest way to test it is to run it. Testing it against the real
 * database would mean publishing test content to the storefront, which is
 * exactly what nobody wants; with the two Firestore calls injected, every branch
 * -- due, not due, already published, concurrent run, partial failure -- is
 * covered without a single real article changing state.
 *
 * Mirrors the shape of lib/reviews/review-request-job.ts, which the
 * review-requests cron uses for the same reason.
 */

export interface SchedulableArticle {
  id: string
  slug: string
  status: string
  publishedAt: string
}

export interface PublishJobDeps {
  /** Articles with status 'scheduled' and publishedAt <= now, oldest first. */
  findDue: (now: Date, limit: number) => Promise<SchedulableArticle[]>
  /** Flip one to published. Returns ok:false with a reason if it no longer qualifies. */
  publish: (id: string) => Promise<{ ok: boolean; skipped?: string }>
  /** Append an audit entry. Must not throw. */
  audit: (article: SchedulableArticle) => Promise<void>
}

export interface PublishSummary {
  due: number
  published: number
  skipped: Array<{ id: string; reason: string }>
  slugs: string[]
}

export const PUBLISH_BATCH_LIMIT = 25

export async function publishDueArticles(
  now: Date,
  deps: PublishJobDeps,
  limit: number = PUBLISH_BATCH_LIMIT
): Promise<PublishSummary> {
  const due = await deps.findDue(now, limit)
  const summary: PublishSummary = { due: due.length, published: 0, skipped: [], slugs: [] }

  for (const article of due) {
    // Re-checked here as well as in the query. The query is the fast path, but
    // a document with a malformed publishedAt would satisfy a Firestore string
    // comparison while meaning nothing as a date, and publishing on the
    // strength of that would be worse than skipping it.
    if (!isDueForPublication(article.publishedAt, now)) {
      summary.skipped.push({ id: article.id, reason: 'not_actually_due' })
      continue
    }
    if (article.status !== 'scheduled') {
      summary.skipped.push({ id: article.id, reason: `status_is_${article.status}` })
      continue
    }

    const result = await deps.publish(article.id)
    if (!result.ok) {
      summary.skipped.push({ id: article.id, reason: result.skipped ?? 'unknown' })
      continue
    }

    summary.published += 1
    summary.slugs.push(article.slug)

    // After the publish, never before: an audit entry for something that then
    // failed to publish is a lie, and the entry failing must not undo a
    // publication that already happened.
    await deps.audit(article)
  }

  return summary
}
