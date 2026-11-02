import 'server-only'

import { adminDb } from '@/lib/firebase-admin'
import type { McpContentType } from '@/lib/mcp/field-allowlist'

/**
 * Who changed what, when, and through which surface.
 *
 * The repo had no content audit trail at all before this: `updatedAt` was the
 * only signal a blog article had changed, there was no `updatedBy`, and
 * recovering a previous body meant a Firestore point-in-time restore. That was
 * tolerable while the only writer was an admin sitting in front of the editor.
 * It is not tolerable once an automated client is writing articles, so both
 * halves are added here -- an append-only log of every mutation, and a snapshot
 * of the document as it was before each one.
 *
 * Both write through the Admin SDK and are denied to every browser in
 * firestore.rules, including admins: a revision can hold the body of an
 * unpublished draft.
 */

const AUDIT_COLLECTION = 'contentAuditLog'
const REVISIONS_SUBCOLLECTION = 'revisions'
const BLOG_COLLECTION = 'blogArticles'

/** How many revisions to keep per article. */
const REVISION_RETENTION = 25

export type McpAuditAction =
  | 'create_blog_draft'
  | 'update_blog_content'
  | 'update_category_seo'
  | 'upload_article_image'
  | 'schedule_blog_post'
  | 'unschedule_blog_post'
  | 'cron_publish'

export interface AuditEntry {
  action: McpAuditAction
  contentType: McpContentType | 'image'
  contentId: string
  /** Email of the acting user, or 'system' for the cron. */
  actor: string
  /** Which field names changed. Names only — values live in the revision snapshot. */
  changedFields: string[]
  via: 'mcp' | 'cron'
  requestId: string
  at: string
  /** Status transition, when the action caused one. */
  statusFrom?: string
  statusTo?: string
}

/**
 * Append one audit entry.
 *
 * Never throws. An audit write that fails must not roll back content the caller
 * has already been told was saved, and must not turn a successful publish into
 * an error -- but it must be loud, because a silent gap in an audit trail is
 * worse than no audit trail at all.
 */
export async function recordAudit(entry: Omit<AuditEntry, 'at'>): Promise<void> {
  try {
    await adminDb.collection(AUDIT_COLLECTION).add({ ...entry, at: new Date().toISOString() })
  } catch (error) {
    console.error('[MCP_AUDIT] Failed to append audit entry:', {
      action: entry.action,
      contentId: entry.contentId,
      requestId: entry.requestId,
      error,
    })
  }
}

/**
 * Snapshot a blog article as it is now, before it is overwritten.
 *
 * Stores the whole document rather than a diff. A diff is smaller but needs
 * every prior revision intact to reconstruct anything, and the point of this is
 * to recover a body somebody lost -- at a couple of articles a day, whole
 * copies are the cheaper trade.
 *
 * Also non-throwing, for the same reason as recordAudit, and with the same
 * noise on failure.
 */
export async function snapshotArticleRevision(
  articleId: string,
  document: Record<string, unknown>,
  context: { actor: string; requestId: string; via: 'mcp' | 'admin' | 'cron' }
): Promise<void> {
  try {
    await adminDb
      .collection(BLOG_COLLECTION)
      .doc(articleId)
      .collection(REVISIONS_SUBCOLLECTION)
      .add({
        ...document,
        _revisionAt: new Date().toISOString(),
        _revisionActor: context.actor,
        _revisionVia: context.via,
        _revisionRequestId: context.requestId,
      })
    await pruneRevisions(articleId)
  } catch (error) {
    console.error('[MCP_AUDIT] Failed to snapshot revision:', { articleId, error })
  }
}

/**
 * Keep the newest REVISION_RETENTION revisions.
 *
 * Unbounded history on a collection nothing ever reads is a slow storage leak;
 * 25 covers every realistic "undo what we did this week" without turning the
 * subcollection into an archive.
 */
async function pruneRevisions(articleId: string): Promise<void> {
  const snapshot = await adminDb
    .collection(BLOG_COLLECTION)
    .doc(articleId)
    .collection(REVISIONS_SUBCOLLECTION)
    .orderBy('_revisionAt', 'desc')
    .offset(REVISION_RETENTION)
    .get()

  if (snapshot.empty) return

  const batch = adminDb.batch()
  for (const doc of snapshot.docs) batch.delete(doc.ref)
  await batch.commit()
}

/** Re-exported so callers have one audit import. Defined in audit-diff.ts, which is testable. */
export { changedFieldNames } from '@/lib/mcp/audit-diff'
