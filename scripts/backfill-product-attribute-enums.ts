/**
 * One-time backfill: best-effort migration of the free-text Material & Care
 * fields (Upper Material, Lining, Insole, Sole/Outsole, Toe Shape, Heel Type,
 * Closure Type, Heel Height) into their new dropdown-backed equivalents.
 *
 * Only sets a new field when the legacy _en/_he text is an exact (trimmed,
 * case-insensitive) match against one option's Hebrew or English label — no
 * fuzzy matching. Everywhere else the new field is left unset, and the admin
 * form's PreviousValueHint surfaces the old text for manual reconciliation.
 * Legacy _en/_he fields are never modified or deleted.
 *
 * Uses firebase-admin (service account) rather than the client SDK used
 * elsewhere in the app, because Firestore security rules gate writes to
 * /products on isAdmin() — a plain script has no signed-in user, so the
 * client SDK would fail every write with permission-denied. Same pattern as
 * scripts/fix-user-email.ts.
 *
 * Writes only to Firestore (the source of truth); run
 * `POST /api/admin/products/sync` afterward to propagate into Postgres.
 *
 * Run (preview only, no writes): npx tsx scripts/backfill-product-attribute-enums.ts --dry-run
 * Run (writes to Firestore):     npx tsx scripts/backfill-product-attribute-enums.ts
 */

import 'dotenv/config'
import * as admin from 'firebase-admin'
import {
  UPPER_MATERIAL_OPTIONS,
  LINING_OPTIONS,
  INSOLE_OPTIONS,
  OUTSOLE_OPTIONS,
  TOE_SHAPE_OPTIONS,
  HEEL_TYPE_OPTIONS,
  CLOSURE_TYPE_OPTIONS,
  HEEL_HEIGHT_CM_OPTIONS,
  type EnumOption,
} from '../lib/product-enums'

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

function normalize(text: string): string {
  return text.trim().toLowerCase()
}

/** Exact (trimmed, case-insensitive) match against an option's Hebrew or English label. */
function matchOption<T extends string>(
  options: EnumOption<T>[],
  textEn: string | undefined,
  textHe: string | undefined
): T | undefined {
  const candidates = [textEn, textHe].filter((t): t is string => !!t && t.trim().length > 0).map(normalize)
  if (candidates.length === 0) return undefined

  for (const option of options) {
    const labels = [normalize(option.label_en), normalize(option.label_he)]
    if (candidates.some((candidate) => labels.includes(candidate))) {
      return option.value
    }
  }
  return undefined
}

/** Heel height is still an exact/deterministic match: extract the leading integer
 * from strings like "5cm", "5 cm", "5 ס״מ" and check it falls in 0-12. */
function matchHeelHeight(textEn: string | undefined, textHe: string | undefined): string | undefined {
  for (const text of [textEn, textHe]) {
    if (!text) continue
    const match = text.match(/(\d+)/)
    if (!match) continue
    const cm = Number(match[1])
    if (cm >= 0 && cm <= 12) return String(cm)
  }
  return undefined
}

interface FieldPlan {
  key:
    | 'upperMaterial'
    | 'lining'
    | 'insole'
    | 'outsole'
    | 'toeShape'
    | 'heelType'
    | 'closureType'
    | 'heelHeight'
  legacyEnKey: string
  legacyHeKey: string
}

const FIELD_PLANS: FieldPlan[] = [
  { key: 'upperMaterial', legacyEnKey: 'upperMaterial_en', legacyHeKey: 'upperMaterial_he' },
  { key: 'lining', legacyEnKey: 'lining_en', legacyHeKey: 'lining_he' },
  { key: 'insole', legacyEnKey: 'materialInnerSole_en', legacyHeKey: 'materialInnerSole_he' },
  { key: 'outsole', legacyEnKey: 'sole_en', legacyHeKey: 'sole_he' },
  { key: 'toeShape', legacyEnKey: 'toeShape_en', legacyHeKey: 'toeShape_he' },
  { key: 'heelType', legacyEnKey: 'heelType_en', legacyHeKey: 'heelType_he' },
  { key: 'closureType', legacyEnKey: 'closureType_en', legacyHeKey: 'closureType_he' },
  { key: 'heelHeight', legacyEnKey: 'heelHeight_en', legacyHeKey: 'heelHeight_he' },
]

async function backfillProductAttributeEnums() {
  console.log(`🔄 Starting product attribute dropdown backfill${isDryRun ? ' (DRY RUN — no writes)' : ''}...\n`)

  const snapshot = await adminDb.collection('products').get()
  console.log(`Found ${snapshot.size} products to process\n`)

  let updated = 0
  let skipped = 0
  const matched: Record<string, number> = {}
  const unmatched: Record<string, number> = {}
  const errors: string[] = []

  for (const doc of snapshot.docs) {
    const product = doc.data()
    const materialCare = product.materialCare || {}
    const updateData: Record<string, unknown> = {}

    for (const plan of FIELD_PLANS) {
      // Never overwrite a field an admin has already set via the new dropdown.
      const alreadySet =
        plan.key === 'upperMaterial'
          ? Array.isArray(materialCare.upperMaterial) && materialCare.upperMaterial.length > 0
          : !!materialCare[plan.key]
      if (alreadySet) continue

      const legacyEn: string | undefined = materialCare[plan.legacyEnKey]
      const legacyHe: string | undefined = materialCare[plan.legacyHeKey]
      if (!legacyEn && !legacyHe) continue

      let value: string | undefined
      switch (plan.key) {
        case 'upperMaterial':
          value = matchOption(UPPER_MATERIAL_OPTIONS, legacyEn, legacyHe)
          break
        case 'lining':
          value = matchOption(LINING_OPTIONS, legacyEn, legacyHe)
          break
        case 'insole':
          value = matchOption(INSOLE_OPTIONS, legacyEn, legacyHe)
          break
        case 'outsole':
          value = matchOption(OUTSOLE_OPTIONS, legacyEn, legacyHe)
          break
        case 'toeShape':
          value = matchOption(TOE_SHAPE_OPTIONS, legacyEn, legacyHe)
          break
        case 'heelType':
          value = matchOption(HEEL_TYPE_OPTIONS, legacyEn, legacyHe)
          break
        case 'closureType':
          value = matchOption(CLOSURE_TYPE_OPTIONS, legacyEn, legacyHe)
          break
        case 'heelHeight':
          value = matchOption(HEEL_HEIGHT_CM_OPTIONS, legacyEn, legacyHe) ?? matchHeelHeight(legacyEn, legacyHe)
          break
      }

      if (value) {
        updateData[`materialCare.${plan.key}`] = plan.key === 'upperMaterial' ? [value] : value
        matched[plan.key] = (matched[plan.key] || 0) + 1
      } else {
        unmatched[plan.key] = (unmatched[plan.key] || 0) + 1
      }
    }

    if (Object.keys(updateData).length === 0) {
      skipped++
      continue
    }

    if (isDryRun) {
      updated++
      continue
    }

    try {
      await doc.ref.update(updateData)
      updated++
      if (updated % 25 === 0) {
        console.log(`Updated ${updated}/${snapshot.size} products...`)
      }
    } catch (error) {
      const errorMsg = `Failed to update product ${product.sku || doc.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
      console.error(errorMsg)
      errors.push(errorMsg)
    }
  }

  console.log(`\n✅ ${isDryRun ? 'Dry run' : 'Backfill'} complete!`)
  console.log(`   ${isDryRun ? 'Would update' : 'Updated'}: ${updated} products`)
  console.log(`   Skipped (no new matches): ${skipped} products`)
  console.log(`\n   Per-field exact matches (auto-filled):`)
  for (const plan of FIELD_PLANS) {
    console.log(`     ${plan.key}: ${matched[plan.key] || 0} matched, ${unmatched[plan.key] || 0} left for manual reconciliation`)
  }
  if (errors.length > 0) {
    console.log(`\n   Errors: ${errors.length}`)
    errors.slice(0, 10).forEach((err) => console.log(`     - ${err}`))
    if (errors.length > 10) {
      console.log(`     ... and ${errors.length - 10} more errors`)
    }
  }
  if (!isDryRun) {
    console.log(`\nNext step: trigger POST /api/admin/products/sync to propagate these values into Postgres.`)
  }
}

backfillProductAttributeEnums()
  .then(() => {
    console.log('\n✅ Done!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Failed:', error)
    process.exit(1)
  })
