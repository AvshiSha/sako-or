import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildAnswerText,
  buildFaqPageStructuredData,
  faqAnswerToSchemaHtml,
  htmlToPlainText,
  serializeJsonLd,
  tablesToLists,
  type FaqSchemaItem,
} from '../faq-schema'

const BASE = 'https://www.sako-or.com'
const PAGE = 'https://www.sako-or.com/he/faq'
const OPTIONS = { locale: 'he' as const, pageUrl: PAGE, baseUrl: BASE }

const schemaItem = (overrides: Partial<FaqSchemaItem> = {}): FaqSchemaItem => ({
  slug: 'how-to-measure',
  question: 'How do I measure my foot at home?',
  answerHtml: '<p>Stand with your heel against a wall and mark your longest toe.</p>',
  ...overrides,
})

describe('htmlToPlainText', () => {
  it('strips tags and collapses whitespace', () => {
    assert.equal(htmlToPlainText('<p>Hello   <strong>world</strong></p>'), 'Hello world')
  })

  it('inserts a space at block boundaries so words do not fuse', () => {
    assert.equal(htmlToPlainText('<p>End</p><p>Next</p>'), 'End Next')
    assert.equal(htmlToPlainText('One<br>Two'), 'One Two')
  })

  it('resolves the entities the editor emits', () => {
    assert.equal(htmlToPlainText('<p>Tom&nbsp;&amp;&nbsp;Jerry</p>'), 'Tom & Jerry')
  })
})

describe('tablesToLists', () => {
  const sizeTable =
    '<table><caption>Size conversion</caption>' +
    '<thead><tr><th scope="col">SAKO</th><th scope="col">US</th><th scope="col">CM</th></tr></thead>' +
    '<tbody><tr><td>38</td><td>8</td><td>24.0</td></tr>' +
    '<tr><td>39</td><td>9</td><td>24.5</td></tr></tbody></table>'

  it('rewrites rows as list items, since tables are not an allowed schema tag', () => {
    const out = tablesToLists(sizeTable)
    assert.ok(!out.includes('<table'))
    assert.ok(out.includes('<ul>'))
    assert.equal((out.match(/<li>/g) ?? []).length, 2)
  })

  it('labels each cell with its column header so a row survives out of context', () => {
    // Stripping the tags instead would fuse this into "38 8 24.0 39 9 24.5".
    const out = tablesToLists(sizeTable)
    assert.ok(out.includes('SAKO: 38'))
    assert.ok(out.includes('US: 8'))
    assert.ok(out.includes('CM: 24.0'))
  })

  it('keeps the caption as a leading paragraph', () => {
    assert.ok(tablesToLists(sizeTable).includes('<p>Size conversion</p>'))
  })

  it('handles a table with no header row', () => {
    const out = tablesToLists('<table><tbody><tr><td>A</td><td>B</td></tr></tbody></table>')
    assert.ok(out.includes('<li>A — B</li>'))
  })

  it('drops an empty table rather than emitting an empty list', () => {
    assert.equal(tablesToLists('<table></table>'), '')
  })
})

describe('faqAnswerToSchemaHtml', () => {
  it('keeps the tags schema consumers accept', () => {
    const out = faqAnswerToSchemaHtml(
      '<p>Intro</p><h3>Steps</h3><ol><li>One</li></ol><ul><li>Two</li></ul><strong>Bold</strong>',
      BASE
    )
    for (const tag of ['<p>', '<h3>', '<ol>', '<ul>', '<li>', '<strong>']) {
      assert.ok(out.includes(tag), `expected ${tag} to survive`)
    }
  })

  it('unwraps disallowed tags without losing their text', () => {
    const out = faqAnswerToSchemaHtml('<blockquote class="faq-callout">Summary</blockquote>', BASE)
    assert.ok(!out.includes('blockquote'))
    assert.ok(out.includes('Summary'))
  })

  it('strips every attribute except a[href]', () => {
    const out = faqAnswerToSchemaHtml('<p class="x" style="color:red">Text</p>', BASE)
    assert.equal(out, '<p>Text</p>')
  })

  it('absolutizes relative links, since the consumer has no page context', () => {
    const out = faqAnswerToSchemaHtml('<a href="/he/collection/women">Women</a>', BASE)
    assert.ok(out.includes(`href="${BASE}/he/collection/women"`))
  })

  it('keeps absolute links as-is', () => {
    const out = faqAnswerToSchemaHtml('<a href="https://example.com/x">X</a>', BASE)
    assert.ok(out.includes('href="https://example.com/x"'))
  })

  it('drops a non-navigational href but keeps the text', () => {
    const out = faqAnswerToSchemaHtml('<a href="javascript:alert(1)">Click</a>', BASE)
    assert.ok(!out.includes('javascript:'))
    assert.ok(out.includes('Click'))
  })

  it('removes images and embeds', () => {
    const out = faqAnswerToSchemaHtml('<p>A</p><img src="/x.png" alt="x"><iframe src="/y"></iframe>', BASE)
    assert.ok(!out.includes('<img'))
    assert.ok(!out.includes('<iframe'))
    assert.ok(out.includes('A'))
  })

  it('returns an empty string for empty input', () => {
    assert.equal(faqAnswerToSchemaHtml('', BASE), '')
    assert.equal(faqAnswerToSchemaHtml('   ', BASE), '')
  })
})

describe('buildAnswerText', () => {
  it('returns the full answer when it is within the cap', () => {
    const text = buildAnswerText(schemaItem(), BASE)
    assert.ok(text.includes('heel against a wall'))
  })

  it('falls back to the short answer plus the first paragraphs when over the cap', () => {
    const long = '<p>One</p><p>Two</p>' + '<p>' + 'x'.repeat(6000) + '</p>'
    const text = buildAnswerText(
      schemaItem({ answerHtml: long, shortAnswer: 'Measure heel to toe.' }),
      BASE
    )
    assert.ok(text.length <= 5000)
    assert.ok(text.includes('Measure heel to toe.'))
    assert.ok(text.includes('<p>One</p>'))
    assert.ok(text.includes('<p>Two</p>'))
  })

  it('hard-truncates rather than emitting an answerless question', () => {
    const long = '<p>' + 'x'.repeat(9000) + '</p>'
    const text = buildAnswerText(schemaItem({ answerHtml: long }), BASE)
    assert.ok(text.length > 0)
    assert.ok(text.length <= 5000)
  })
})

describe('buildFaqPageStructuredData', () => {
  it('returns null for an empty list rather than an empty FAQPage', () => {
    assert.equal(buildFaqPageStructuredData([], OPTIONS), null)
  })

  it('emits one Question per item, in the order given', () => {
    const schema = buildFaqPageStructuredData(
      [schemaItem({ slug: 'a', question: 'A?' }), schemaItem({ slug: 'b', question: 'B?' })],
      OPTIONS
    )
    const entities = schema?.mainEntity as Array<Record<string, unknown>>
    assert.equal(entities.length, 2)
    assert.deepEqual(entities.map((e) => e.name), ['A?', 'B?'])
  })

  it('uses the schema.org types the spec requires', () => {
    const schema = buildFaqPageStructuredData([schemaItem()], OPTIONS)!
    assert.equal(schema['@context'], 'https://schema.org')
    assert.equal(schema['@type'], 'FAQPage')
    const entity = (schema.mainEntity as Array<Record<string, unknown>>)[0]
    assert.equal(entity['@type'], 'Question')
    const answer = entity.acceptedAnswer as Record<string, unknown>
    assert.equal(answer['@type'], 'Answer')
    assert.ok(typeof answer.text === 'string' && answer.text.length > 0)
  })

  it('anchors each Question at its on-page id', () => {
    const schema = buildFaqPageStructuredData([schemaItem({ slug: 'leather-care' })], OPTIONS)!
    const entity = (schema.mainEntity as Array<Record<string, unknown>>)[0]
    assert.equal(entity['@id'], `${PAGE}#faq-question-leather-care`)
  })

  it('never leaves markup in the Question name', () => {
    const schema = buildFaqPageStructuredData(
      [schemaItem({ question: '<strong>How</strong> do I measure?' })],
      OPTIONS
    )!
    const entity = (schema.mainEntity as Array<Record<string, unknown>>)[0]
    assert.equal(entity.name, 'How do I measure?')
  })

  it('sets inLanguage from the locale', () => {
    assert.equal(buildFaqPageStructuredData([schemaItem()], OPTIONS)!.inLanguage, 'he-IL')
    assert.equal(
      buildFaqPageStructuredData([schemaItem()], { ...OPTIONS, locale: 'en' })!.inLanguage,
      'en-US'
    )
  })

  it('skips an item with no question or no answer', () => {
    const schema = buildFaqPageStructuredData(
      [
        schemaItem({ slug: 'ok' }),
        schemaItem({ slug: 'no-question', question: '' }),
        schemaItem({ slug: 'no-answer', answerHtml: '' }),
      ],
      OPTIONS
    )!
    assert.equal((schema.mainEntity as unknown[]).length, 1)
  })

  it('returns null when every item is unusable', () => {
    assert.equal(buildFaqPageStructuredData([schemaItem({ question: '' })], OPTIONS), null)
  })
})

describe('serializeJsonLd', () => {
  it('escapes < so an answer cannot close the script tag early', () => {
    const out = serializeJsonLd({ text: 'before </script><img src=x onerror=alert(1)> after' })
    assert.ok(!out.includes('</script>'))
    assert.ok(out.includes('\\u003c'))
  })

  it('round-trips to the identical value', () => {
    const value = { a: '<p>Hi</p>', b: [1, 2] }
    assert.deepEqual(JSON.parse(serializeJsonLd(value)), value)
  })
})
