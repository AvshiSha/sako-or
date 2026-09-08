import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { ProductCandidate } from '../product-query'
import type { ProductVariant } from '../product-availability'
import {
  compareScored,
  merchandisingRank,
  scoreSearchMatch,
  type ScoredItem,
} from '../product-scoring'

function makeCandidate(overrides: Partial<ProductCandidate> = {}): ProductCandidate {
  return {
    sku: '1000-0001',
    categories_path: ['women', 'shoes', 'pumps'],
    price: 500,
    salePrice: null,
    featured: false,
    isNew: false,
    createdAt: new Date('2026-01-01'),
    upperMaterial: ['nappa_leather'],
    lining: 'leather',
    insole: 'leather',
    outsole: 'rubber',
    soleType: 'flat',
    toeShape: 'round',
    heelType: 'flat',
    closureType: 'no_closure',
    heelHeight: '3',
    sizeFit: 'true_to_size',
    footWidthFit: 'most_widths',
    archFit: 'most_arch_types',
    adjustableFeatures: ['no_adjustment'],
    shortTitle_en: 'Leather slipper',
    shortTitle_he: 'כפכף עור',
    title_en: 'BRAND',
    title_he: 'BRAND',
    subSubCategory_en: 'Pumps',
    subSubCategory_he: 'נעלי סירה',
    ...overrides,
  }
}

function makeVariant(stockBySize: Record<string, number>): ProductVariant {
  return { colorSlug: 'black', images: [], stockBySize } as ProductVariant
}

const baseInput = {
  candidate: makeCandidate(),
  variant: makeVariant({ '39': 2, '40': 1 }),
  requestedSizes: [] as string[],
  requestedCategories: [] as string[],
  fitRequested: false,
  price: 500,
}

describe('scoreSearchMatch', () => {
  it('is deterministic', () => {
    const a = scoreSearchMatch(baseInput)
    const b = scoreSearchMatch(baseInput)
    assert.deepEqual(a, b)
  })

  it('produces a score between 0 and 100', () => {
    const { score } = scoreSearchMatch(baseInput)
    assert.ok(score >= 0 && score <= 100, `score ${score} out of range`)
  })

  it('rewards having every requested size over only some', () => {
    const both = scoreSearchMatch({
      ...baseInput,
      requestedSizes: ['39', '40'],
      variant: makeVariant({ '39': 1, '40': 1 }),
    })
    const one = scoreSearchMatch({
      ...baseInput,
      requestedSizes: ['39', '40'],
      variant: makeVariant({ '39': 1, '40': 0 }),
    })
    assert.ok(both.score > one.score, `${both.score} should beat ${one.score}`)
  })

  it('rewards a cheaper product within the requested price range', () => {
    const cheap = scoreSearchMatch({ ...baseInput, price: 100, maxPrice: 500 })
    const dear = scoreSearchMatch({ ...baseInput, price: 490, maxPrice: 500 })
    assert.ok(cheap.score > dear.score)
  })

  it('ignores price when no ceiling was given', () => {
    const cheap = scoreSearchMatch({ ...baseInput, price: 100 })
    const dear = scoreSearchMatch({ ...baseInput, price: 900 })
    assert.equal(cheap.score, dear.score)
  })

  it('prefers accommodating fit values when the customer asked about fit', () => {
    const accommodating = scoreSearchMatch({ ...baseInput, fitRequested: true })
    const narrow = scoreSearchMatch({
      ...baseInput,
      fitRequested: true,
      candidate: makeCandidate({ footWidthFit: 'narrow', archFit: 'low', sizeFit: 'runs_small' }),
    })
    assert.ok(accommodating.score > narrow.score)
  })

  it('does not let fit quality matter when fit was not asked about', () => {
    const accommodating = scoreSearchMatch(baseInput)
    const narrow = scoreSearchMatch({
      ...baseInput,
      candidate: makeCandidate({ footWidthFit: 'narrow', archFit: 'low', sizeFit: 'runs_small' }),
    })
    assert.equal(accommodating.score, narrow.score)
  })

  it('rewards a fully specified product over a sparse one', () => {
    const sparse = scoreSearchMatch({
      ...baseInput,
      candidate: makeCandidate({
        lining: null,
        insole: null,
        outsole: null,
        soleType: null,
        toeShape: null,
        heelType: null,
        closureType: null,
        heelHeight: null,
        sizeFit: 'undefined',
        footWidthFit: 'undefined',
        archFit: 'undefined',
        upperMaterial: [],
      }),
    })
    assert.ok(scoreSearchMatch(baseInput).score > sparse.score)
  })

  it('scores an exact category above a merely related one', () => {
    const exact = scoreSearchMatch({ ...baseInput, requestedCategories: ['pumps'] })
    const related = scoreSearchMatch({
      ...baseInput,
      requestedCategories: ['boots'],
    })
    assert.ok(exact.score > related.score)
  })

  it('treats an outlet category as the same key as its regular twin', () => {
    const outlet = scoreSearchMatch({
      ...baseInput,
      candidate: makeCandidate({ categories_path: ['women', 'outlet', 'outlet-pumps'] }),
      requestedCategories: ['pumps'],
    })
    assert.equal(outlet.score, scoreSearchMatch({ ...baseInput, requestedCategories: ['pumps'] }).score)
  })

  it('scores everything equally when no filter makes a component relevant', () => {
    const a = scoreSearchMatch(baseInput)
    const b = scoreSearchMatch({ ...baseInput, candidate: makeCandidate({ sku: '2' }) })
    assert.equal(a.score, b.score)
  })
})

describe('merchandising', () => {
  it('is never folded into the score', () => {
    const plain = scoreSearchMatch(baseInput)
    const promoted = scoreSearchMatch({
      ...baseInput,
      candidate: makeCandidate({ featured: true, isNew: true }),
    })
    assert.equal(promoted.score, plain.score, 'featured/new must not change the score')
    assert.ok(promoted.merchandisingRank > plain.merchandisingRank)
  })

  it('counts featured and new one point each', () => {
    assert.equal(merchandisingRank(makeCandidate()), 0)
    assert.equal(merchandisingRank(makeCandidate({ featured: true })), 1)
    assert.equal(merchandisingRank(makeCandidate({ featured: true, isNew: true })), 2)
  })
})

describe('compareScored', () => {
  const item = (
    sku: string,
    score: number,
    merchandisingRank = 0,
    createdAt = new Date('2026-01-01')
  ): ScoredItem<string> => ({ item: sku, sku, createdAt, score, merchandisingRank })

  it('orders by score first', () => {
    const sorted = [item('a', 10), item('b', 90)].sort(compareScored)
    assert.deepEqual(sorted.map((s) => s.sku), ['b', 'a'])
  })

  it('never lets a promoted product outrank a better-fitting one', () => {
    // The rule the brief calls out: merchandising must not promote an
    // unsuitable shoe above a suitable one.
    const sorted = [item('promoted', 60, 2), item('better-fit', 61, 0)].sort(compareScored)
    assert.deepEqual(sorted.map((s) => s.sku), ['better-fit', 'promoted'])
  })

  it('uses merchandising only to break an exact tie', () => {
    const sorted = [item('plain', 80, 0), item('featured', 80, 2)].sort(compareScored)
    assert.deepEqual(sorted.map((s) => s.sku), ['featured', 'plain'])
  })

  it('breaks a remaining tie by recency then SKU, so the order is total', () => {
    const older = item('a', 80, 0, new Date('2025-01-01'))
    const newer = item('b', 80, 0, new Date('2026-06-01'))
    assert.deepEqual([older, newer].sort(compareScored).map((s) => s.sku), ['b', 'a'])

    const same = new Date('2026-01-01')
    const sorted = [item('z', 80, 0, same), item('a', 80, 0, same)].sort(compareScored)
    assert.deepEqual(sorted.map((s) => s.sku), ['a', 'z'])
  })
})
