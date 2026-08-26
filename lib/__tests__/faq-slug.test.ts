import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildFaqSlug,
  ensureUniqueFaqSlug,
  faqAnswerElementId,
  faqQuestionElementId,
  isValidFaqSlug,
  slugFromHash,
  toFaqSlugCandidate,
} from '../faq-slug'

describe('toFaqSlugCandidate', () => {
  it('kebab-cases an English question', () => {
    assert.equal(
      toFaqSlugCandidate('How do I choose the correct shoe size?'),
      'how-do-i-choose-the-correct-shoe-size'
    )
  })

  it('drops apostrophes instead of hyphenating them', () => {
    // "women-s-shoes" would read as a typo in a shared URL.
    assert.equal(toFaqSlugCandidate("Women's shoes"), 'womens-shoes')
    assert.equal(toFaqSlugCandidate('Women’s shoes'), 'womens-shoes')
  })

  it('folds accented Latin to its base letter rather than dropping it', () => {
    assert.equal(toFaqSlugCandidate('Café résumé'), 'cafe-resume')
  })

  it('returns an empty string for text with no ASCII content', () => {
    // This is the trap the module exists to avoid: lib/cms-utils slugify()
    // returns '' here too, but silently uses it as the slug.
    assert.equal(toFaqSlugCandidate('איך בוחרים מידה?'), '')
  })

  it('never leaves a leading, trailing or doubled hyphen', () => {
    const slug = toFaqSlugCandidate('  --- What is  a  block heel??  --- ')
    assert.equal(slug, 'what-is-a-block-heel')
    assert.ok(!slug.startsWith('-'))
    assert.ok(!slug.endsWith('-'))
    assert.ok(!slug.includes('--'))
  })

  it('caps length without leaving a trailing hyphen', () => {
    const slug = toFaqSlugCandidate('a'.repeat(40) + ' ' + 'b'.repeat(40))
    assert.ok(slug.length <= 60)
    assert.ok(!slug.endsWith('-'))
  })
})

describe('buildFaqSlug', () => {
  it('prefers the English question', () => {
    assert.equal(
      buildFaqSlug({ en: 'Do leather shoes stretch?', he: 'האם נעלי עור מתרחבות?' }),
      'do-leather-shoes-stretch'
    )
  })

  it('falls back to ASCII inside the Hebrew question when English is empty', () => {
    assert.equal(buildFaqSlug({ en: '', he: 'מהי מידת SAKO 38?' }), 'sako-38')
  })

  it('never returns an empty slug for a Hebrew-only question', () => {
    const slug = buildFaqSlug({ en: '', he: 'איך מודדים כף רגל בבית?' }, 4)
    assert.equal(slug, 'faq-4')
    assert.ok(isValidFaqSlug(slug))
  })

  it('uses a 1-based fallback index and tolerates a bad one', () => {
    assert.equal(buildFaqSlug({ he: 'שאלה' }), 'faq-1')
    assert.equal(buildFaqSlug({ he: 'שאלה' }, 0), 'faq-1')
    assert.equal(buildFaqSlug({ he: 'שאלה' }, -3), 'faq-1')
  })
})

describe('ensureUniqueFaqSlug', () => {
  it('returns the slug untouched when it is free', () => {
    assert.equal(ensureUniqueFaqSlug('leather-care', ['sizing', 'heels']), 'leather-care')
  })

  it('is idempotent — re-saving an unchanged question does not drift to -2', () => {
    const taken = ['sizing', 'heels']
    const first = ensureUniqueFaqSlug('leather-care', taken)
    const second = ensureUniqueFaqSlug(first, taken)
    assert.equal(first, second)
  })

  it('suffixes on collision and keeps counting', () => {
    assert.equal(ensureUniqueFaqSlug('sizing', ['sizing']), 'sizing-2')
    assert.equal(ensureUniqueFaqSlug('sizing', ['sizing', 'sizing-2']), 'sizing-3')
  })

  it('keeps the suffixed slug within the length limit', () => {
    const long = 'a'.repeat(60)
    const result = ensureUniqueFaqSlug(long, [long])
    assert.ok(result.length <= 60, `got ${result.length}`)
    assert.ok(isValidFaqSlug(result))
  })
})

describe('isValidFaqSlug', () => {
  it('accepts lowercase kebab', () => {
    assert.ok(isValidFaqSlug('how-to-measure-your-foot'))
    assert.ok(isValidFaqSlug('faq-12'))
  })

  it('rejects anything that would break an HTML id or URL fragment', () => {
    for (const bad of ['', 'Has-Upper', 'has space', 'trailing-', '-leading', 'double--hyphen', 'héllo']) {
      assert.equal(isValidFaqSlug(bad), false, `expected ${JSON.stringify(bad)} to be rejected`)
    }
  })
})

describe('element ids', () => {
  it('produces the ids the accordion contract requires', () => {
    assert.equal(faqQuestionElementId('leather-care'), 'faq-question-leather-care')
    assert.equal(faqAnswerElementId('leather-care'), 'faq-answer-leather-care')
  })
})

describe('slugFromHash', () => {
  it('resolves the question anchor, the answer anchor and a bare slug', () => {
    assert.equal(slugFromHash('#faq-question-leather-care'), 'leather-care')
    assert.equal(slugFromHash('#faq-answer-leather-care'), 'leather-care')
    assert.equal(slugFromHash('#leather-care'), 'leather-care')
    assert.equal(slugFromHash('faq-question-leather-care'), 'leather-care')
  })

  it('does not mangle a faq-{n} fallback slug', () => {
    // Stripping a generic "faq-" prefix would resolve #faq-3 to "3".
    assert.equal(slugFromHash('#faq-3'), 'faq-3')
    assert.equal(slugFromHash('#faq-question-faq-3'), 'faq-3')
  })

  it('decodes percent-encoding', () => {
    assert.equal(slugFromHash('#faq-question-leather%2Dcare'), 'leather-care')
  })

  it('returns null for no hash, an unrelated hash or a malformed escape', () => {
    assert.equal(slugFromHash(''), null)
    assert.equal(slugFromHash('#'), null)
    assert.equal(slugFromHash('#Not A Slug'), null)
    // A lone % throws inside decodeURIComponent; it must not take the page down.
    assert.equal(slugFromHash('#%E0%A4%A'), null)
  })
})
