import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseCmValue } from '../bag-derived'

/**
 * The backfill's parser is the only thing standing between messy legacy text
 * and a number the site will present as a fact, so its refusals matter as much
 * as its successes.
 */
describe('parseCmValue', () => {
  it('reads a bare number', () => {
    assert.equal(parseCmValue('25'), 25)
  })

  it('reads the unit suffixes actually present in the catalogue', () => {
    assert.equal(parseCmValue('25cm'), 25)
    assert.equal(parseCmValue('25 cm'), 25)
    assert.equal(parseCmValue('25 ס"מ'), 25)
    assert.equal(parseCmValue('25 ס״מ'), 25)
    assert.equal(parseCmValue('25 CM'), 25)
  })

  it('reads decimals, with either separator', () => {
    assert.equal(parseCmValue('25.5cm'), 25.5)
    assert.equal(parseCmValue('25,5 cm'), 25.5)
  })

  it('tolerates surrounding whitespace and a trailing period', () => {
    assert.equal(parseCmValue('  25 cm.  '), 25)
  })

  it('refuses a range rather than picking one end', () => {
    assert.equal(parseCmValue('20-25'), undefined)
    assert.equal(parseCmValue('20 - 25 cm'), undefined)
  })

  it('refuses two measurements crammed into one field', () => {
    assert.equal(parseCmValue('25 x 13'), undefined)
    assert.equal(parseCmValue('25x13cm'), undefined)
  })

  it('refuses a hedged value rather than dropping the hedge', () => {
    assert.equal(parseCmValue('approx 25'), undefined)
    assert.equal(parseCmValue('~25cm'), undefined)
    assert.equal(parseCmValue('בערך 25 ס"מ'), undefined)
  })

  it('refuses empty, missing and non-numeric text', () => {
    assert.equal(parseCmValue(''), undefined)
    assert.equal(parseCmValue('   '), undefined)
    assert.equal(parseCmValue(undefined), undefined)
    assert.equal(parseCmValue(null), undefined)
    assert.equal(parseCmValue('medium'), undefined)
  })

  it('refuses values outside a plausible range for a bag', () => {
    assert.equal(parseCmValue('0'), undefined)
    assert.equal(parseCmValue('0cm'), undefined)
    assert.equal(parseCmValue('500cm'), undefined)
  })
})
