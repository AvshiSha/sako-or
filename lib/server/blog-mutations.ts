import 'server-only'

import { adminDb } from '@/lib/firebase-admin'
import type { BlogArticle, BlogArticleStatus } from '@/lib/firebase'

/**
 * Server-side blog writes, using the Admin SDK.
 *
 * `blogService` in lib/firebase.ts writes from the browser with the client SDK,
 * which is why blog HTML is only sanitized when it is rendered -- sanitize-html
 * is Node-only. The FAQ stack moved its writes server-side for exactly this
 * reason (see lib/server/faq-mutations.ts), and MCP writes take the same route:
 * input is sanitized before it is stored, so raw model-generated HTML never
 * lands in Firestore for some other reader to find.
 *
 * Authorization is enforced by the MCP tool layer above this. These functions
 * assume the caller is already authorized, in the same way faq-mutations
 * assumes requireAdmin ran in the route handler.
 */

const BLOG_COLLECTION = 'blogArticles'

export interface BlogArticleRecord extends Omit<BlogArticle, 'id'> {
  id: string
}

export async function getArticleAdmin(id: string): Promise<BlogArticleRecord | null> {
  const snap = await adminDb.collection(BLOG_COLLECTION).doc(id).get()
  if (!snap.exists) return null
  return { id: snap.id, ...snap.data() } as BlogArticleRecord
}

/** The raw stored document, for revision snapshots. */
export async function getArticleRawAdmin(id: string): Promise<Record<string, unknown> | null> {
  const snap = await adminDb.collection(BLOG_COLLECTION).doc(id).get()
  if (!snap.exists) return null
  return snap.data() ?? null
}

export async function findArticleBySlugAdmin(
  slug: string,
  excludeId?: string
): Promise<BlogArticleRecord | null> {
  const snapshot = await adminDb
    .collection(BLOG_COLLECTION)
    .where('slug', '==', slug)
    .limit(2)
    .get()

  for (const doc of snapshot.docs) {
    if (excludeId && doc.id === excludeId) continue
    return { id: doc.id, ...doc.data() } as BlogArticleRecord
  }
  return null
}

/**
 * Find an article by its import reference.
 *
 * This is what makes a retried import safe. `sourceRef` is a single-field
 * equality query, which Firestore indexes automatically, so no composite index
 * is needed for it.
 */
export async function findArticleBySourceRefAdmin(
  sourceRef: string
): Promise<BlogArticleRecord | null> {
  const snapshot = await adminDb
    .collection(BLOG_COLLECTION)
    .where('sourceRef', '==', sourceRef)
    .limit(1)
    .get()

  if (snapshot.empty) return null
  const doc = snapshot.docs[0]
  return { id: doc.id, ...doc.data() } as BlogArticleRecord
}

export interface CreateArticleInput {
  slug: string
  fields: Record<string, unknown>
  sourceRef?: string
  actor: string
}

/**
 * Create a draft.
 *
 * Always `status: 'draft'`. `publishedAt` is seeded with the creation time
 * because the field is non-optional on the model and the storefront sorts by
 * it; it carries no meaning until schedule_blog_post sets it deliberately, and
 * a draft is invisible either way.
 */
export async function createArticleAdmin(input: CreateArticleInput): Promise<string> {
  const now = new Date().toISOString()

  const document: Record<string, unknown> = {
    // Defaults first, so a caller that omitted a field gets a well-formed
    // document rather than a half-populated one the storefront has to guess at.
    title: { he: '', en: '' },
    excerpt: { he: '', en: '' },
    content: { he: '', en: '' },
    featuredImage: '',
    featuredImageAlt: { he: '', en: '' },
    ...input.fields,
    slug: input.slug,
    status: 'draft' satisfies BlogArticleStatus,
    publishedAt: now,
    createdAt: now,
    updatedAt: now,
    createdBy: input.actor,
    updatedBy: input.actor,
    lastEditedVia: 'mcp',
    ...(input.sourceRef ? { sourceRef: input.sourceRef } : {}),
  }

  const ref = await adminDb.collection(BLOG_COLLECTION).add(document)
  return ref.id
}

export type UpdateOutcome =
  | { ok: true; updatedAt: string }
  | { ok: false; reason: 'not_found' }
  | { ok: false; reason: 'conflict'; currentUpdatedAt: string }

/**
 * Update allowlisted fields, refusing to overwrite a newer version.
 *
 * Runs in a transaction and re-reads `updatedAt` inside it, so the comparison
 * and the write cannot straddle somebody else's save. Without the transaction a
 * check-then-write would still lose an admin edit that landed in between, which
 * is the exact failure the conflict token exists to prevent.
 *
 * `expectedUpdatedAt` is required by the tool layer rather than optional here,
 * so there is no path that writes blind.
 */
export async function updateArticleFieldsAdmin(
  id: string,
  fields: Record<string, unknown>,
  options: { expectedUpdatedAt: string; actor: string }
): Promise<UpdateOutcome> {
  const ref = adminDb.collection(BLOG_COLLECTION).doc(id)

  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists) return { ok: false as const, reason: 'not_found' as const }

    const current = snap.data() ?? {}
    const currentUpdatedAt = String(current.updatedAt ?? '')

    if (currentUpdatedAt !== options.expectedUpdatedAt) {
      return {
        ok: false as const,
        reason: 'conflict' as const,
        currentUpdatedAt,
      }
    }

    const updatedAt = new Date().toISOString()
    tx.update(ref, {
      ...fields,
      updatedAt,
      updatedBy: options.actor,
      lastEditedVia: 'mcp',
    })
    return { ok: true as const, updatedAt }
  })
}

/**
 * Move an article between draft and scheduled.
 *
 * Deliberately cannot reach 'published': only the cron does that, through
 * publishScheduledArticle below. Keeping the transition that puts content live
 * in one function, called from one route that only Vercel Cron can invoke,
 * means "can this integration publish?" has a single auditable answer.
 */
export async function setArticleScheduleAdmin(
  id: string,
  next: { status: 'draft' | 'scheduled'; publishedAt?: string },
  options: { expectedUpdatedAt?: string; actor: string }
): Promise<UpdateOutcome & { statusFrom?: string }> {
  const ref = adminDb.collection(BLOG_COLLECTION).doc(id)

  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists) return { ok: false as const, reason: 'not_found' as const }

    const current = snap.data() ?? {}
    const currentUpdatedAt = String(current.updatedAt ?? '')
    const statusFrom = String(current.status ?? '')

    if (options.expectedUpdatedAt && currentUpdatedAt !== options.expectedUpdatedAt) {
      return { ok: false as const, reason: 'conflict' as const, currentUpdatedAt }
    }

    // An already-published article is not a scheduling target. Re-scheduling it
    // would silently unpublish a live URL, which is a content decision for a
    // human in /admin/blog, not something an import should do on a retry.
    if (statusFrom === 'published') {
      return { ok: false as const, reason: 'conflict' as const, currentUpdatedAt }
    }

    const updatedAt = new Date().toISOString()
    tx.update(ref, {
      status: next.status,
      ...(next.publishedAt ? { publishedAt: next.publishedAt } : {}),
      updatedAt,
      updatedBy: options.actor,
      lastEditedVia: 'mcp',
    })
    return { ok: true as const, updatedAt, statusFrom }
  })
}

/** Scheduled articles whose time has come, oldest first. */
export async function findDueScheduledArticlesAdmin(
  now: Date,
  limit = 25
): Promise<BlogArticleRecord[]> {
  const snapshot = await adminDb
    .collection(BLOG_COLLECTION)
    .where('status', '==', 'scheduled')
    .where('publishedAt', '<=', now.toISOString())
    .orderBy('publishedAt', 'asc')
    .limit(limit)
    .get()

  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as BlogArticleRecord)
}

/**
 * Flip one scheduled article to published.
 *
 * Re-checks the status inside the transaction so two overlapping cron
 * invocations -- or a cron racing an admin who published by hand -- cannot both
 * claim the same article. `publishedAt` is left exactly as scheduled rather than
 * being reset to the moment the cron happened to run, so the article's date is
 * the date the editor chose and not an artifact of a 15-minute tick.
 */
export async function publishScheduledArticleAdmin(
  id: string
): Promise<{ ok: boolean; skipped?: string }> {
  const ref = adminDb.collection(BLOG_COLLECTION).doc(id)

  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists) return { ok: false, skipped: 'not_found' }

    const current = snap.data() ?? {}
    if (current.status !== 'scheduled') {
      return { ok: false, skipped: `status_is_${String(current.status)}` }
    }

    tx.update(ref, {
      status: 'published',
      updatedAt: new Date().toISOString(),
      lastEditedVia: 'cron',
    })
    return { ok: true }
  })
}
