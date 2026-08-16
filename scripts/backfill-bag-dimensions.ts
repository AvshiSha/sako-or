/**
 * One-time backfill: parse the free-text Height / Width / Depth fields into the
 * structured heightCm / widthCm / depthCm numbers.
 *
 * Only sets a value when the legacy string is an unambiguous number with an
 * optional unit — "25", "25cm", "25 cm", "25 ס״מ", "25.5cm". Anything with a
 * range ("20-25"), two numbers, or words beyond a unit is left unset, and the
 * admin form's PreviousValueHint surfaces the old text for manual entry.
 * Legacy _en/_he fields are never modified or deleted.
 *
 * It does NOT correct implausible values. Real catalogue data contains bags
 * recorded as height 18 / depth 25 / width 13 — a 25cm-deep compact handbag,
 * i.e. width and depth transposed. Swapping them automatically would be a
 * guess, and a wrong guess here propagates into capacity, size category and
 * "fits A4" for that bag. Instead every suspicious product is printed in a
 * review list at the end for a human to check against the actual product.
 *
 * No enum field (bagType, intendedUse, …) is ever auto-populated — those are
 * human entry by design.
 *
 * Uses firebase-admin (service account) rather than the client SDK used
 * elsewhere in the app, because Firestore security rules gate writes to
 * /products on isAdmin(). Same pattern as backfill-product-attribute-enums.ts.
 *
 * Writes only to Firestore (the source of truth); run
 * `POST /api/admin/products/sync` afterward to propagate into Postgres and to
 * compute the derived columns.
 *
 * Run (preview only, no writes): npx tsx scripts/backfill-bag-dimensions.ts --dry-run
 * Run (writes to Firestore):     npx tsx scripts/backfill-bag-dimensions.ts
 */

import 'dotenv/config'
import * as admin from 'firebase-admin'
import { findDimensionAnomalies, parseCmValue } from '../lib/bag-derived'

// Initialize Firebase Admin directly (bypass 'server-only' import in lib/firebase-admin.ts)
if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (clientEmail && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    })
  } else {
    admin.initializeApp({ credential: admin.credential.applicationDefault() })
  }
}

const adminDb = admin.firestore()
const isDryRun = process.argv.includes('--dry-run')

interface DimensionPlan {
  key: 'heightCm' | 'widthCm' | 'depthCm'
  legacyEnKey: string
  legacyHeKey: string
}

const DIMENSION_PLANS: DimensionPlan[] = [
  { key: 'heightCm', legacyEnKey: 'height_en', legacyHeKey: 'height_he' },
  { key: 'widthCm', legacyEnKey: 'width_en', legacyHeKey: 'width_he' },
  { key: 'depthCm', legacyEnKey: 'depth_en', legacyHeKey: 'depth_he' },
]

interface ReviewItem {
  sku: string
  title: string
  dimensions: string
  anomalies: string[]
}

interface UnparsedItem {
  sku: string
  field: string
  text: string
}

async function backfillBagDimensions() {
  console.log(
    `🔄 Starting bag dimension backfill${isDryRun ? ' (DRY RUN — no writes)' : ''}...\n`
  )

  const snapshot = await adminDb.collection('products').get()
  console.log(`Found ${snapshot.size} products to process\n`)

  let updated = 0
  let skipped = 0
  const parsedCount: Record<string, number> = { heightCm: 0, widthCm: 0, depthCm: 0 }
  const unparsed: UnparsedItem[] = []
  const review: ReviewItem[] = []
  const errors: string[] = []

  for (const doc of snapshot.docs) {
    const product = doc.data()
    const materialCare = product.materialCare || {}
    const sku: string = product.sku || doc.id
    const title: string = product.title_he || product.title_en || sku
    const updateData: Record<string, unknown> = {}

    for (const plan of DIMENSION_PLANS) {
      // Never overwrite a measurement someone already entered by hand.
      if (typeof materialCare[plan.key] === 'number') continue

      const legacyEn: string | undefined = materialCare[plan.legacyEnKey]
      const legacyHe: string | undefined = materialCare[plan.legacyHeKey]
      if (!legacyEn && !legacyHe) continue

      const value = parseCmValue(legacyEn) ?? parseCmValue(legacyHe)
      if (value === undefined) {
        unparsed.push({ sku, field: plan.key, text: (legacyHe || legacyEn) as string })
        continue
      }

      updateData[`materialCare.${plan.key}`] = value
      parsedCount[plan.key]++
    }

    if (Object.keys(updateData).length === 0) {
      skipped++
      continue
    }

    // Check plausibility against the full picture — the values we just parsed
    // plus anything already stored — and report rather than correct.
    const resulting = {
      heightCm: (updateData['materialCare.heightCm'] as number) ?? materialCare.heightCm ?? null,
      widthCm: (updateData['materialCare.widthCm'] as number) ?? materialCare.widthCm ?? null,
      depthCm: (updateData['materialCare.depthCm'] as number) ?? materialCare.depthCm ?? null,
    }
    const anomalies = findDimensionAnomalies(resulting)
    if (anomalies.length > 0) {
      review.push({
        sku,
        title,
        dimensions: `h${resulting.heightCm ?? '?'} × w${resulting.widthCm ?? '?'} × d${resulting.depthCm ?? '?'}`,
        anomalies,
      })
    }

    if (isDryRun) {
      console.log(`  [dry-run] ${sku} — ${JSON.stringify(updateData)}`)
      updated++
      continue
    }

    try {
      await doc.ref.update(updateData)
      updated++
    } catch (error) {
      errors.push(`${sku}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  console.log('\n' + '='.repeat(70))
  console.log(`${isDryRun ? 'Would update' : 'Updated'}: ${updated} products`)
  console.log(`Unchanged:  ${skipped} products`)
  console.log(
    `Parsed:     height ${parsedCount.heightCm}, width ${parsedCount.widthCm}, depth ${parsedCount.depthCm}`
  )

  if (unparsed.length > 0) {
    console.log(`\n⚠️  ${unparsed.length} value(s) left unset — text was not an unambiguous measurement.`)
    console.log('    Enter these by hand; the old text is shown in the admin form beside each field.')
    for (const item of unparsed.slice(0, 40)) {
      console.log(`    ${item.sku}  ${item.field}  "${item.text}"`)
    }
    if (unparsed.length > 40) console.log(`    …and ${unparsed.length - 40} more`)
  }

  if (review.length > 0) {
    console.log(`\n🔍 ${review.length} product(s) need a human to check the measurements.`)
    console.log('    Nothing was auto-corrected — verify against the actual product and fix in the admin.')
    for (const item of review) {
      console.log(`\n    ${item.sku} — ${item.title}`)
      console.log(`      ${item.dimensions}`)
      for (const anomaly of item.anomalies) {
        console.log(`      • ${anomaly}`)
      }
    }
  }

  if (errors.length > 0) {
    console.log(`\n❌ ${errors.length} error(s):`)
    errors.forEach((error) => console.log(`    ${error}`))
  }

  if (!isDryRun && updated > 0) {
    console.log('\n➡️  Next: POST /api/admin/products/sync to propagate into Postgres')
    console.log('    and compute capacity / size category / fits-A4 from these dimensions.')
  }
  console.log('='.repeat(70))
}

backfillBagDimensions()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Backfill failed:', error)
    process.exit(1)
  })
