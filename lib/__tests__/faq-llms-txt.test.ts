import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildLlmsTxt } from '../llms-txt'
import type { FaqItem } from '../faq-types'

const BASE = 'https://www.sako-or.com'

const faq = (overrides: Partial<FaqItem> = {}): FaqItem =>
  ({
    id: 'id-1',
    slug: 'how-to-measure',
    audience: 'women',
    topic: 'sizing',
    question: { he: 'איך מודדים כף רגל?', en: 'How do I measure my foot?' },
    answerHtml: { he: '<p>תשובה</p>', en: '<p>Answer</p>' },
    shortAnswer: { he: 'מדדו מהעקב לבוהן.', en: 'Measure heel to toe.' },
    order: 0,
    status: 'published',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }) as FaqItem

const build = (faqs: FaqItem[]) =>
  buildLlmsTxt({ faqs, baseUrl: BASE, locales: ['he', 'en'] })

describe('buildLlmsTxt — structure', () => {
  it('opens with the brand H1 and a blockquote summary', () => {
    const out = build([faq()])
    assert.ok(out.startsWith('# SAKO-OR'))
    assert.ok(out.includes('\n> SAKO-OR is an Israeli footwear'))
  })

  it('includes the required section headings', () => {
    const out = build([faq()])
    for (const heading of [
      '## Shopping Guides and Customer Help',
      '## Collections',
      '## Product Guides',
      '## News',
      '## Policies and Contact',
    ]) {
      assert.ok(out.includes(heading), `missing ${heading}`)
    }
  })

  it('tolerates a trailing slash on the base URL', () => {
    const out = buildLlmsTxt({ faqs: [faq()], baseUrl: `${BASE}/`, locales: ['he'] })
    assert.ok(!out.includes('//he/faq'))
  })
})

describe('buildLlmsTxt — FAQ links', () => {
  it('links both locales with a descriptive label, not a bare URL', () => {
    const out = build([faq()])
    assert.ok(out.includes(`](${BASE}/he/faq)`))
    assert.ok(out.includes(`](${BASE}/en/faq)`))
    assert.ok(out.includes('[שאלות נפוצות ומדריך לבחירת נעליים]'))
    assert.ok(out.includes('[Frequently Asked Questions and Shoe Buying Guide]'))
  })

  it('annotates every link with a description after the colon', () => {
    for (const line of build([faq()]).split('\n').filter((l) => l.startsWith('- ['))) {
      assert.match(line, /^- \[[^\]]+\]\(https:\/\/[^)]+\): .+/, `unannotated link: ${line}`)
    }
  })

  it('deep-links individual questions with their summary', () => {
    const out = build([faq()])
    assert.ok(out.includes(`${BASE}/he/faq#faq-question-how-to-measure`))
    assert.ok(out.includes('מדדו מהעקב לבוהן.'))
  })

  it('caps the number of deep-linked questions', () => {
    const many = Array.from({ length: 25 }, (_, i) =>
      faq({ id: `id-${i}`, slug: `q-${i}`, order: i })
    )
    const out = build(many)
    const deepLinks = out.split('\n').filter((l) => l.includes('#faq-question-'))
    assert.equal(deepLinks.length, 10)
  })

  it('omits the questions section entirely when nothing is published', () => {
    const out = build([faq({ status: 'draft' })])
    assert.ok(!out.includes('### Individual questions'))
    // The FAQ page links themselves stay — the page still exists.
    assert.ok(out.includes(`${BASE}/he/faq`))
  })
})

describe('buildLlmsTxt — the draft/hidden gate', () => {
  it('never advertises a draft or hidden question', () => {
    const out = build([
      faq({ id: 'pub', slug: 'published-one', question: { he: 'פורסם', en: 'Published one' } }),
      faq({
        id: 'draft',
        slug: 'secret-draft',
        status: 'draft',
        question: { he: 'טיוטה', en: 'Secret draft' },
      }),
      faq({
        id: 'hidden',
        slug: 'secret-hidden',
        status: 'hidden',
        question: { he: 'מוסתר', en: 'Secret hidden' },
      }),
    ])
    assert.ok(out.includes('published-one'))
    assert.ok(!out.includes('secret-draft'))
    assert.ok(!out.includes('secret-hidden'))
    assert.ok(!out.includes('Secret draft'))
    assert.ok(!out.includes('Secret hidden'))
  })
})

describe('buildLlmsTxt — determinism', () => {
  it('produces byte-identical output for the same input', () => {
    const items = [faq({ id: 'b', slug: 'b', order: 1 }), faq({ id: 'a', slug: 'a', order: 0 })]
    assert.equal(build(items), build(items))
  })

  it('orders deep links by the configured display order, not input order', () => {
    const out = build([
      faq({ id: 'second', slug: 'second', order: 1 }),
      faq({ id: 'first', slug: 'first', order: 0 }),
    ])
    assert.ok(out.indexOf('#faq-question-first') < out.indexOf('#faq-question-second'))
  })
})
