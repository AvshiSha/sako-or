import test from 'node:test'
import assert from 'node:assert/strict'

import {
  publishDueArticles,
  type PublishJobDeps,
  type SchedulableArticle,
} from '@/lib/blog-publish-job'

/**
 * The scheduled-publication job.
 *
 * Run against injected fakes, deliberately: this is the only code path that
 * puts an article live without a human, and verifying it against the real
 * database would mean publishing test content to the storefront. Every branch
 * is covered here instead, with nothing published anywhere.
 */

const NOW = new Date('2026-11-01T12:00:00.000Z')

function article(overrides: Partial<SchedulableArticle> = {}): SchedulableArticle {
  return {
    id: 'a1',
    slug: 'winter-boots',
    status: 'scheduled',
    publishedAt: '2026-11-01T11:00:00.000Z',
    ...overrides,
  }
}

function deps(
  due: SchedulableArticle[],
  publish?: (id: string) => Promise<{ ok: boolean; skipped?: string }>
): { deps: PublishJobDeps; published: string[]; audited: string[] } {
  const published: string[] = []
  const audited: string[] = []
  return {
    published,
    audited,
    deps: {
      findDue: async () => due,
      publish:
        publish ??
        (async (id) => {
          published.push(id)
          return { ok: true }
        }),
      audit: async (a) => {
        audited.push(a.id)
      },
    },
  }
}

test('a due scheduled article is published and audited', async () => {
  const d = deps([article()])
  const summary = await publishDueArticles(NOW, d.deps)

  assert.equal(summary.due, 1)
  assert.equal(summary.published, 1)
  assert.deepEqual(summary.slugs, ['winter-boots'])
  assert.deepEqual(summary.skipped, [])
  assert.deepEqual(d.published, ['a1'])
  assert.deepEqual(d.audited, ['a1'])
})

test('nothing due is a clean no-op', async () => {
  const d = deps([])
  const summary = await publishDueArticles(NOW, d.deps)

  assert.deepEqual(summary, { due: 0, published: 0, skipped: [], slugs: [] })
  assert.deepEqual(d.published, [])
})

test('an article whose time has not come is skipped, not published', async () => {
  // Belt and braces: the query should not have returned this, but a job that
  // publishes whatever it is handed is one bad query away from publishing a
  // month of drafts at once.
  const d = deps([article({ publishedAt: '2026-12-25T09:00:00.000Z' })])
  const summary = await publishDueArticles(NOW, d.deps)

  assert.equal(summary.published, 0)
  assert.deepEqual(summary.skipped, [{ id: 'a1', reason: 'not_actually_due' }])
  assert.deepEqual(d.published, [])
})

test('a malformed publishedAt is skipped rather than published', async () => {
  // A Firestore string comparison would happily return this; as a date it
  // means nothing, and publishing on that basis is worse than skipping.
  const d = deps([article({ publishedAt: 'whenever' })])
  const summary = await publishDueArticles(NOW, d.deps)

  assert.equal(summary.published, 0)
  assert.equal(summary.skipped[0].reason, 'not_actually_due')
})

test('a draft that slipped into the batch is skipped', async () => {
  const d = deps([article({ status: 'draft' })])
  const summary = await publishDueArticles(NOW, d.deps)

  assert.equal(summary.published, 0)
  assert.deepEqual(summary.skipped, [{ id: 'a1', reason: 'status_is_draft' }])
})

test('an already-published article is skipped', async () => {
  const d = deps([article({ status: 'published' })])
  const summary = await publishDueArticles(NOW, d.deps)

  assert.equal(summary.published, 0)
  assert.equal(summary.skipped[0].reason, 'status_is_published')
})

test('a concurrent run losing the race is reported, not counted', async () => {
  // Two overlapping cron invocations: the transaction in the second one finds
  // the article already published and refuses it.
  const d = deps([article()], async () => ({ ok: false, skipped: 'status_is_published' }))
  const summary = await publishDueArticles(NOW, d.deps)

  assert.equal(summary.published, 0)
  assert.deepEqual(summary.skipped, [{ id: 'a1', reason: 'status_is_published' }])
  assert.deepEqual(d.audited, [], 'nothing published means nothing to audit')
})

test('one failure does not stop the rest of the batch', async () => {
  const d = deps(
    [
      article({ id: 'a1', slug: 'first' }),
      article({ id: 'a2', slug: 'second' }),
      article({ id: 'a3', slug: 'third' }),
    ],
    async (id) => (id === 'a2' ? { ok: false, skipped: 'not_found' } : { ok: true })
  )
  const summary = await publishDueArticles(NOW, d.deps)

  assert.equal(summary.due, 3)
  assert.equal(summary.published, 2)
  assert.deepEqual(summary.slugs, ['first', 'third'])
  assert.deepEqual(summary.skipped, [{ id: 'a2', reason: 'not_found' }])
})

test('an article due exactly now is published', async () => {
  const d = deps([article({ publishedAt: NOW.toISOString() })])
  const summary = await publishDueArticles(NOW, d.deps)
  assert.equal(summary.published, 1)
})

test('the audit entry is written only after a successful publish', async () => {
  const order: string[] = []
  const summary = await publishDueArticles(NOW, {
    findDue: async () => [article()],
    publish: async (id) => {
      order.push(`publish:${id}`)
      return { ok: true }
    },
    audit: async (a) => {
      order.push(`audit:${a.id}`)
    },
  })

  assert.equal(summary.published, 1)
  assert.deepEqual(order, ['publish:a1', 'audit:a1'])
})

test('the batch limit is passed through to the query', async () => {
  let seenLimit = -1
  await publishDueArticles(
    NOW,
    {
      findDue: async (_at, limit) => {
        seenLimit = limit
        return []
      },
      publish: async () => ({ ok: true }),
      audit: async () => {},
    },
    7
  )
  assert.equal(seenLimit, 7)
})
