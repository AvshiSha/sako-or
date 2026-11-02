/**
 * Prove, against the live database, that the collections this integration adds
 * are unreachable from a browser.
 *
 * Uses the **client** Firebase SDK with no authentication -- exactly what a
 * visitor's browser has -- rather than the Admin SDK, which bypasses
 * firestore.rules entirely and would therefore prove nothing.
 *
 * Why this exists: the local `firestore.rules` adds explicit `allow read,
 * write: if false` blocks for the new collections, but Firestore already denies
 * every collection that has no matching rule, and rules do **not** cascade into
 * a sub-collection. So those blocks are documentation, not enforcement, and the
 * integration is safe without deploying them. That is a claim worth checking
 * rather than asserting -- especially since firestore.rules is gitignored here,
 * so nobody can diff the local file against what is actually live.
 *
 * Usage: npx tsx scripts/verify-mcp-firestore-rules.ts
 */

import 'dotenv/config'

import { initializeApp, getApps } from 'firebase/app'
import {
  collection,
  getDocs,
  getFirestore,
  limit,
  query,
  where,
} from 'firebase/firestore'

let passed = 0
let failed = 0

function pass(label: string, detail?: string) {
  passed++
  console.log(`  PASS  ${label}${detail ? ` — ${detail}` : ''}`)
}
function fail(label: string, detail: string) {
  failed++
  console.error(`  FAIL  ${label} — ${detail}`)
}

function isPermissionDenied(error: unknown): boolean {
  const code = (error as { code?: string })?.code ?? ''
  const message = (error as { message?: string })?.message ?? ''
  return code === 'permission-denied' || /permission|insufficient/i.test(message)
}

/** The read must be refused. Anything that comes back is a leak. */
async function mustBeDenied(label: string, run: () => Promise<unknown>): Promise<void> {
  try {
    const result = (await run()) as { size?: number }
    fail(
      label,
      `the read SUCCEEDED and returned ${result?.size ?? '?'} document(s) — this collection is readable from a browser`
    )
  } catch (error) {
    if (isPermissionDenied(error)) {
      pass(label, 'permission-denied')
    } else {
      fail(label, `failed for the wrong reason: ${(error as Error)?.message}`)
    }
  }
}

async function main() {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  }
  if (!config.projectId) {
    console.error('NEXT_PUBLIC_FIREBASE_PROJECT_ID is not set.')
    process.exit(1)
  }

  console.log(`Checking live Firestore rules for ${config.projectId}, unauthenticated.`)
  console.log('='.repeat(64))

  const app = getApps()[0] ?? initializeApp(config)
  const db = getFirestore(app)

  console.log('\nCollections added by the MCP integration')
  for (const name of [
    'contentAuditLog',
    'mcpOauthClients',
    'mcpOauthCodes',
    'mcpOauthAccessTokens',
    'mcpOauthRefreshTokens',
    'mcpAuthRequests',
    'mcpOtpCodes',
  ]) {
    await mustBeDenied(`${name} is unreadable`, () => getDocs(query(collection(db, name), limit(1))))
  }

  console.log('\nRevision snapshots (a sub-collection of a publicly readable parent)')
  // Rules do not cascade, so this is denied even though blogArticles itself has
  // a public read rule. Checked because that is exactly the sort of thing a
  // reader assumes is inherited.
  await mustBeDenied('blogArticles/*/revisions is unreadable (collection group)', () =>
    getDocs(query(collection(db, 'revisions'), limit(1)))
  )

  console.log('\nUnpublished articles stay private')
  await mustBeDenied('an unconstrained blogArticles query is refused', () =>
    getDocs(query(collection(db, 'blogArticles'), limit(1)))
  )
  await mustBeDenied("a status == 'draft' query is refused", () =>
    getDocs(query(collection(db, 'blogArticles'), where('status', '==', 'draft'), limit(1)))
  )
  await mustBeDenied("a status == 'scheduled' query is refused", () =>
    getDocs(query(collection(db, 'blogArticles'), where('status', '==', 'scheduled'), limit(1)))
  )

  console.log('\nPublished content still works (no regression)')
  try {
    const snapshot = await getDocs(
      query(collection(db, 'blogArticles'), where('status', '==', 'published'), limit(3))
    )
    pass('published articles are still readable', `${snapshot.size} returned`)
    for (const doc of snapshot.docs) {
      const status = doc.data().status
      if (status !== 'published') {
        fail('every returned article is published', `one had status "${status}"`)
      }
    }
  } catch (error) {
    fail('published articles are still readable', (error as Error)?.message ?? 'unknown')
  }

  try {
    const snapshot = await getDocs(query(collection(db, 'categories'), limit(3)))
    pass('categories are still readable', `${snapshot.size} returned`)
  } catch (error) {
    fail('categories are still readable', (error as Error)?.message ?? 'unknown')
  }

  console.log(`\n${'='.repeat(64)}`)
  console.log(`passed: ${passed}   failed: ${failed}`)
  process.exit(failed > 0 ? 1 : 0)
}

void main()
