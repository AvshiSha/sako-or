import 'dotenv/config'
import * as admin from 'firebase-admin'

import { FAQ_SEED_ITEMS, type FaqSeedItem } from './data/faq-seed-data'
import { FAQ_COLLECTION, FAQ_SETTINGS_COLLECTION, FAQ_SETTINGS_DOC_ID, FAQ_SETTINGS_FALLBACK } from '../lib/faq-types'
import { sanitizeFaqAnswerHtml, sanitizeCmsHtml } from '../lib/sanitize-html'
import { createFaqSchema } from '../lib/schemas/faq-schema'
import { isValidFaqSlug } from '../lib/faq-slug'

/**
 * Seed the FAQ collection.
 *
 * Idempotent by slug: a question whose slug already exists is skipped unless
 * --force is passed, so re-running never duplicates content or overwrites an
 * admin's edits.
 *
 * Every answer is run through the same sanitizer and the same zod schema the
 * admin API uses, so seeded rows are indistinguishable from ones typed into the
 * dashboard — no second, laxer path into the database.
 *
 * Usage:
 *   npx tsx scripts/seed-faqs.ts --dry-run
 *   npx tsx scripts/seed-faqs.ts
 *   npx tsx scripts/seed-faqs.ts --force        # overwrite existing slugs
 *   npx tsx scripts/seed-faqs.ts --skip-settings
 */

// Initialize Firebase Admin directly (bypass the server-only lib/firebase-admin import).
if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (clientEmail && privateKey) {
    admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }) })
  } else {
    admin.initializeApp({ credential: admin.credential.applicationDefault() })
  }
}

const db = admin.firestore()

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const FORCE = args.includes('--force')
const SKIP_SETTINGS = args.includes('--skip-settings')
const SEEDED_BY = 'seed-faqs.ts'

interface Counters {
  created: number
  overwritten: number
  skipped: number
  invalid: number
}

/** Validate a seed item against the real API schema before it can be written. */
function validate(item: FaqSeedItem): string[] {
  const errors: string[] = []

  if (!isValidFaqSlug(item.slug)) {
    errors.push(`invalid slug "${item.slug}"`)
  }

  // 'hidden' is not a creatable status, so validate drafts as drafts.
  const parsed = createFaqSchema.safeParse({
    slug: item.slug,
    audience: item.audience,
    topic: item.topic,
    question: item.question,
    answerHtml: item.answerHtml,
    shortAnswer: item.shortAnswer,
    relatedLinks: item.relatedLinks,
    status: item.status === 'hidden' ? 'draft' : item.status,
  })
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      errors.push(`${issue.path.join('.') || 'root'}: ${issue.message}`)
    }
  }

  // Sanitization must not silently empty a seeded answer.
  for (const locale of ['he', 'en'] as const) {
    const raw = item.answerHtml[locale]
    if (raw.trim() && !sanitizeFaqAnswerHtml(raw).trim()) {
      errors.push(`${locale} answer is empty after sanitization`)
    }
  }

  return errors
}

async function seedItems(): Promise<Counters> {
  const counters: Counters = { created: 0, overwritten: 0, skipped: 0, invalid: 0 }

  const existing = await db.collection(FAQ_COLLECTION).get()
  const bySlug = new Map<string, string>()
  for (const doc of existing.docs) {
    const slug = (doc.data() as { slug?: string }).slug
    if (slug) bySlug.set(slug, doc.id)
  }

  // Order within an audience follows the order of FAQ_SEED_ITEMS, densely.
  const nextOrder: Record<string, number> = {}
  for (const doc of existing.docs) {
    const data = doc.data() as { audience?: string; order?: number }
    if (!data.audience) continue
    const current = nextOrder[data.audience] ?? 0
    nextOrder[data.audience] = Math.max(current, (data.order ?? -1) + 1)
  }

  const now = new Date().toISOString()

  for (const item of FAQ_SEED_ITEMS) {
    const errors = validate(item)
    if (errors.length > 0) {
      counters.invalid++
      console.error(`  ✗ ${item.slug}\n      ${errors.join('\n      ')}`)
      continue
    }

    const existingId = bySlug.get(item.slug)
    if (existingId && !FORCE) {
      counters.skipped++
      console.log(`  · ${item.slug} — already exists, skipping`)
      continue
    }

    const order = nextOrder[item.audience] ?? 0
    nextOrder[item.audience] = order + 1

    const payload = {
      slug: item.slug,
      audience: item.audience,
      topic: item.topic,
      question: item.question,
      answerHtml: {
        he: sanitizeFaqAnswerHtml(item.answerHtml.he),
        en: sanitizeFaqAnswerHtml(item.answerHtml.en),
      },
      ...(item.shortAnswer ? { shortAnswer: item.shortAnswer } : {}),
      ...(item.relatedLinks ? { relatedLinks: item.relatedLinks } : {}),
      order,
      status: item.status,
      ...(item.status === 'published' ? { publishedAt: now } : {}),
      createdAt: now,
      updatedAt: now,
      createdBy: SEEDED_BY,
      updatedBy: SEEDED_BY,
    }

    if (DRY_RUN) {
      console.log(
        `  + ${item.slug} [${item.audience}/${item.topic}] ${item.status} (order ${order})` +
          (existingId ? ' — would OVERWRITE' : '')
      )
      if (existingId) {
        counters.overwritten++
      } else {
        counters.created++
      }
      continue
    }

    if (existingId) {
      await db.collection(FAQ_COLLECTION).doc(existingId).set(payload, { merge: true })
      counters.overwritten++
      console.log(`  ↻ ${item.slug} — overwritten`)
    } else {
      await db.collection(FAQ_COLLECTION).add(payload)
      counters.created++
      console.log(`  + ${item.slug} [${item.audience}] ${item.status}`)
    }
  }

  return counters
}

async function seedSettings(): Promise<void> {
  const ref = db.collection(FAQ_SETTINGS_COLLECTION).doc(FAQ_SETTINGS_DOC_ID)
  const snap = await ref.get()

  if (snap.exists && !FORCE) {
    console.log('  · page settings already exist, skipping')
    return
  }

  const now = new Date().toISOString()
  const payload = {
    ...FAQ_SETTINGS_FALLBACK,
    intro: {
      he: sanitizeCmsHtml(FAQ_SETTINGS_FALLBACK.intro.he),
      en: sanitizeCmsHtml(FAQ_SETTINGS_FALLBACK.intro.en),
    },
    ...(snap.exists ? {} : { createdAt: now }),
    updatedAt: now,
    updatedBy: SEEDED_BY,
  }

  if (DRY_RUN) {
    console.log(`  + page settings ${snap.exists ? '(would OVERWRITE)' : '(would create)'}`)
    return
  }

  await ref.set(payload, { merge: true })
  console.log(`  ${snap.exists ? '↻' : '+'} page settings`)
}

async function main() {
  console.log(
    `\nSeeding FAQ content${DRY_RUN ? ' (DRY RUN — nothing will be written)' : ''}${
      FORCE ? ' (FORCE — existing slugs will be overwritten)' : ''
    }\n`
  )

  const published = FAQ_SEED_ITEMS.filter((i) => i.status === 'published').length
  const drafts = FAQ_SEED_ITEMS.length - published
  console.log(`${FAQ_SEED_ITEMS.length} seed items: ${published} published, ${drafts} draft\n`)

  console.log('Questions:')
  const counters = await seedItems()

  if (!SKIP_SETTINGS) {
    console.log('\nPage settings:')
    await seedSettings()
  }

  console.log(
    `\nDone. created=${counters.created} overwritten=${counters.overwritten} ` +
      `skipped=${counters.skipped} invalid=${counters.invalid}`
  )

  if (counters.invalid > 0) {
    console.error('\nSome items failed validation and were NOT written. Fix them and re-run.')
    process.exitCode = 1
    return
  }

  if (drafts > 0 && !DRY_RUN) {
    console.log(
      `\n${drafts} policy questions were seeded as DRAFTS. Their answers are placeholders —\n` +
        'no shipping, returns, store or payment policy has been written. They are invisible\n' +
        'to the public until an authorised admin replaces the text and publishes them:\n' +
        '  /admin/faq?status=draft\n'
    )
  }
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((error) => {
    console.error('Seed failed:', error)
    process.exit(1)
  })
