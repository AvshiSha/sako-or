/**
 * Prune spent and expired OAuth artifacts.
 *
 * Expiry is enforced on read, so nothing here is a security fix -- an expired
 * code or a revoked token is already inert. This is housekeeping: without a
 * Firestore TTL policy these collections only grow, and a cluttered store makes
 * it harder to read what the live state actually is when something goes wrong.
 *
 * What it removes:
 *   - authorization codes past their expiry (they are single-use anyway)
 *   - access and refresh tokens that are revoked or expired
 *   - pending authorization requests and OTP codes past their expiry
 *   - registered clients that have no surviving token AND were created by a
 *     verification script
 *
 * What it keeps, deliberately:
 *   - every live token
 *   - every client that still has a live token
 *   - every real client registration, even with no live token, because a
 *     connector already configured in ChatGPT holds that client id and
 *     deleting it forces the user to remove and re-add the connector
 *
 * Dry run unless --apply.
 */

import 'dotenv/config'

import { adminDb } from '@/lib/firebase-admin'

const APPLY = process.argv.includes('--apply')

/** Clients created by the verification scripts, which no human configured. */
const VERIFICATION_CLIENT_NAMES = new Set(['MCP verification script', 'chain check'])

interface Plan {
  collection: string
  ids: string[]
  kept: number
  note: string
}

async function pruneByPredicate(
  collection: string,
  keep: (data: Record<string, unknown>) => boolean,
  note: string
): Promise<Plan> {
  const snapshot = await adminDb.collection(collection).get()
  const ids: string[] = []
  let kept = 0
  for (const doc of snapshot.docs) {
    if (keep(doc.data())) kept++
    else ids.push(doc.id)
  }
  return { collection, ids, kept, note }
}

async function main() {
  const now = Date.now()
  const plans: Plan[] = []

  const live = (data: Record<string, unknown>): boolean =>
    data.revoked !== true &&
    !data.consumedAt &&
    typeof data.expiresAt === 'number' &&
    data.expiresAt > now

  plans.push(await pruneByPredicate('mcpOauthCodes', live, 'single-use; expired ones are inert'))
  plans.push(await pruneByPredicate('mcpOauthAccessTokens', live, 'revoked or expired'))
  plans.push(await pruneByPredicate('mcpOauthRefreshTokens', live, 'revoked, spent or expired'))
  plans.push(await pruneByPredicate('mcpAuthRequests', live, 'abandoned consent flows'))
  plans.push(await pruneByPredicate('mcpOtpCodes', live, 'expired codes'))

  // Clients need the token state, so they are worked out after the above.
  const [clients, accessTokens, refreshTokens] = await Promise.all([
    adminDb.collection('mcpOauthClients').get(),
    adminDb.collection('mcpOauthAccessTokens').get(),
    adminDb.collection('mcpOauthRefreshTokens').get(),
  ])

  const clientsWithLiveTokens = new Set<string>()
  for (const doc of [...accessTokens.docs, ...refreshTokens.docs]) {
    const data = doc.data()
    if (live(data) && typeof data.clientId === 'string') clientsWithLiveTokens.add(data.clientId)
  }

  const clientIds: string[] = []
  let clientsKept = 0
  for (const doc of clients.docs) {
    const data = doc.data()
    const name = String(data.clientName ?? '')
    const id = String(data.clientId ?? '')
    const isVerification = VERIFICATION_CLIENT_NAMES.has(name)
    const hasLiveToken = clientsWithLiveTokens.has(id)

    if (!isVerification || hasLiveToken) {
      clientsKept++
      console.log(
        `  keeping client ${id} (${name})` +
          `${hasLiveToken ? ' — has a live token' : ' — real registration, a connector may hold this id'}`
      )
      continue
    }
    clientIds.push(doc.id)
  }
  plans.push({
    collection: 'mcpOauthClients',
    ids: clientIds,
    kept: clientsKept,
    note: 'verification-script clients with no live token',
  })

  console.log('')
  let total = 0
  for (const plan of plans) {
    console.log(`${plan.collection}: delete ${plan.ids.length}, keep ${plan.kept}  (${plan.note})`)
    total += plan.ids.length
  }

  if (total === 0) {
    console.log('\nNothing to prune.')
    return
  }
  if (!APPLY) {
    console.log(`\nDRY RUN. Re-run with --apply to delete ${total} documents.`)
    return
  }

  for (const plan of plans) {
    for (let i = 0; i < plan.ids.length; i += 450) {
      const batch = adminDb.batch()
      for (const id of plan.ids.slice(i, i + 450)) {
        batch.delete(adminDb.collection(plan.collection).doc(id))
      }
      await batch.commit()
    }
  }

  console.log(`\nDeleted ${total} documents. Remaining:`)
  for (const plan of plans) {
    const after = await adminDb.collection(plan.collection).get()
    console.log(`  ${plan.collection}: ${after.size}`)
  }
}

void main().catch((error) => {
  console.error('FAILED:', error)
  process.exitCode = 1
})
