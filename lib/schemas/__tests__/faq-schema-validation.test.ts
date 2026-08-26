import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  checkInternalPath,
  createFaqSchema,
  faqCtaSchema,
  faqSettingsSchema,
  faqSlugSchema,
  reorderFaqSchema,
  updateFaqSchema,
  updateFaqStatusSchema,
} from '../faq-schema'

const validCreate = {
  audience: 'women',
  topic: 'sizing',
  question: { he: 'איך בוחרים מידה?', en: 'How do I choose a size?' },
  answerHtml: { he: '<p>תשובה</p>', en: '<p>Answer</p>' },
}

describe('createFaqSchema', () => {
  it('accepts a well-formed question', () => {
    const result = createFaqSchema.safeParse(validCreate)
    assert.equal(result.success, true)
  })

  it('defaults to draft, so a mis-wired client cannot publish by accident', () => {
    const result = createFaqSchema.parse(validCreate)
    assert.equal(result.status, 'draft')
  })

  it('refuses to create something already "hidden"', () => {
    // Hiding is only meaningful for something that was published.
    assert.equal(
      createFaqSchema.safeParse({ ...validCreate, status: 'hidden' }).success,
      false
    )
  })

  it('requires a question in at least one language', () => {
    assert.equal(
      createFaqSchema.safeParse({ ...validCreate, question: { he: '', en: '' } }).success,
      false
    )
    assert.equal(
      createFaqSchema.safeParse({ ...validCreate, question: { he: '   ', en: '' } }).success,
      false
    )
  })

  it('accepts a question in only one language', () => {
    assert.equal(
      createFaqSchema.safeParse({ ...validCreate, question: { he: 'שאלה', en: '' } }).success,
      true
    )
  })

  it('requires an answer in at least one language', () => {
    assert.equal(
      createFaqSchema.safeParse({ ...validCreate, answerHtml: { he: '', en: '' } }).success,
      false
    )
  })

  it('rejects an unknown audience, topic or status', () => {
    assert.equal(createFaqSchema.safeParse({ ...validCreate, audience: 'kids' }).success, false)
    assert.equal(createFaqSchema.safeParse({ ...validCreate, topic: 'weather' }).success, false)
    assert.equal(createFaqSchema.safeParse({ ...validCreate, status: 'live' }).success, false)
  })

  it('caps the number of related links', () => {
    const links = Array.from({ length: 7 }, () => ({
      label: { he: 'קישור', en: 'Link' },
      href: '/contact',
    }))
    assert.equal(createFaqSchema.safeParse({ ...validCreate, relatedLinks: links }).success, false)
  })
})

describe('faqSlugSchema', () => {
  it('accepts lowercase kebab', () => {
    assert.equal(faqSlugSchema.safeParse('how-do-i-choose-a-size').success, true)
  })

  it('rejects anything that would break an HTML id', () => {
    for (const bad of ['', 'Has-Upper', 'has space', 'trailing-', 'double--hyphen', 'a'.repeat(61)]) {
      assert.equal(faqSlugSchema.safeParse(bad).success, false, `expected ${JSON.stringify(bad)} to fail`)
    }
  })
})

describe('updateFaqSchema', () => {
  it('accepts a partial update', () => {
    assert.equal(updateFaqSchema.safeParse({ status: 'hidden' }).success, true)
  })

  it('rejects an empty payload', () => {
    assert.equal(updateFaqSchema.safeParse({}).success, false)
  })

  it('does not accept `order` — ordering only moves through the reorder route', () => {
    // Letting an edit set order directly would silently duplicate another
    // question's position, bypassing the membership check.
    const result = updateFaqSchema.parse({ status: 'draft', order: 3 } as Record<string, unknown>)
    assert.equal((result as Record<string, unknown>).order, undefined)
  })
})

describe('updateFaqStatusSchema', () => {
  it('accepts all three statuses and nothing else', () => {
    for (const status of ['draft', 'published', 'hidden']) {
      assert.equal(updateFaqStatusSchema.safeParse({ status }).success, true)
    }
    assert.equal(updateFaqStatusSchema.safeParse({ status: 'archived' }).success, false)
  })
})

describe('reorderFaqSchema', () => {
  it('accepts an audience and a non-empty id list', () => {
    assert.equal(
      reorderFaqSchema.safeParse({ audience: 'men', orderedIds: ['a', 'b'] }).success,
      true
    )
  })

  it('rejects an empty list or a bad audience', () => {
    assert.equal(reorderFaqSchema.safeParse({ audience: 'men', orderedIds: [] }).success, false)
    assert.equal(
      reorderFaqSchema.safeParse({ audience: 'kids', orderedIds: ['a'] }).success,
      false
    )
  })
})

describe('checkInternalPath', () => {
  it('accepts known internal pages', () => {
    for (const path of ['', '/collection/women', '/collection/men', '/contact', '/faq', '/bags/guide']) {
      assert.equal(checkInternalPath(path).valid, true, `expected ${JSON.stringify(path)} to be valid`)
    }
  })

  it('accepts a deeper path under an allowed prefix', () => {
    assert.equal(checkInternalPath('/collection/women/shoes/boots').valid, true)
    assert.equal(checkInternalPath('/news/some-article').valid, true)
  })

  it('accepts a deep link to a specific question', () => {
    assert.equal(checkInternalPath('/faq#faq-question-how-to-measure').valid, true)
  })

  it('rejects anything that leaves the site', () => {
    for (const bad of [
      'https://evil.com',
      '//evil.com',
      'javascript:alert(1)',
      'mailto:a@b.com',
      'collection/women',
    ]) {
      assert.equal(checkInternalPath(bad).valid, false, `expected ${JSON.stringify(bad)} to be rejected`)
    }
  })

  it('rejects path traversal and whitespace', () => {
    assert.equal(checkInternalPath('/collection/../../etc').valid, false)
    assert.equal(checkInternalPath('/collection /women').valid, false)
  })

  it('rejects a path that would 404 — the point of an allowlist over a regex', () => {
    assert.equal(checkInternalPath('/colection/wemen').valid, false)
    assert.equal(checkInternalPath('/nope').valid, false)
  })

  it('rejects a locale prefix, which is added at render time', () => {
    assert.equal(checkInternalPath('/he/faq').valid, false)
    assert.equal(checkInternalPath('/en/collection/women').valid, false)
  })

  it('explains why it rejected', () => {
    assert.ok((checkInternalPath('https://evil.com').reason ?? '').length > 0)
  })
})

describe('faqCtaSchema', () => {
  it('accepts a canonical collection destination', () => {
    const result = faqCtaSchema.safeParse({
      label: { he: 'לצפייה בקולקציית הנשים', en: "Shop the women's collection" },
      href: '/collection/women',
    })
    assert.equal(result.success, true)
  })

  it('rejects an external destination', () => {
    const result = faqCtaSchema.safeParse({
      label: { he: 'לחצו', en: 'Click' },
      href: 'https://evil.com',
    })
    assert.equal(result.success, false)
  })
})

describe('faqSettingsSchema', () => {
  const validSettings = {
    heading: { he: 'שאלות נפוצות', en: 'FAQ' },
    intro: { he: '<p>הקדמה</p>', en: '<p>Intro</p>' },
    sectionTitles: {
      women: { he: 'נעלי נשים', en: "Women's Shoes" },
      men: { he: 'נעלי גברים', en: "Men's Shoes" },
      general: { he: 'כללי', en: 'General' },
    },
    seoTitle: { he: 'שאלות נפוצות', en: 'FAQ' },
    seoDescription: { he: 'תיאור', en: 'Description' },
    primaryCta: { label: { he: 'נשים', en: 'Women' }, href: '/collection/women' },
    secondaryCta: { label: { he: 'גברים', en: 'Men' }, href: '/collection/men' },
  }

  it('accepts a complete settings payload and defaults robots to index, follow', () => {
    const result = faqSettingsSchema.parse(validSettings)
    assert.equal(result.robots, 'index, follow')
  })

  it('requires a heading in at least one language', () => {
    assert.equal(
      faqSettingsSchema.safeParse({ ...validSettings, heading: { he: '', en: '' } }).success,
      false
    )
  })

  it('rejects an unsafe CTA destination on either CTA', () => {
    assert.equal(
      faqSettingsSchema.safeParse({
        ...validSettings,
        primaryCta: { label: { he: 'x', en: 'x' }, href: 'https://evil.com' },
      }).success,
      false
    )
    assert.equal(
      faqSettingsSchema.safeParse({
        ...validSettings,
        secondaryCta: { label: { he: 'x', en: 'x' }, href: '//evil.com' },
      }).success,
      false
    )
  })

  it('rejects an unknown robots directive', () => {
    assert.equal(
      faqSettingsSchema.safeParse({ ...validSettings, robots: 'index' }).success,
      false
    )
  })
})
