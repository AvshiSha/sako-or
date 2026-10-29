/**
 * Uploads the optimised New Collection grid-banner media to Firebase Storage.
 *
 *   npx tsx scripts/upload-new-collection-banners.ts --dir <folder> [--dry-run]
 *
 * A script rather than the admin screen because this is a one-off batch of
 * twelve files that were re-encoded outside the browser (faststart remux and a
 * CRF pass ffmpeg does and the editor cannot), and because the originals are
 * already in the bucket stamped `private, max-age=0` - Firebase bakes
 * cacheControl at write time, so they cannot be fixed in place and have to go
 * up as new objects.
 *
 * It uploads only. It does not touch Firestore, so nothing on the storefront
 * changes until the returned URLs are saved against the campaign's banners.
 *
 * ## Paths are content-addressed
 *
 * `<name>-<sha1:8>.<ext>`, because these are written `immutable`: a URL must
 * never serve different bytes later. Re-running with unchanged files therefore
 * resolves to the same object and is a no-op rather than a second copy, and
 * changed bytes land on a new URL that no cache has seen.
 */

import 'dotenv/config'

import { createHash } from 'node:crypto'
import { randomUUID } from 'node:crypto'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'

import * as admin from 'firebase-admin'

const BUCKET = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'sako-or.firebasestorage.app'

/** One year, immutable - matches what storageService.uploadImage now writes. */
const CACHE_CONTROL = 'public, max-age=31536000, immutable'

/** Destination prefix. Under `categories/` so banner media stays in one place. */
const PREFIX = 'categories/new-collection'

const FILES: { file: string; type: string; note: string }[] = [
  { file: 'new_vid_nov_11.mp4', type: 'video/mp4', note: 'video banner' },
  { file: 'new_vid_nov_22.mp4', type: 'video/mp4', note: 'video banner' },
  { file: 'new_vid_nov_33.mp4', type: 'video/mp4', note: 'video banner' },
  { file: 'poster_nov_11.webp', type: 'image/webp', note: 'poster (required)' },
  { file: 'poster_nov_22.webp', type: 'image/webp', note: 'poster (required)' },
  { file: 'poster_nov_33.webp', type: 'image/webp', note: 'poster (required)' },
  { file: 'nov_4_desktop.webp', type: 'image/webp', note: 'image banner src' },
  { file: 'nov_4_mobile.webp', type: 'image/webp', note: 'image banner srcMobile' },
  { file: 'nov_5_desktop.webp', type: 'image/webp', note: 'image banner src' },
  { file: 'nov_5_mobile.webp', type: 'image/webp', note: 'image banner srcMobile' },
  { file: 'existing_banner_optimized.mp4', type: 'video/mp4', note: 'optional re-encode of kept banner' },
  { file: 'existing_banner_poster.webp', type: 'image/webp', note: 'optional, kept banner poster' },
]

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i === -1 ? undefined : process.argv[i + 1]
}

function initFirebase() {
  if (admin.apps.length) return admin.app()

  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Missing FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY')
  }

  return admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    storageBucket: BUCKET,
  })
}

/** The token form every other asset in this project uses. */
function downloadUrl(objectPath: string, token: string): string {
  return (
    `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/` +
    `${encodeURIComponent(objectPath)}?alt=media&token=${token}`
  )
}

async function main() {
  const dir = arg('dir')
  const dryRun = process.argv.includes('--dry-run')

  if (!dir) {
    console.error('Usage: npx tsx scripts/upload-new-collection-banners.ts --dir <folder> [--dry-run]')
    process.exit(1)
  }

  initFirebase()
  const bucket = admin.storage().bucket()

  const results: Record<string, string> = {}
  let uploaded = 0
  let skipped = 0

  for (const entry of FILES) {
    const local = path.join(dir, entry.file)
    if (!existsSync(local)) {
      console.log(`  SKIP  ${entry.file.padEnd(32)} (not found)`)
      skipped += 1
      continue
    }

    const bytes = readFileSync(local)
    const hash = createHash('sha1').update(bytes).digest('hex').slice(0, 8)
    const ext = path.extname(entry.file)
    const base = path.basename(entry.file, ext)
    const objectPath = `${PREFIX}/${base}-${hash}${ext}`
    const file = bucket.file(objectPath)

    if (dryRun) {
      console.log(`  DRY   ${entry.file.padEnd(32)} -> ${objectPath}`)
      continue
    }

    // Reuse the existing object when the bytes already match, so the URL stays
    // stable across runs. Content-addressed paths make "exists" mean "identical".
    const [exists] = await file.exists()
    let token: string

    if (exists) {
      const [meta] = await file.getMetadata()
      token = (meta.metadata?.firebaseStorageDownloadTokens as string | undefined)?.split(',')[0] ?? ''
      if (!token) {
        token = randomUUID()
        await file.setMetadata({ metadata: { firebaseStorageDownloadTokens: token } })
      }
      console.log(`  REUSE ${entry.file.padEnd(32)} ${(bytes.length / 1024).toFixed(0)}KB`)
    } else {
      token = randomUUID()
      await file.save(bytes, {
        resumable: false,
        contentType: entry.type,
        metadata: {
          cacheControl: CACHE_CONTROL,
          metadata: { firebaseStorageDownloadTokens: token },
        },
      })
      uploaded += 1
      console.log(`  OK    ${entry.file.padEnd(32)} ${(bytes.length / 1024).toFixed(0)}KB  ${entry.note}`)
    }

    results[entry.file] = downloadUrl(objectPath, token)
  }

  if (dryRun) return

  console.log(`\nuploaded ${uploaded}, skipped ${skipped}\n`)
  console.log(JSON.stringify(results, null, 2))
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\nFAILED:', error instanceof Error ? error.message : error)
    process.exit(1)
  })
