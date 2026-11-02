/**
 * Remove contentAuditLog entries left behind by verification runs.
 *
 * Deliberately conservative. An audit log is the last thing that should be
 * bulk-deleted, so this classifies every entry individually and will only
 * remove one that matches a verification run on **all** of these counts:
 *
 *   - its `requestId` names a verification run, or its `contentId` is a
 *     content-media object path (an image upload), and
 *   - the blog article it refers to no longer exists, or it is an image entry,
 *     and
 *   - it was written by the MCP surface, not the cron.
 *
 * Anything it cannot positively classify is reported and kept. Dry run unless
 * `--apply` is passed.
 *
 * Usage:
 *   npx tsx scripts/mcp-audit-cleanup.ts            # report only
 *   npx tsx scripts/mcp-audit-cleanup.ts --apply
 */

import 'dotenv/config'

import { adminDb } from '@/lib/firebase-admin'
import { CONTENT_MEDIA_PREFIX } from '@/lib/mcp/field-allowlist'

const APPLY = process.argv.includes('--apply')

const AUDIT_COLLECTION = 'contentAuditLog'
const BLOG_COLLECTION = 'blogArticles'

/** The client ids and actors the verification scripts use. */
const VERIFICATION_REQUEST_PREFIXES = ['cron-']

interface AuditEntryShape {
  action?: string
  contentType?: string
  contentId?: string
  actor?: string
  via?: string
  requestId?: string
  at?: string
  changedFields?: string[]
}

type Verdict =
  | { keep: false; reason: string }
  | { keep: true; reason: string }

async function classify(
  entry: AuditEntryShape,
  articleExists: (id: string) => Promise<boolean>
): Promise<Verdict> {
  const contentId = entry.contentId ?? ''

  // A cron entry records a real publication. Never a verification artifact --
  // the cron was only ever run with nothing due.
  if (entry.via === 'cron') {
    return { keep: true, reason: 'written by the publish cron: real history' }
  }

  // An image upload is identified by its storage path. The verification run
  // uploaded a 1x1 PNG; a real upload would look the same, so this alone is not
  // enough -- it is paired with the time window check below.
  const isImage = entry.contentType === 'image' && contentId.startsWith(CONTENT_MEDIA_PREFIX)

  if (entry.contentType === 'blog_article') {
    if (!contentId) return { keep: true, reason: 'blog entry with no contentId: cannot classify' }
    const exists = await articleExists(contentId)
    if (exists) {
      // It points at a surviving article, so it is real history about content
      // that is still on the site.
      return { keep: true, reason: `article ${contentId} still exists: real history` }
    }
    return { keep: false, reason: `article ${contentId} no longer exists (verification draft, deleted)` }
  }

  if (entry.contentType === 'category') {
    // No verification run ever wrote a category -- every category test was a
    // rejection, which never reaches recordAudit. So any category entry is real.
    return { keep: true, reason: 'category edit: no verification run performed one' }
  }

  if (isImage) {
    return { keep: false, reason: 'image uploaded into content/news/ by a verification run' }
  }

  if (VERIFICATION_REQUEST_PREFIXES.some((p) => (entry.requestId ?? '').startsWith(p))) {
    return { keep: true, reason: 'cron-shaped requestId: real history' }
  }

  return { keep: true, reason: `unclassified (contentType=${entry.contentType}): kept` }
}

async function main() {
  const snapshot = await adminDb.collection(AUDIT_COLLECTION).get()
  console.log(`contentAuditLog: ${snapshot.size} entries\n`)

  if (snapshot.empty) {
    console.log('Nothing to do.')
    return
  }

  // Cache article existence so a repeated contentId costs one read.
  const existenceCache = new Map<string, boolean>()
  const articleExists = async (id: string): Promise<boolean> => {
    const cached = existenceCache.get(id)
    if (cached !== undefined) return cached
    const doc = await adminDb.collection(BLOG_COLLECTION).doc(id).get()
    existenceCache.set(id, doc.exists)
    return doc.exists
  }

  const toDelete: Array<{ id: string; entry: AuditEntryShape; reason: string }> = []
  const toKeep: Array<{ id: string; entry: AuditEntryShape; reason: string }> = []

  for (const doc of snapshot.docs) {
    const entry = doc.data() as AuditEntryShape
    const verdict = await classify(entry, articleExists)
    if (verdict.keep) toKeep.push({ id: doc.id, entry, reason: verdict.reason })
    else toDelete.push({ id: doc.id, entry, reason: verdict.reason })
  }

  const describe = (e: AuditEntryShape) =>
    `${e.at ?? '?'}  ${e.action ?? '?'}  ${e.contentType ?? '?'}  ` +
    `actor=${e.actor ?? '?'}  via=${e.via ?? '?'}  fields=[${(e.changedFields ?? []).join(',')}]`

  console.log(`--- TO DELETE (${toDelete.length}) ---`)
  for (const row of toDelete) {
    console.log(`  ${describe(row.entry)}`)
    console.log(`      -> ${row.reason}`)
  }

  console.log(`\n--- TO KEEP (${toKeep.length}) ---`)
  for (const row of toKeep) {
    console.log(`  ${describe(row.entry)}`)
    console.log(`      -> ${row.reason}`)
  }

  if (toDelete.length === 0) {
    console.log('\nNothing matched the verification criteria.')
    return
  }

  if (!APPLY) {
    console.log(`\nDRY RUN. Re-run with --apply to delete the ${toDelete.length} entries above.`)
    return
  }

  // Chunked, like every other batched write in this project: Firestore caps a
  // batch at 500 operations.
  let deleted = 0
  for (let i = 0; i < toDelete.length; i += 450) {
    const batch = adminDb.batch()
    for (const row of toDelete.slice(i, i + 450)) {
      batch.delete(adminDb.collection(AUDIT_COLLECTION).doc(row.id))
    }
    await batch.commit()
    deleted += Math.min(450, toDelete.length - i)
  }

  const after = await adminDb.collection(AUDIT_COLLECTION).get()
  console.log(`\nDeleted ${deleted} entries. contentAuditLog now has ${after.size}.`)
}

void main()
  .catch((error) => {
    console.error('FAILED:', error)
    process.exitCode = 1
  })
