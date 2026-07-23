import 'dotenv/config'
import * as admin from 'firebase-admin'
import { parseSku } from '../lib/sku-parser'
import { GROUP_SKUS, GROUP_TAGS, DISABLED_GROUP_TAGS } from './bogo-groups-data'

function ensureFirebaseAdminInitialized() {
  if (admin.apps.length) return
  const projectId =
    process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  if (clientEmail && privateKey) {
    admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }) })
    return
  }
  admin.initializeApp({ credential: admin.credential.applicationDefault() })
}

ensureFirebaseAdminInitialized()
const db = admin.firestore()

const DRY_RUN = process.argv.includes('--dry-run')

async function findBySkus(skus: string[]) {
  if (skus.length === 0) return [] as FirebaseFirestore.QueryDocumentSnapshot[]
  const chunkSize = 10
  const chunks: string[][] = []
  for (let i = 0; i < skus.length; i += chunkSize) chunks.push(skus.slice(i, i + chunkSize))

  const results = await Promise.all(
    chunks.map(chunk => db.collection('products').where('sku', 'in', chunk).get())
  )
  return results.flatMap(snap => snap.docs)
}

async function findByTag(tag: string) {
  const snap = await db.collection('products').where('tags', 'array-contains', tag).get()
  return snap.docs
}

async function main() {
  if (DRY_RUN) console.log('--- DRY RUN: no writes will be made ---')

  // 1) Strip tags for disabled groups (e.g. bogo450/bogo500/bogo800) from every product that has them.
  for (const tag of DISABLED_GROUP_TAGS) {
    const docs = await findByTag(tag)
    if (docs.length === 0) continue
    if (DRY_RUN) {
      console.log(`Would remove tag "${tag}" from ${docs.length} products`)
      continue
    }
    for (const doc of docs) {
      await doc.ref.update({ tags: admin.firestore.FieldValue.arrayRemove(tag) })
    }
    console.log(`Removed tag "${tag}" from ${docs.length} products`)
  }

  // 2) Sync each active group's tag to exactly the SKUs listed in bogo-groups-data.ts
  for (const [groupName, skus] of Object.entries(GROUP_SKUS)) {
    const tag = GROUP_TAGS[groupName]
    if (!tag) {
      console.warn(`Skipping ${groupName} - no Firestore tag mapped`)
      continue
    }

    const baseSkus = Array.from(
      new Set(skus.map(sku => parseSku(sku).baseSku || sku).filter(Boolean))
    )

    const [taggedDocs, targetDocs] = await Promise.all([findByTag(tag), findBySkus(baseSkus)])

    const targetSkuSet = new Set(baseSkus)
    const targetIds = new Set(targetDocs.map(d => d.id))
    const foundTargetSkus = new Set(targetDocs.map(d => d.data().sku))
    const missingSkus = baseSkus.filter(sku => !foundTargetSkus.has(sku))
    if (missingSkus.length > 0) {
      console.log(`[${tag}] Requested ${baseSkus.length} SKUs. Missing in Firestore (${missingSkus.length}): ${missingSkus.join(', ')}`)
    }

    const toRemove = taggedDocs.filter(d => !targetIds.has(d.id))
    const toAdd = targetDocs.filter(d => !(d.data().tags ?? []).includes(tag))

    if (toRemove.length > 0) {
      if (DRY_RUN) {
        console.log(`[${tag}] Would untag ${toRemove.length} products no longer in the list`)
      } else {
        for (const doc of toRemove) {
          await doc.ref.update({ tags: admin.firestore.FieldValue.arrayRemove(tag) })
        }
        console.log(`[${tag}] Untagged ${toRemove.length} products no longer in the list`)
      }
    }

    if (toAdd.length > 0) {
      if (DRY_RUN) {
        console.log(`[${tag}] Would tag ${toAdd.length} new products`)
      } else {
        for (const doc of toAdd) {
          await doc.ref.update({ tags: admin.firestore.FieldValue.arrayUnion(tag) })
        }
        console.log(`[${tag}] Tagged ${toAdd.length} new products`)
      }
    }

    console.log(`[${tag}] Target membership: ${targetSkuSet.size} SKUs (${foundTargetSkus.size} found in Firestore)`)
  }
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
