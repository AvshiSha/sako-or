/**
 * One-time content cleanup: removes the sentence
 *
 *   HE: "יש להימנע ממגע עם גשם, שמן ולחות."
 *   EN: "Avoid contact with rain, oil and moisture."
 *
 * from every product's Care Instructions. The sentence was added by mistake via
 * the Suede / Nubuck care-instruction presets (lib/product-text-presets.ts),
 * which have been corrected separately — this script cleans the products that
 * already carry it.
 *
 * Only that one sentence is touched: everything else in the field keeps its
 * original wording, punctuation and spacing. The whitespace that joined the
 * removed sentence to the preceding text is removed with it, and the result is
 * trimmed, so no double space or trailing gap is left behind. A field that
 * consisted of nothing but this sentence becomes empty (field deleted in
 * Firestore, NULL in Postgres) so the PDP hides the section instead of
 * rendering an empty paragraph.
 *
 * Idempotent: a product whose text no longer contains the sentence is skipped,
 * so a second run reports 0 updates and writes nothing.
 *
 * Writes to BOTH stores, because they are populated independently:
 *   - Firestore `products/*.materialCare.careInstructions_{he,en}` — source of
 *     truth; the admin CMS writes here (app/api/products/[id]/route.ts).
 *   - Postgres `products.careInstructions_{he,en}` — what the storefront PDP
 *     reads. Updated directly, per affected SKU, rather than by running the
 *     full Firebase → Neon sync, so no other product field is rewritten.
 *
 * Uses firebase-admin (service account) rather than the client SDK used
 * elsewhere in the app, because Firestore security rules gate writes to
 * /products on isAdmin() — a plain script has no signed-in user, so the client
 * SDK would fail every write with permission-denied. Same pattern as
 * scripts/backfill-product-attribute-enums.ts.
 *
 * Preview (default, no writes):  npx tsx scripts/remove-care-instruction-sentence.ts
 * Apply:                         npx tsx scripts/remove-care-instruction-sentence.ts --apply
 * Hebrew only / English only:    ... --lang=he   |   ... --lang=en
 * (default --lang=both)
 */

import 'dotenv/config'
import * as admin from 'firebase-admin'
import { createScriptPrisma } from './script-prisma'

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
const prisma = createScriptPrisma()

const isApply = process.argv.includes('--apply')
const langArg = process.argv.find((arg) => arg.startsWith('--lang='))?.split('=')[1] ?? 'both'
if (!['he', 'en', 'both'].includes(langArg)) {
  console.error(`Invalid --lang=${langArg}. Use he, en or both.`)
  process.exit(1)
}

const SENTENCE_HE = 'יש להימנע ממגע עם גשם, שמן ולחות.'
const SENTENCE_EN = 'Avoid contact with rain, oil and moisture.'

type Lang = 'he' | 'en'

interface Target {
  lang: Lang
  sentence: string
  /** Firestore key inside materialCare, and Postgres column name. */
  field: 'careInstructions_he' | 'careInstructions_en'
}

const ALL_TARGETS: Target[] = [
  { lang: 'he', sentence: SENTENCE_HE, field: 'careInstructions_he' },
  { lang: 'en', sentence: SENTENCE_EN, field: 'careInstructions_en' },
]

const TARGETS = ALL_TARGETS.filter((t) => langArg === 'both' || t.lang === langArg)

/**
 * Matches the sentence plus any whitespace run that precedes it, tolerating
 * whitespace variations inside the sentence (double space, NBSP, line break)
 * and a missing final period. Case-insensitive for the English variant only —
 * Hebrew has no case, and `i` would not change its behaviour.
 */
function buildSentenceRegex(sentence: string): RegExp {
  const core = sentence.trim().replace(/\.$/, '')
  const escaped = core.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')
  return new RegExp(`\\s*${escaped}\\.?`, 'gi')
}

const REGEX_BY_FIELD = new Map(TARGETS.map((t) => [t.field, buildSentenceRegex(t.sentence)]))

/**
 * Returns the cleaned text, or undefined when the value does not contain the
 * sentence (nothing to do). An empty result is returned as '' so the caller can
 * clear the field.
 */
function stripSentence(value: unknown, field: Target['field']): string | undefined {
  if (typeof value !== 'string' || value.length === 0) return undefined
  const regex = REGEX_BY_FIELD.get(field)!
  regex.lastIndex = 0
  if (!regex.test(value)) return undefined
  regex.lastIndex = 0
  return value.replace(regex, '').trim()
}

interface Change {
  sku: string
  field: Target['field']
  before: string
  after: string
}

async function cleanFirestore(): Promise<{ changes: Change[]; updatedDocs: number; errors: string[] }> {
  const snapshot = await adminDb.collection('products').get()
  console.log(`Firestore: scanning ${snapshot.size} products...`)

  const changes: Change[] = []
  const errors: string[] = []
  let updatedDocs = 0

  for (const doc of snapshot.docs) {
    const product = doc.data()
    const materialCare = product.materialCare || {}
    const updateData: Record<string, unknown> = {}
    const docChanges: Change[] = []

    for (const target of TARGETS) {
      const before = materialCare[target.field]
      const after = stripSentence(before, target.field)
      if (after === undefined) continue

      // Empty result means the sentence was the entire value — drop the field
      // rather than leaving an empty string behind.
      updateData[`materialCare.${target.field}`] =
        after === '' ? admin.firestore.FieldValue.delete() : after
      docChanges.push({ sku: product.sku || doc.id, field: target.field, before, after })
    }

    if (docChanges.length === 0) continue
    changes.push(...docChanges)

    if (!isApply) {
      updatedDocs++
      continue
    }

    try {
      await doc.ref.update(updateData)
      updatedDocs++
      if (updatedDocs % 25 === 0) console.log(`  Firestore: updated ${updatedDocs} products...`)
    } catch (error) {
      errors.push(
        `Firestore ${product.sku || doc.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  return { changes, updatedDocs, errors }
}

async function cleanPostgres(): Promise<{ changes: Change[]; updatedRows: number; errors: string[] }> {
  // No isActive / isEnabled / isDeleted filter: the cleanup applies to every
  // product regardless of status, as specified.
  const rows = await prisma.product.findMany({
    where: {
      OR: TARGETS.map((t) => ({ [t.field]: { contains: t.sentence.replace(/\.$/, '') } })),
    },
    select: { id: true, sku: true, careInstructions_he: true, careInstructions_en: true },
  })
  console.log(`Postgres: ${rows.length} products match the sentence...`)

  const changes: Change[] = []
  const errors: string[] = []
  let updatedRows = 0

  for (const row of rows) {
    const updateData: Record<string, string | null> = {}
    const rowChanges: Change[] = []

    for (const target of TARGETS) {
      const before = row[target.field]
      const after = stripSentence(before, target.field)
      if (after === undefined) continue
      updateData[target.field] = after === '' ? null : after
      rowChanges.push({ sku: row.sku, field: target.field, before: before as string, after })
    }

    if (rowChanges.length === 0) continue
    changes.push(...rowChanges)

    if (!isApply) {
      updatedRows++
      continue
    }

    try {
      // Only the care-instruction columns are written; every other product
      // field is left untouched.
      await prisma.product.update({ where: { id: row.id }, data: updateData })
      updatedRows++
    } catch (error) {
      errors.push(`Postgres ${row.sku}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  return { changes, updatedRows, errors }
}

function reportChanges(label: string, changes: Change[], updated: number) {
  console.log(`\n${label}`)
  console.log(`  Products ${isApply ? 'updated' : 'that would be updated'}: ${updated}`)
  for (const target of TARGETS) {
    const count = changes.filter((c) => c.field === target.field).length
    console.log(`    ${target.field}: ${count}`)
  }
  const emptied = changes.filter((c) => c.after === '')
  if (emptied.length > 0) {
    console.log(`    Fields left empty (cleared): ${emptied.length}`)
    emptied.slice(0, 10).forEach((c) => console.log(`      - ${c.sku} / ${c.field}`))
  }
}

async function main() {
  console.log(
    `🧼 Care-instruction sentence cleanup — ${isApply ? 'APPLYING WRITES' : 'PREVIEW ONLY (no writes)'}, lang=${langArg}\n`
  )
  for (const target of TARGETS) {
    console.log(`  Removing [${target.lang}]: "${target.sentence}"`)
  }
  console.log('')

  const firestore = await cleanFirestore()
  const postgres = await cleanPostgres()

  reportChanges('Firestore (source of truth)', firestore.changes, firestore.updatedDocs)
  reportChanges('Postgres (storefront PDP)', postgres.changes, postgres.updatedRows)

  // One sample before/after, so the preview shows exactly what the edit does.
  const sample = firestore.changes[0] ?? postgres.changes[0]
  if (sample) {
    console.log(`\nSample (${sample.sku} / ${sample.field}):`)
    console.log(`  before: ${sample.before}`)
    console.log(`  after : ${sample.after === '' ? '(empty — field cleared)' : sample.after}`)
  }

  const errors = [...firestore.errors, ...postgres.errors]
  if (errors.length > 0) {
    console.log(`\n❌ Errors: ${errors.length}`)
    errors.slice(0, 20).forEach((e) => console.log(`  - ${e}`))
  }

  const total = firestore.updatedDocs + postgres.updatedRows
  if (!isApply) {
    console.log(
      total > 0
        ? `\nRe-run with --apply to write these changes.`
        : `\nNothing to do — the sentence was not found in either store.`
    )
  } else {
    console.log(`\n✅ Cleanup complete. Re-run without --apply to verify 0 remaining.`)
  }

  await prisma.$disconnect()
}

main().catch(async (err) => {
  console.error('Cleanup failed:', err)
  await prisma.$disconnect()
  process.exit(1)
})
