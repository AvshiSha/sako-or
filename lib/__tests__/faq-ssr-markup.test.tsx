import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import FaqAudienceSection from '@/app/(site)/[lng]/faq/_components/FaqAudienceSection'
import type { FaqItem } from '../faq-types'

/**
 * The accordion's server-rendered HTML is a contract, not an implementation
 * detail: crawlers and assistive technology both consume it without any
 * JavaScript running. This renders the real server component and asserts the
 * markup directly, which is the only way to catch a regression in the ARIA
 * wiring or — the important one — an answer that stops being present in the
 * initial HTML.
 *
 * FaqAudienceSection is a server component with no hooks, so it can be invoked
 * as a plain function and rendered with renderToStaticMarkup.
 */

const item = (overrides: Partial<FaqItem> = {}): FaqItem =>
  ({
    id: 'id-1',
    slug: 'how-to-measure',
    audience: 'women',
    topic: 'sizing',
    question: { he: 'איך מודדים כף רגל?', en: 'How do I measure my foot?' },
    answerHtml: {
      he: '<p>מדדו מהעקב לבוהן והשאירו 5-10 מ"מ.</p>',
      en: '<p>Measure heel to toe and leave 5-10 mm.</p>',
    },
    order: 0,
    status: 'published',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }) as FaqItem

function render(
  props: Partial<Parameters<typeof FaqAudienceSection>[0]> = {}
): string {
  return renderToStaticMarkup(
    FaqAudienceSection({
      audience: 'women',
      title: 'נעלי נשים',
      items: [item()],
      locale: 'he',
      lng: 'he',
      ...props,
    }) as ReactElement
  )
}

describe('server-rendered accordion — heading and button contract', () => {
  it('renders each question as an h2 wrapping a button', () => {
    const html = render()
    assert.match(html, /<h2 class="faq-question-heading"><button/)
  })

  it('gives the button the required id, aria-expanded and aria-controls', () => {
    const html = render()
    assert.ok(html.includes('id="faq-question-how-to-measure"'))
    assert.ok(html.includes('aria-expanded="false"'))
    assert.ok(html.includes('aria-controls="faq-answer-how-to-measure"'))
    // type="button" keeps it from submitting any enclosing form.
    assert.ok(html.includes('<button type="button"'))
  })

  it('links the panel back to its question', () => {
    const html = render()
    assert.ok(html.includes('id="faq-answer-how-to-measure"'))
    assert.ok(html.includes('role="region"'))
    assert.ok(html.includes('aria-labelledby="faq-question-how-to-measure"'))
  })

  it('hides the chevron from screen readers', () => {
    assert.ok(render().includes('aria-hidden="true"'))
  })
})

describe('server-rendered accordion — content is in the initial HTML', () => {
  it('includes the full answer inside the collapsed panel', () => {
    // This is the whole point of the design: the panel ships `hidden`, not
    // empty. A crawler that never clicks still reads every answer.
    const html = render()
    assert.ok(html.includes('hidden'))
    assert.ok(html.includes('מדדו מהעקב לבוהן'))
  })

  it('renders the requested locale and falls back when it is blank', () => {
    const en = render({ locale: 'en', items: [item()] })
    assert.ok(en.includes('How do I measure my foot?'))
    assert.ok(en.includes('Measure heel to toe'))

    const fallback = render({
      locale: 'en',
      items: [item({ question: { he: 'רק עברית', en: '' }, answerHtml: { he: '<p>עברית</p>', en: '' } })],
    })
    assert.ok(fallback.includes('רק עברית'))
  })

  it('renders the short answer as a highlighted summary', () => {
    const html = render({
      items: [item({ shortAnswer: { he: 'תקציר קצר', en: 'Short summary' } })],
    })
    assert.ok(html.includes('faq-short-answer'))
    assert.ok(html.includes('תקציר קצר'))
  })
})

describe('server-rendered accordion — rich answer content', () => {
  const richItem = item({
    answerHtml: {
      he:
        '<h3>שלבים</h3><ol><li>אחד</li></ol><ul><li>נקודה</li></ul>' +
        '<p><strong>מודגש</strong> ו<em>נטוי</em></p>' +
        '<blockquote class="faq-callout">סיכום</blockquote>' +
        '<table><caption>מידות</caption><thead><tr><th scope="col">SAKO</th></tr></thead>' +
        '<tbody><tr><th scope="row">38</th><td>24.0</td></tr></tbody></table>' +
        '<p><a href="/he/collection/women">נשים</a></p>',
      en: '',
    },
  })

  it('supports h3, lists, bold, italic and links', () => {
    const html = render({ items: [richItem] })
    for (const fragment of ['<h3>', '<ol>', '<ul>', '<li>', '<strong>', '<em>', 'href="/he/collection/women"']) {
      assert.ok(html.includes(fragment), `missing ${fragment}`)
    }
  })

  it('keeps the callout class through the output sanitizer', () => {
    assert.ok(render({ items: [richItem] }).includes('faq-callout'))
  })

  it('renders semantic, accessible tables', () => {
    const html = render({ items: [richItem] })
    assert.ok(html.includes('<caption>'))
    assert.ok(html.includes('scope="col"'))
    assert.ok(html.includes('scope="row"'))
  })

  it('wraps tables in a focusable scroll region so they cannot break the page width', () => {
    const html = render({ items: [richItem] })
    assert.ok(html.includes('class="faq-table-scroll"'))
    assert.ok(html.includes('tabindex="0"'))
  })

  it('strips anything unsafe even if it reached the database', () => {
    // The write route sanitizes on input; this is the output-side safety net
    // for seeded or legacy rows.
    const html = render({
      items: [
        item({
          answerHtml: {
            he: '<p onclick="evil()">Text</p><script>alert(1)</script><h1>Big</h1><iframe src="/x"></iframe>',
            en: '',
          },
        }),
      ],
    })
    assert.ok(!html.includes('<script'))
    assert.ok(!html.includes('onclick'))
    assert.ok(!html.includes('<iframe'))
    // An h1 inside an answer is demoted, never rendered as a second h1.
    assert.ok(!html.includes('<h1'))
    assert.ok(html.includes('<h3>Big</h3>'))
  })
})

describe('server-rendered accordion — links and CTAs', () => {
  it('renders the CTA as a crawlable anchor with the locale prefix', () => {
    const html = render({
      cta: { label: { he: 'לצפייה בקולקציית הנשים', en: 'Shop women' }, href: '/collection/women' },
    })
    assert.ok(html.includes('href="/he/collection/women"'))
    assert.ok(html.includes('לצפייה בקולקציית הנשים'))
    // A real <a>, not a button with an onClick — it has to be crawlable and
    // middle-clickable.
    assert.match(html, /<a[^>]+class="faq-cta"/)
  })

  it('marks the men\'s CTA as secondary for analytics', () => {
    const html = render({
      audience: 'men',
      cta: { label: { he: 'לצפייה בקולקציית הגברים', en: 'Shop men' }, href: '/collection/men' },
    })
    assert.ok(html.includes('data-faq-cta="secondary"'))
  })

  it('renders related links as anchors', () => {
    const html = render({
      items: [
        item({
          relatedLinks: [{ label: { he: 'נשים', en: 'Women' }, href: '/collection/women' }],
        }),
      ],
    })
    assert.ok(html.includes('href="/he/collection/women"'))
    assert.ok(html.includes('data-faq-cta="related"'))
  })

  it('omits the CTA block entirely when none is configured', () => {
    assert.ok(!render().includes('faq-cta-row'))
  })
})

describe('server-rendered accordion — section and analytics wiring', () => {
  it('names the section without introducing a competing h2', () => {
    const html = render()
    assert.ok(html.includes('aria-labelledby="faq-section-women-title"'))
    assert.ok(html.includes('id="faq-section-women-title"'))
    // Every h2 on the page is a question; section titles are styled paragraphs
    // so the outline stays h1 -> h2 -> h3.
    assert.equal((html.match(/<h2/g) ?? []).length, 1)
  })

  it('exposes the analytics context as data attributes, not client props', () => {
    const html = render()
    assert.ok(html.includes('data-faq-slug="how-to-measure"'))
    assert.ok(html.includes('data-faq-audience="women"'))
    assert.ok(html.includes('data-faq-topic="sizing"'))
  })

  it('renders nothing for an empty section', () => {
    assert.equal(render({ items: [] }), '')
  })
})
