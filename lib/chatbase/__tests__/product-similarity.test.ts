import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { ProductCandidate } from '../product-query'
import { compareScored, scoreSimilarity, type ScoredItem } from '../product-scoring'

function makeCandidate(overrides: Partial<ProductCandidate> = {}): ProductCandidate {
  return {
    sku: '1000-0001',
    categories_path: ['women', 'shoes', 'sandals'],
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
    heelType: 'block_heel',
    closureType: 'buckle',
    heelHeight: '5',
    sizeFit: 'true_to_size',
    footWidthFit: 'most_widths',
    archFit: 'most_arch_types',
    adjustableFeatures: ['buckle'],
    shortTitle_en: 'Sandal',
    shortTitle_he: 'סנדל',
    title_en: 'BRAND',
    title_he: 'BRAND',
    subSubCategory_en: 'Sandals',
    subSubCategory_he: 'סנדלים',
    ...overrides,
  }
}

const source = makeCandidate()

const score = (candidate: ProductCandidate, candidatePrice = 500) =>
  scoreSimilarity({ source, sourcePrice: 500, candidate, candidatePrice })

describe('scoreSimilarity', () => {
  it('is deterministic', () => {
    const twin = makeCandidate({ sku: '2' })
    assert.deepEqual(score(twin), score(twin))
  })

  it('scores an identical shoe at the top of the range', () => {
    assert.equal(score(makeCandidate({ sku: '2' })).score, 100)
  })

  it('ranks the same category above a different one', () => {
    const same = score(makeCandidate({ sku: '2' }))
    const different = score(
      makeCandidate({ sku: '3', categories_path: ['women', 'shoes', 'boots'] })
    )
    assert.ok(same.score > different.score)
  })

  it('treats an outlet twin as the same category', () => {
    const outlet = score(
      makeCandidate({ sku: '2', categories_path: ['women', 'outlet', 'outlet-sandals'] })
    )
    assert.ok(outlet.matched.includes('category'))
  })

  it('rewards a closer heel height rather than only an exact match', () => {
    const near = score(makeCandidate({ sku: '2', heelHeight: '6' }))
    const far = score(makeCandidate({ sku: '3', heelHeight: '11' }))
    assert.ok(near.score > far.score)
    assert.ok(near.matched.includes('heelHeight'))
    assert.ok(far.differing.includes('heelHeight'))
  })

  it('rewards a closer price', () => {
    const near = score(makeCandidate({ sku: '2' }), 520)
    const far = score(makeCandidate({ sku: '3' }), 2000)
    assert.ok(near.score > far.score)
  })

  it('never treats an unknown specification as similarity', () => {
    // A shoe nobody has documented is not thereby "similar to everything".
    const unknown = score(
      makeCandidate({ sku: '2', toeShape: null, closureType: null, soleType: null })
    )
    assert.equal(unknown.matched.includes('toeShapes'), false)
    assert.equal(unknown.differing.includes('toeShapes'), false)
  })

  it('reports what differs, for the agent to voice honestly', () => {
    const different = score(makeCandidate({ sku: '2', upperMaterial: ['suede'] }))
    assert.ok(different.differing.includes('upperMaterials'))
    assert.equal(different.matched.includes('upperMaterials'), false)
  })

  it('reports shared material as a match when the lists overlap', () => {
    const overlapping = score(
      makeCandidate({ sku: '2', upperMaterial: ['nappa_leather', 'suede'] })
    )
    assert.ok(overlapping.matched.includes('upperMaterials'))
  })

  it('keeps merchandising out of the similarity score', () => {
    const plain = score(makeCandidate({ sku: '2' }))
    const promoted = score(makeCandidate({ sku: '3', featured: true, isNew: true }))
    assert.equal(promoted.score, plain.score)
    assert.equal(promoted.merchandisingRank, 2)
  })
})

describe('ordering of alternatives', () => {
  const item = (sku: string, score: number, merchandisingRank = 0): ScoredItem<string> => ({
    item: sku,
    sku,
    createdAt: new Date('2026-01-01'),
    score,
    merchandisingRank,
  })

  it('never lets a promoted lookalike outrank a closer alternative', () => {
    const sorted = [item('promoted', 70, 2), item('closer', 71, 0)].sort(compareScored)
    assert.deepEqual(sorted.map((s) => s.sku), ['closer', 'promoted'])
  })

  it('is a total order, so the same request returns the same list', () => {
    const a = [item('b', 80), item('a', 80)].sort(compareScored)
    const b = [item('a', 80), item('b', 80)].sort(compareScored)
    assert.deepEqual(a.map((s) => s.sku), b.map((s) => s.sku))
  })
})
