import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  FAQ_CTA_CLICK_EVENT,
  FAQ_QUESTION_OPEN_EVENT,
  FAQ_VIEW_EVENT,
  buildFaqCtaClickParams,
  buildFaqQuestionOpenParams,
  buildFaqViewParams,
} from '../faq-analytics'

describe('event names', () => {
  it('matches the names the GTM tags are configured against', () => {
    assert.equal(FAQ_VIEW_EVENT, 'faq_view')
    assert.equal(FAQ_QUESTION_OPEN_EVENT, 'faq_question_open')
    assert.equal(FAQ_CTA_CLICK_EVENT, 'faq_cta_click')
  })
})

describe('buildFaqViewParams', () => {
  it('emits exactly the expected keys', () => {
    const params = buildFaqViewParams({
      locale: 'he',
      questionCount: 28,
      audiences: ['women', 'men', 'general'],
    })
    assert.deepEqual(params, {
      faq_locale: 'he',
      faq_question_count: 28,
      faq_audiences: 'women,men,general',
    })
  })

  it('drops an empty audience list rather than sending a blank value', () => {
    const params = buildFaqViewParams({ locale: 'en', questionCount: 0, audiences: [] })
    assert.equal('faq_audiences' in params, false)
    // Zero is a real count, not an absent one.
    assert.equal(params.faq_question_count, 0)
  })
})

describe('buildFaqQuestionOpenParams', () => {
  it('emits exactly the expected keys', () => {
    const params = buildFaqQuestionOpenParams({
      slug: 'how-to-measure',
      question: 'How do I measure my foot at home?',
      audience: 'women',
      topic: 'sizing',
      locale: 'he',
      method: 'click',
    })
    assert.deepEqual(params, {
      question_id: 'how-to-measure',
      question_text: 'How do I measure my foot at home?',
      audience: 'women',
      category: 'sizing',
      faq_locale: 'he',
      faq_open_method: 'click',
    })
  })

  it('truncates question_text to GA4’s 100-character parameter limit', () => {
    const params = buildFaqQuestionOpenParams({
      slug: 's',
      question: 'x'.repeat(250),
      audience: 'men',
      topic: 'fit',
      locale: 'en',
      method: 'keyboard',
    })
    assert.equal(String(params.question_text).length, 100)
  })

  it('omits audience and topic when they are unknown', () => {
    const params = buildFaqQuestionOpenParams({
      slug: 's',
      question: 'Q',
      audience: null,
      topic: null,
      locale: 'en',
      method: 'anchor',
    })
    assert.equal('audience' in params, false)
    assert.equal('category' in params, false)
    assert.equal(params.faq_open_method, 'anchor')
  })
})

describe('buildFaqCtaClickParams', () => {
  it('emits exactly the expected keys', () => {
    const params = buildFaqCtaClickParams({
      ctaId: 'primary',
      destinationUrl: '/he/collection/women',
      locale: 'he',
      slug: 'how-to-measure',
    })
    assert.deepEqual(params, {
      faq_cta_id: 'primary',
      destination_url: '/he/collection/women',
      faq_locale: 'he',
      question_id: 'how-to-measure',
    })
  })

  it('omits question_id for a page-level CTA', () => {
    const params = buildFaqCtaClickParams({
      ctaId: 'secondary',
      destinationUrl: '/he/collection/men',
      locale: 'he',
    })
    assert.equal('question_id' in params, false)
  })
})

describe('no personal information', () => {
  it('never emits an email, phone, name or user id key', () => {
    const all = {
      ...buildFaqViewParams({ locale: 'he', questionCount: 1, audiences: ['women'] }),
      ...buildFaqQuestionOpenParams({
        slug: 's',
        question: 'Q',
        audience: 'women',
        topic: 'sizing',
        locale: 'he',
        method: 'click',
      }),
      ...buildFaqCtaClickParams({ ctaId: 'primary', destinationUrl: '/x', locale: 'he' }),
    }
    for (const key of Object.keys(all)) {
      assert.ok(
        !/email|phone|name|user_id|customer/i.test(key),
        `unexpected personal-looking key: ${key}`
      )
    }
  })
})
