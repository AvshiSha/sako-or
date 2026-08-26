import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { wrapFaqTables } from '../faq-html'

const TABLE = '<table><thead><tr><th scope="col">SAKO</th></tr></thead><tbody><tr><td>38</td></tr></tbody></table>'

describe('wrapFaqTables', () => {
  it('leaves table-free HTML untouched', () => {
    const html = '<p>No tables here</p><ul><li>One</li></ul>'
    assert.equal(wrapFaqTables(html, 'Q'), html)
  })

  it('handles empty input', () => {
    assert.equal(wrapFaqTables('', 'Q'), '')
  })

  it('wraps a table in a focusable, labelled scroll region', () => {
    const out = wrapFaqTables(TABLE, 'How do I choose a size?')
    assert.ok(out.startsWith('<div class="faq-table-scroll"'))
    assert.ok(out.includes('role="region"'))
    // A region that scrolls must be reachable by keyboard, or the overflowing
    // columns are unreachable without a mouse.
    assert.ok(out.includes('tabindex="0"'))
    assert.ok(out.includes('aria-label="How do I choose a size?"'))
    assert.ok(out.endsWith('</div>'))
  })

  it('leaves the table markup itself intact', () => {
    const out = wrapFaqTables(TABLE, 'Q')
    assert.ok(out.includes(TABLE))
    assert.ok(out.includes('scope="col"'))
  })

  it('wraps every table, not just the first', () => {
    const out = wrapFaqTables(`${TABLE}<p>Between</p>${TABLE}`, 'Q')
    assert.equal((out.match(/faq-table-scroll/g) ?? []).length, 2)
    assert.ok(out.includes('<p>Between</p>'))
  })

  it('escapes the label so a question with quotes cannot break out of the attribute', () => {
    const out = wrapFaqTables(TABLE, 'Is 38 "true to size"? <b>')
    assert.ok(!out.includes('aria-label="Is 38 "'))
    assert.ok(out.includes('&quot;'))
    assert.ok(out.includes('&lt;b&gt;'))
  })
})
