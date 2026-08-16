import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  deriveBagCapacityLiters,
  deriveBagSizeCategory,
  deriveFitsA4,
  deriveFitsTablet,
  deriveFitsLaptopInches,
  deriveBagFacts,
  findDimensionAnomalies,
} from '../bag-derived'

describe('deriveBagCapacityLiters', () => {
  it('multiplies the three dimensions and converts cm³ to litres', () => {
    assert.equal(deriveBagCapacityLiters(18, 25, 13), 5.9)
  })

  it('rounds to a single decimal place', () => {
    // 20 * 30 * 10 = 6000 cm³ = exactly 6 L
    assert.equal(deriveBagCapacityLiters(20, 30, 10), 6)
  })

  it('returns null when any dimension is missing', () => {
    assert.equal(deriveBagCapacityLiters(18, 25, null), null)
    assert.equal(deriveBagCapacityLiters(18, undefined, 13), null)
    assert.equal(deriveBagCapacityLiters(null, null, null), null)
  })

  it('treats zero and negative values as unmeasured rather than real', () => {
    assert.equal(deriveBagCapacityLiters(0, 25, 13), null)
    assert.equal(deriveBagCapacityLiters(18, -5, 13), null)
  })
})

describe('deriveBagSizeCategory', () => {
  it('maps each bucket at its boundaries', () => {
    assert.equal(deriveBagSizeCategory(1.9), 'mini')
    assert.equal(deriveBagSizeCategory(2), 'small')
    assert.equal(deriveBagSizeCategory(4.9), 'small')
    assert.equal(deriveBagSizeCategory(5), 'medium')
    assert.equal(deriveBagSizeCategory(11.9), 'medium')
    assert.equal(deriveBagSizeCategory(12), 'large')
    assert.equal(deriveBagSizeCategory(25), 'large')
    assert.equal(deriveBagSizeCategory(25.1), 'oversized')
  })

  it('returns null for unknown capacity', () => {
    assert.equal(deriveBagSizeCategory(null), null)
    assert.equal(deriveBagSizeCategory(undefined), null)
  })
})

describe('deriveFitsA4', () => {
  it('accepts a bag just large enough, upright', () => {
    assert.equal(deriveFitsA4(31, 23), true)
  })

  it('rejects a bag just below the threshold', () => {
    assert.equal(deriveFitsA4(30, 22), false)
  })

  it('accepts a wide, short bag that takes A4 sideways', () => {
    assert.equal(deriveFitsA4(23, 31), true)
  })

  it('gives a soft bag some tolerance a structured one does not get', () => {
    // 30.5 x 22.5 is just under the rigid threshold of 31.0 x 22.3
    assert.equal(deriveFitsA4(30.5, 22.5, 'structured'), false)
    assert.equal(deriveFitsA4(30.5, 22.5, 'soft'), true)
  })

  it('never invents a fit for a plainly too-small bag, however soft', () => {
    assert.equal(deriveFitsA4(18, 25, 'slouchy'), false)
  })

  it('returns null when the bag has not been measured', () => {
    assert.equal(deriveFitsA4(null, 23), null)
    assert.equal(deriveFitsA4(31, undefined), null)
  })
})

describe('deriveFitsTablet', () => {
  it('accepts a bag that clears an 11-inch tablet', () => {
    assert.equal(deriveFitsTablet(27, 20), true)
  })

  it('rejects a compact handbag', () => {
    assert.equal(deriveFitsTablet(18, 25), false)
  })

  it('returns null when unmeasured', () => {
    assert.equal(deriveFitsTablet(undefined, undefined), null)
  })
})

describe('deriveFitsLaptopInches', () => {
  it('returns the largest laptop that fits, not the first', () => {
    // 26 x 37.5 clears every footprint including the 16"
    assert.equal(deriveFitsLaptopInches(26, 37.5), 16)
  })

  it('returns a smaller size when the bag only clears that one', () => {
    // Clears 13" (30.5 + 1.5 = 32.0 wide, 21.5 + 1.5 = 23.0 tall) but not 14"
    assert.equal(deriveFitsLaptopInches(23.5, 32.5), 13)
  })

  it('returns null when no laptop fits, rather than false', () => {
    assert.equal(deriveFitsLaptopInches(18, 25), null)
  })

  it('returns null when unmeasured', () => {
    assert.equal(deriveFitsLaptopInches(null, 37), null)
  })
})

describe('deriveBagFacts', () => {
  it('derives every fact for the reference compact handbag', () => {
    const facts = deriveBagFacts({ heightCm: 18, widthCm: 25, depthCm: 13, bagStructure: 'structured' })
    assert.deepEqual(facts, {
      bagCapacityLiters: 5.9,
      bagSizeCategory: 'medium',
      fitsA4: false,
      fitsTablet: false,
      fitsLaptopInches: null,
    })
  })

  it('leaves every fact null when nothing has been measured', () => {
    assert.deepEqual(deriveBagFacts({}), {
      bagCapacityLiters: null,
      bagSizeCategory: null,
      fitsA4: null,
      fitsTablet: null,
      fitsLaptopInches: null,
    })
  })

  it('still derives fit facts when only depth is missing', () => {
    const facts = deriveBagFacts({ heightCm: 32, widthCm: 24 })
    assert.equal(facts.bagCapacityLiters, null)
    assert.equal(facts.bagSizeCategory, null)
    assert.equal(facts.fitsA4, true)
  })
})

describe('findDimensionAnomalies', () => {
  it('flags the transposed width/depth signature seen in the legacy free text', () => {
    const anomalies = findDimensionAnomalies({ heightCm: 18, widthCm: 13, depthCm: 25 })
    assert.equal(anomalies.length, 2)
    assert.match(anomalies[0], /transposed/)
    assert.match(anomalies[1], /unusually deep/)
  })

  it('passes a plausible bag without complaint', () => {
    assert.deepEqual(findDimensionAnomalies({ heightCm: 18, widthCm: 25, depthCm: 13 }), [])
  })

  it('flags an implausibly large computed capacity', () => {
    const anomalies = findDimensionAnomalies({ heightCm: 80, widthCm: 90, depthCm: 20 })
    assert.ok(anomalies.some((a) => /implausibly large/.test(a)))
  })

  it('says nothing about dimensions that were never entered', () => {
    assert.deepEqual(findDimensionAnomalies({ heightCm: 18 }), [])
  })
})
