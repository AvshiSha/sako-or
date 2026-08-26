import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  faqMatchesSearch,
  getFaqLastModified,
  isPubliclyVisible,
  pickLocalized,
  selectPublishedFaqs,
  selectRenderableFaqs,
  toFaqDate,
} from '../faq-selectors'
import type { FaqItem, FaqStatus } from '../faq-types'

const faq = (overrides: Partial<FaqItem> = {}): FaqItem =>
  ({
    id: 'id-1',
    slug: 'slug-1',
    audience: 'women',
    topic: 'sizing',
    question: { he: 'שאלה', en: 'Question' },
    answerHtml: { he: '<p>תשובה</p>', en: '<p>Answer</p>' },
    order: 0,
    status: 'published',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }) as FaqItem

describe('pickLocalized', () => {
  it('returns the requested locale when it has content', () => {
    assert.equal(pickLocalized({ he: 'עברית', en: 'English' }, 'he'), 'עברית')
    assert.equal(pickLocalized({ he: 'עברית', en: 'English' }, 'en'), 'English')
  })

  it('falls back to the other language rather than rendering blank', () => {
    // A blank <button> would be an accessibility failure and an empty
    // schema.org name; falling back is the lesser evil.
    assert.equal(pickLocalized({ he: 'עברית', en: '' }, 'en'), 'עברית')
    assert.equal(pickLocalized({ he: '', en: 'English' }, 'he'), 'English')
  })

  it('treats whitespace-only as empty', () => {
    assert.equal(pickLocalized({ he: '   ', en: 'English' }, 'he'), 'English')
  })

  it('returns an empty string when the field is missing or empty in both', () => {
    assert.equal(pickLocalized(undefined, 'he'), '')
    assert.equal(pickLocalized({ he: '', en: '' }, 'he'), '')
  })
})

describe('isPubliclyVisible', () => {
  it('admits published only', () => {
    assert.equal(isPubliclyVisible({ status: 'published' }), true)
    assert.equal(isPubliclyVisible({ status: 'draft' }), false)
    assert.equal(isPubliclyVisible({ status: 'hidden' }), false)
  })

  it('rejects an unrecognised status by default', () => {
    // Checked positively, so a status value added later is invisible until
    // someone deliberately makes it visible.
    assert.equal(isPubliclyVisible({ status: 'archived' as FaqStatus }), false)
  })
})

describe('selectPublishedFaqs', () => {
  it('drops draft and hidden items', () => {
    const items = [
      faq({ id: 'pub', status: 'published' }),
      faq({ id: 'draft', status: 'draft' }),
      faq({ id: 'hidden', status: 'hidden' }),
    ]
    assert.deepEqual(
      selectPublishedFaqs(items).map((i) => i.id),
      ['pub']
    )
  })
})

describe('selectRenderableFaqs', () => {
  it('drops a published item whose question is blank in both languages', () => {
    const items = [
      faq({ id: 'ok' }),
      faq({ id: 'blank', question: { he: '', en: '' } }),
    ]
    assert.deepEqual(
      selectRenderableFaqs(items, 'he').map((i) => i.id),
      ['ok']
    )
  })

  it('keeps an item that only has the other language, via the fallback', () => {
    const items = [faq({ id: 'he-only', question: { he: 'שאלה', en: '' } })]
    assert.deepEqual(
      selectRenderableFaqs(items, 'en').map((i) => i.id),
      ['he-only']
    )
  })

  it('still excludes drafts', () => {
    const items = [faq({ id: 'draft', status: 'draft' })]
    assert.deepEqual(selectRenderableFaqs(items, 'he'), [])
  })
})

describe('toFaqDate', () => {
  it('accepts ISO strings, epoch numbers and Dates', () => {
    assert.equal(toFaqDate('2026-05-04T00:00:00.000Z')?.toISOString(), '2026-05-04T00:00:00.000Z')
    assert.ok(toFaqDate(1_700_000_000_000) instanceof Date)
    const d = new Date('2026-05-04T00:00:00.000Z')
    assert.equal(toFaqDate(d), d)
  })

  it('unwraps a Firestore Timestamp', () => {
    // The client SDK hands back Timestamps at runtime even where our types say
    // string; new Date() on one silently yields an Invalid Date.
    const timestamp = { toDate: () => new Date('2026-05-04T00:00:00.000Z') }
    assert.equal(toFaqDate(timestamp)?.toISOString(), '2026-05-04T00:00:00.000Z')
  })

  it('returns null for anything unusable', () => {
    assert.equal(toFaqDate(undefined), null)
    assert.equal(toFaqDate(null), null)
    assert.equal(toFaqDate(''), null)
    assert.equal(toFaqDate('not a date'), null)
    assert.equal(toFaqDate(new Date('nope')), null)
    assert.equal(toFaqDate({ toDate: () => new Date('nope') }), null)
  })
})

describe('getFaqLastModified', () => {
  const fallback = new Date('2000-01-01T00:00:00.000Z')

  it('returns the newest published updatedAt', () => {
    const result = getFaqLastModified(
      [
        faq({ id: 'a', updatedAt: '2026-03-01T00:00:00.000Z' }),
        faq({ id: 'b', updatedAt: '2026-06-01T00:00:00.000Z' }),
      ],
      null,
      fallback
    )
    assert.equal(result.toISOString(), '2026-06-01T00:00:00.000Z')
  })

  it('ignores draft and hidden items', () => {
    // Editing a draft changes nothing a crawler can see; claiming otherwise
    // trains Google to distrust our lastmod values.
    const result = getFaqLastModified(
      [
        faq({ id: 'pub', updatedAt: '2026-03-01T00:00:00.000Z' }),
        faq({ id: 'draft', status: 'draft', updatedAt: '2026-12-01T00:00:00.000Z' }),
        faq({ id: 'hidden', status: 'hidden', updatedAt: '2026-12-31T00:00:00.000Z' }),
      ],
      null,
      fallback
    )
    assert.equal(result.toISOString(), '2026-03-01T00:00:00.000Z')
  })

  it('takes the settings doc into account', () => {
    const result = getFaqLastModified(
      [faq({ updatedAt: '2026-03-01T00:00:00.000Z' })],
      { updatedAt: '2026-08-01T00:00:00.000Z' },
      fallback
    )
    assert.equal(result.toISOString(), '2026-08-01T00:00:00.000Z')
  })

  it('falls back only when nothing valid is available', () => {
    assert.equal(getFaqLastModified([], null, fallback), fallback)
    assert.equal(
      getFaqLastModified([faq({ updatedAt: 'garbage' })], { updatedAt: '' }, fallback),
      fallback
    )
  })
})

describe('faqMatchesSearch', () => {
  const row = {
    question: { he: 'איך בוחרים מידה?', en: 'How do I choose a size?' },
    slug: 'how-do-i-choose-a-size',
    plainAnswer: 'Measure heel to toe and leave 5-10mm of spare room.',
  }

  it('matches an empty term (no filter applied)', () => {
    assert.equal(faqMatchesSearch(row, ''), true)
    assert.equal(faqMatchesSearch(row, '   '), true)
  })

  it('matches either language, the slug and the answer text', () => {
    assert.equal(faqMatchesSearch(row, 'בוחרים'), true)
    assert.equal(faqMatchesSearch(row, 'choose'), true)
    assert.equal(faqMatchesSearch(row, 'how-do-i'), true)
    assert.equal(faqMatchesSearch(row, 'spare room'), true)
  })

  it('is case-insensitive and rejects a non-match', () => {
    assert.equal(faqMatchesSearch(row, 'CHOOSE'), true)
    assert.equal(faqMatchesSearch(row, 'refund'), false)
  })
})
