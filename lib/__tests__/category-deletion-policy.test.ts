import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { evaluateCategoryDeletion } from '../category-deletion-policy'

describe('evaluateCategoryDeletion', () => {
  it('allows deleting a leaf category with no children and no products', () => {
    const plan = evaluateCategoryDeletion({ childCount: 0, productCount: 0, cascade: false })
    assert.equal(plan.allowed, true)
    assert.equal(plan.reason, undefined)
  })

  it('blocks deletion when products reference the category, even with cascade requested', () => {
    const plan = evaluateCategoryDeletion({ childCount: 0, productCount: 3, cascade: true })
    assert.equal(plan.allowed, false)
    assert.equal(plan.reason, 'HAS_PRODUCTS')
    assert.equal(plan.productCount, 3)
  })

  it('blocks deletion when the category has children and cascade was not requested', () => {
    const plan = evaluateCategoryDeletion({ childCount: 2, productCount: 0, cascade: false })
    assert.equal(plan.allowed, false)
    assert.equal(plan.reason, 'HAS_CHILDREN')
    assert.equal(plan.childCount, 2)
  })

  it('allows a cascade delete of children once the caller explicitly opts in', () => {
    const plan = evaluateCategoryDeletion({ childCount: 2, productCount: 0, cascade: true })
    assert.equal(plan.allowed, true)
  })

  it('prioritizes the product-reference block over the children block when both apply', () => {
    const plan = evaluateCategoryDeletion({ childCount: 4, productCount: 1, cascade: true })
    assert.equal(plan.allowed, false)
    assert.equal(plan.reason, 'HAS_PRODUCTS')
  })
})
