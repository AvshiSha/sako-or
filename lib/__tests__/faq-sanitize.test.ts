import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  FAQ_CALLOUT_CLASS,
  faqAnswerHadDemotedHeadings,
  sanitizeFaqAnswerHtml,
} from '../sanitize-html'

describe('sanitizeFaqAnswerHtml — heading levels', () => {
  it('demotes h1 and h2 to h3, keeping the text', () => {
    // The page owns the h1 and each question is an h2, so an answer may not
    // introduce either. Demotion preserves the wording; stripping would not.
    assert.equal(sanitizeFaqAnswerHtml('<h1>Measuring at home</h1>'), '<h3>Measuring at home</h3>')
    assert.equal(sanitizeFaqAnswerHtml('<h2>Measuring at home</h2>'), '<h3>Measuring at home</h3>')
  })

  it('leaves h3 alone', () => {
    assert.equal(sanitizeFaqAnswerHtml('<h3>Step by step</h3>'), '<h3>Step by step</h3>')
  })
})

describe('faqAnswerHadDemotedHeadings', () => {
  it('reports whether a demotion will happen', () => {
    assert.equal(faqAnswerHadDemotedHeadings('<h2>Hi</h2>'), true)
    assert.equal(faqAnswerHadDemotedHeadings('<H1>Hi</H1>'), true)
    assert.equal(faqAnswerHadDemotedHeadings('<h3>Hi</h3>'), false)
    assert.equal(faqAnswerHadDemotedHeadings('<p>Hi</p>'), false)
    assert.equal(faqAnswerHadDemotedHeadings(''), false)
  })
})

describe('sanitizeFaqAnswerHtml — dangerous input', () => {
  it('strips script tags and their contents', () => {
    const out = sanitizeFaqAnswerHtml('<p>Before</p><script>alert(1)</script><p>After</p>')
    assert.ok(!out.includes('<script'))
    assert.ok(!out.includes('alert(1)'))
    assert.ok(out.includes('Before'))
    assert.ok(out.includes('After'))
  })

  it('strips inline event handlers', () => {
    const out = sanitizeFaqAnswerHtml('<p onclick="steal()">Text</p>')
    assert.ok(!out.includes('onclick'))
    assert.ok(out.includes('Text'))
  })

  it('strips javascript: hrefs but keeps the link text', () => {
    const out = sanitizeFaqAnswerHtml('<a href="javascript:alert(1)">Click</a>')
    assert.ok(!out.includes('javascript:'))
    assert.ok(out.includes('Click'))
  })

  it('strips iframes entirely, including YouTube', () => {
    // Allowed in general CMS content, deliberately not in a collapsed FAQ panel.
    const out = sanitizeFaqAnswerHtml('<iframe src="https://www.youtube.com/embed/x"></iframe>')
    assert.ok(!out.includes('<iframe'))
  })
})

describe('sanitizeFaqAnswerHtml — links', () => {
  it('marks external links target=_blank with a safe rel', () => {
    const out = sanitizeFaqAnswerHtml('<a href="https://example.com">Example</a>')
    assert.ok(out.includes('target="_blank"'))
    assert.ok(out.includes('rel="noopener noreferrer"'))
  })

  it('leaves internal links as same-tab navigations', () => {
    const out = sanitizeFaqAnswerHtml('<a href="/he/collection/women">Women</a>')
    assert.ok(!out.includes('target="_blank"'))
    assert.ok(out.includes('href="/he/collection/women"'))
  })
})

describe('sanitizeFaqAnswerHtml — rich content the editor must support', () => {
  it('keeps semantic table markup', () => {
    const table =
      '<table><caption>Size conversion</caption><thead><tr><th scope="col">SAKO</th>' +
      '<th scope="col">US</th></tr></thead><tbody><tr><th scope="row">38</th><td>8</td></tr></tbody></table>'
    const out = sanitizeFaqAnswerHtml(table)
    for (const fragment of ['<table>', '<caption>', '<thead>', '<tbody>', '<tr>', '<td>']) {
      assert.ok(out.includes(fragment), `expected output to keep ${fragment}`)
    }
    // scope is the difference between an accessible data table and a grid of
    // unlabelled numbers, so it has to survive sanitization.
    assert.ok(out.includes('scope="col"'))
    assert.ok(out.includes('scope="row"'))
  })

  it('keeps bullet and numbered lists', () => {
    const out = sanitizeFaqAnswerHtml('<ul><li>One</li></ul><ol><li>First</li></ol>')
    assert.ok(out.includes('<ul>'))
    assert.ok(out.includes('<ol>'))
    assert.ok(out.includes('<li>'))
  })

  it('keeps bold and italic', () => {
    const out = sanitizeFaqAnswerHtml('<p><strong>Bold</strong> and <em>italic</em></p>')
    assert.ok(out.includes('<strong>'))
    assert.ok(out.includes('<em>'))
  })
})

describe('sanitizeFaqAnswerHtml — class allow-list', () => {
  it('keeps the callout class', () => {
    const out = sanitizeFaqAnswerHtml(
      `<blockquote class="${FAQ_CALLOUT_CLASS}">Summary</blockquote>`
    )
    assert.ok(out.includes(FAQ_CALLOUT_CLASS))
    assert.ok(out.includes('Summary'))
  })

  it('drops any other class, on any element', () => {
    const out = sanitizeFaqAnswerHtml('<blockquote class="evil">Text</blockquote><p class="fixed">P</p>')
    assert.ok(!out.includes('evil'))
    assert.ok(!out.includes('"fixed"'))
    assert.ok(out.includes('Text'))
    assert.ok(out.includes('P'))
  })
})

describe('sanitizeFaqAnswerHtml — inline styles', () => {
  it('keeps text-align, which the editor emits', () => {
    const out = sanitizeFaqAnswerHtml('<p style="text-align: center">Centered</p>')
    assert.ok(out.includes('text-align'))
  })

  it('drops arbitrary CSS', () => {
    const out = sanitizeFaqAnswerHtml('<p style="color:red;position:fixed">Text</p>')
    assert.ok(!out.includes('color'))
    assert.ok(!out.includes('position'))
  })
})

describe('sanitizeFaqAnswerHtml — empty input', () => {
  it('returns an empty string rather than stray markup', () => {
    assert.equal(sanitizeFaqAnswerHtml(''), '')
    assert.equal(sanitizeFaqAnswerHtml('   '), '')
    assert.equal(sanitizeFaqAnswerHtml('<p></p>'), '')
  })
})
