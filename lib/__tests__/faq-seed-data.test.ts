import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { FAQ_SEED_ITEMS } from '../../scripts/data/faq-seed-data'
import { isValidFaqSlug } from '../faq-slug'
import { sanitizeFaqAnswerHtml } from '../sanitize-html'
import { createFaqSchema } from '../schemas/faq-schema'
import { buildFaqPageStructuredData } from '../faq-schema'
import { FAQ_AUDIENCES, FAQ_TOPICS } from '../faq-types'

/**
 * The seed content is real published copy, so it is worth the same scrutiny as
 * code. These tests catch a bad slug, an answer the sanitizer would empty, or —
 * most importantly — a policy question that has accidentally been marked
 * published while still carrying its placeholder.
 */

describe('seed data — shape', () => {
  it('has content', () => {
    assert.ok(FAQ_SEED_ITEMS.length >= 20)
  })

  it('has unique slugs', () => {
    const slugs = FAQ_SEED_ITEMS.map((i) => i.slug)
    assert.equal(new Set(slugs).size, slugs.length)
  })

  it('has valid slugs', () => {
    for (const item of FAQ_SEED_ITEMS) {
      assert.ok(isValidFaqSlug(item.slug), `invalid slug: ${item.slug}`)
    }
  })

  it('uses only known audiences and topics', () => {
    for (const item of FAQ_SEED_ITEMS) {
      assert.ok(FAQ_AUDIENCES.includes(item.audience), `${item.slug}: ${item.audience}`)
      assert.ok(FAQ_TOPICS.includes(item.topic), `${item.slug}: ${item.topic}`)
    }
  })

  it('covers all three audiences', () => {
    for (const audience of FAQ_AUDIENCES) {
      assert.ok(
        FAQ_SEED_ITEMS.some((i) => i.audience === audience && i.status === 'published'),
        `no published questions for ${audience}`
      )
    }
  })
})

describe('seed data — passes the real API validation', () => {
  it('every item satisfies createFaqSchema', () => {
    for (const item of FAQ_SEED_ITEMS) {
      const result = createFaqSchema.safeParse({
        slug: item.slug,
        audience: item.audience,
        topic: item.topic,
        question: item.question,
        answerHtml: item.answerHtml,
        shortAnswer: item.shortAnswer,
        relatedLinks: item.relatedLinks,
        status: item.status === 'hidden' ? 'draft' : item.status,
      })
      assert.ok(
        result.success,
        `${item.slug}: ${result.success ? '' : JSON.stringify(result.error.issues)}`
      )
    }
  })
})

describe('seed data — bilingual completeness', () => {
  it('every item has both a Hebrew and an English question', () => {
    // Hebrew is the primary market; English is a live, indexed locale. A blank
    // in either renders a fallback, which is a worse page than a translation.
    for (const item of FAQ_SEED_ITEMS) {
      assert.ok(item.question.he.trim(), `${item.slug}: missing Hebrew question`)
      assert.ok(item.question.en.trim(), `${item.slug}: missing English question`)
    }
  })

  it('every item has both a Hebrew and an English answer', () => {
    for (const item of FAQ_SEED_ITEMS) {
      assert.ok(item.answerHtml.he.trim(), `${item.slug}: missing Hebrew answer`)
      assert.ok(item.answerHtml.en.trim(), `${item.slug}: missing English answer`)
    }
  })
})

describe('seed data — survives sanitization', () => {
  it('no answer is emptied by the sanitizer', () => {
    for (const item of FAQ_SEED_ITEMS) {
      for (const locale of ['he', 'en'] as const) {
        assert.ok(
          sanitizeFaqAnswerHtml(item.answerHtml[locale]).trim(),
          `${item.slug} (${locale}) is empty after sanitization`
        )
      }
    }
  })

  it('no answer contains an h1 or h2 — the page owns those', () => {
    for (const item of FAQ_SEED_ITEMS) {
      for (const locale of ['he', 'en'] as const) {
        assert.ok(
          !/<h[12]\b/i.test(item.answerHtml[locale]),
          `${item.slug} (${locale}) contains a heading above h3`
        )
      }
    }
  })

  it('callouts use the one whitelisted class, so none are stripped', () => {
    for (const item of FAQ_SEED_ITEMS) {
      for (const locale of ['he', 'en'] as const) {
        const raw = item.answerHtml[locale]
        if (!raw.includes('faq-callout')) continue
        assert.ok(
          sanitizeFaqAnswerHtml(raw).includes('faq-callout'),
          `${item.slug} (${locale}) loses its callout class`
        )
      }
    }
  })

  it('tables keep their scope attributes through sanitization', () => {
    for (const item of FAQ_SEED_ITEMS) {
      for (const locale of ['he', 'en'] as const) {
        const raw = item.answerHtml[locale]
        if (!raw.includes('<table')) continue
        const clean = sanitizeFaqAnswerHtml(raw)
        assert.ok(clean.includes('scope="col"'), `${item.slug} (${locale}) lost scope="col"`)
        assert.ok(clean.includes('<caption>'), `${item.slug} (${locale}) lost its caption`)
      }
    }
  })
})

describe('seed data — internal links', () => {
  it('every internal href is locale-prefixed and points at a real route', () => {
    const known = /^\/(he|en)\/(collection\/(women|men)|contact|faq|about|news|bags\/guide|terms|privacy)/
    for (const item of FAQ_SEED_ITEMS) {
      for (const locale of ['he', 'en'] as const) {
        for (const match of item.answerHtml[locale].matchAll(/href="([^"]+)"/g)) {
          const href = match[1]
          if (href.startsWith('http')) continue
          assert.ok(known.test(href), `${item.slug} (${locale}) links to unknown route: ${href}`)
        }
      }
    }
  })

  it('relatedLinks use locale-less internal paths', () => {
    for (const item of FAQ_SEED_ITEMS) {
      for (const link of item.relatedLinks ?? []) {
        assert.ok(link.href.startsWith('/'), `${item.slug}: ${link.href}`)
        assert.ok(
          !/^\/(he|en)\//.test(link.href),
          `${item.slug}: relatedLinks must omit the locale prefix (${link.href})`
        )
      }
    }
  })
})

describe('seed data — the policy gate', () => {
  const isPlaceholder = (html: string) =>
    /DO NOT PUBLISH|אין לפרסם/.test(html)

  it('every placeholder answer is a draft', () => {
    // This is the test that matters most in this file. A placeholder that
    // shipped as `published` would put "ACTION REQUIRED" on a public page and,
    // worse, imply a policy that has not been approved.
    for (const item of FAQ_SEED_ITEMS) {
      const hasPlaceholder =
        isPlaceholder(item.answerHtml.he) || isPlaceholder(item.answerHtml.en)
      if (!hasPlaceholder) continue
      assert.equal(item.status, 'draft', `${item.slug} carries a placeholder but is ${item.status}`)
    }
  })

  it('no published answer contains a placeholder', () => {
    for (const item of FAQ_SEED_ITEMS.filter((i) => i.status === 'published')) {
      assert.ok(!isPlaceholder(item.answerHtml.he), `${item.slug} (he)`)
      assert.ok(!isPlaceholder(item.answerHtml.en), `${item.slug} (en)`)
    }
  })

  it('ships commercial-policy questions as drafts', () => {
    // Shipping cost, delivery time, returns and store details are commitments,
    // not facts derivable from the catalogue. If one of these ever becomes
    // published in the seed data, someone invented policy.
    for (const item of FAQ_SEED_ITEMS) {
      if (!['shipping', 'returns', 'payment'].includes(item.topic)) continue
      assert.equal(
        item.status,
        'draft',
        `${item.slug} asserts commercial policy but ships as ${item.status}`
      )
    }
  })
})

describe('seed data — JSON-LD output', () => {
  it('produces valid FAQPage entities from the published items only', () => {
    const published = FAQ_SEED_ITEMS.filter((i) => i.status === 'published')
    const schema = buildFaqPageStructuredData(
      published.map((i) => ({
        slug: i.slug,
        question: i.question.he,
        answerHtml: i.answerHtml.he,
        shortAnswer: i.shortAnswer?.he,
      })),
      {
        locale: 'he',
        pageUrl: 'https://www.sako-or.com/he/faq',
        baseUrl: 'https://www.sako-or.com',
      }
    )!

    const entities = schema.mainEntity as Array<Record<string, unknown>>
    assert.equal(entities.length, published.length)

    for (const entity of entities) {
      const answer = entity.acceptedAnswer as Record<string, unknown>
      assert.ok(String(entity.name).length > 0)
      assert.ok(String(answer.text).length > 0)
      // Tables are not an allowed tag in an Answer; they must have been
      // converted to lists.
      assert.ok(!String(answer.text).includes('<table'), `${entity['@id']} leaks a table`)
    }
  })

  it('never includes a draft', () => {
    const draftSlugs = FAQ_SEED_ITEMS.filter((i) => i.status === 'draft').map((i) => i.slug)
    const schema = buildFaqPageStructuredData(
      FAQ_SEED_ITEMS.filter((i) => i.status === 'published').map((i) => ({
        slug: i.slug,
        question: i.question.he,
        answerHtml: i.answerHtml.he,
      })),
      {
        locale: 'he',
        pageUrl: 'https://www.sako-or.com/he/faq',
        baseUrl: 'https://www.sako-or.com',
      }
    )!
    const serialized = JSON.stringify(schema)
    for (const slug of draftSlugs) {
      assert.ok(!serialized.includes(slug), `draft ${slug} leaked into the schema`)
    }
  })
})
