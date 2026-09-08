import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  categoryKeyForPath,
  footwearCategoryKeys,
  isFootwearPath,
  isOutletPath,
  resolveCategoryScope,
} from '../product-scope'

describe('isFootwearPath', () => {
  it('accepts both footwear sections', () => {
    assert.equal(isFootwearPath(['women', 'shoes', 'pumps']), true)
    assert.equal(isFootwearPath(['women', 'outlet', 'outlet-pumps']), true)
    assert.equal(isFootwearPath(['men', 'shoes', 'moccasins']), true)
  })

  it('rejects accessories, which is where bags and belts live', () => {
    assert.equal(isFootwearPath(['women', 'accessories', 'bags']), false)
    assert.equal(isFootwearPath(['women', 'accessories', 'belts']), false)
    assert.equal(isFootwearPath(['men', 'accessories', 'belts']), false)
  })

  it('rejects a path with no section segment', () => {
    assert.equal(isFootwearPath(['women']), false)
    assert.equal(isFootwearPath([]), false)
  })

  it('would admit a new shoe subcategory without a code change', () => {
    assert.equal(isFootwearPath(['women', 'shoes', 'brand-new-style']), true)
  })
})

describe('isOutletPath', () => {
  it('distinguishes outlet from regular', () => {
    assert.equal(isOutletPath(['women', 'outlet', 'outlet-pumps']), true)
    assert.equal(isOutletPath(['women', 'shoes', 'pumps']), false)
  })
})

describe('footwearCategoryKeys', () => {
  it('excludes bags, belts and accessories', () => {
    const keys = footwearCategoryKeys('women')
    for (const excluded of ['bags', 'belts', 'accessories', 'outlet']) {
      assert.equal(keys.includes(excluded), false, `${excluded} must not be selectable`)
    }
  })

  it('includes the real footwear categories', () => {
    const keys = footwearCategoryKeys('women')
    for (const included of ['pumps', 'boots', 'sandals', 'slippers', 'sneakers']) {
      assert.ok(keys.includes(included), `${included} should be selectable`)
    }
  })

  it('is scoped per gender', () => {
    const men = footwearCategoryKeys('men')
    assert.ok(men.includes('moccasins'))
    assert.equal(men.includes('pumps'), false)
    assert.equal(men.includes('belts'), false)
  })
})

describe('resolveCategoryScope', () => {
  it('expands a key to regular and outlet together', () => {
    const scope = resolveCategoryScope(['pumps'], 'women')
    assert.deepEqual(scope.paths.sort(), ['women/outlet/outlet-pumps', 'women/shoes/pumps'])
    assert.deepEqual(scope.unknown, [])
  })

  it('drops a disabled regular category but keeps its outlet twin', () => {
    const scope = resolveCategoryScope(['ballerina-&-flats'], 'women')
    assert.deepEqual(scope.paths, ['women/outlet/outlet-ballerina-&-flats'])
  })

  it('maps slippers to the flip-flops outlet, which is the real pairing', () => {
    const scope = resolveCategoryScope(['slippers'], 'women')
    assert.ok(scope.paths.includes('women/outlet/outlet-flip-flops'))
  })

  it('reports unknown keys instead of ignoring them', () => {
    // Ignoring one would widen the search past what the customer asked for.
    const scope = resolveCategoryScope(['pumps', 'bags', 'umbrellas'], 'women')
    assert.deepEqual(scope.unknown.sort(), ['bags', 'umbrellas'])
  })

  it('never crosses gender', () => {
    assert.deepEqual(resolveCategoryScope(['pumps'], 'men').unknown, ['pumps'])
  })

  it('de-duplicates overlapping requests', () => {
    const scope = resolveCategoryScope(['pumps', 'pumps'], 'women')
    assert.equal(scope.paths.length, 2)
  })
})

describe('categoryKeyForPath', () => {
  it('collapses an outlet leaf onto its regular key', () => {
    assert.equal(categoryKeyForPath(['women', 'outlet', 'outlet-pumps']), 'pumps')
    assert.equal(categoryKeyForPath(['women', 'shoes', 'pumps']), 'pumps')
  })

  it('is undefined for an empty path', () => {
    assert.equal(categoryKeyForPath([]), undefined)
  })
})
