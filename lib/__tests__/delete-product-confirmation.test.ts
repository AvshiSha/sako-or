import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  isHighRiskProductDelete,
  skuConfirmationMatches,
} from '@/app/(unlocalized)/admin/products/_components/DeleteProductModal'

/**
 * The dialog's markup mirrors DeleteCategoryModal and is declarative, but these
 * two predicates decide whether a destructive action is gated at all — worth
 * pinning down. (The component itself cannot be asserted with
 * renderToStaticMarkup: headlessui's Transition renders no children on the
 * server, which is why the existing category modal is untested too.)
 */

const target = (over: Partial<{ isActive: boolean; stock: number }> = {}) => ({
  isActive: false,
  stock: 0,
  ...over,
})

describe('isHighRiskProductDelete', () => {
  it('gates a product that is live on the site', () => {
    assert.equal(isHighRiskProductDelete(target({ isActive: true })), true)
  })

  it('gates a product that still holds stock, even when inactive', () => {
    // Inactive but stocked still represents real inventory someone counted.
    assert.equal(isHighRiskProductDelete(target({ stock: 4 })), true)
  })

  it('does not gate an inactive product with no stock', () => {
    // Routine cleanup. Friction here would only teach people to click through.
    assert.equal(isHighRiskProductDelete(target()), false)
  })

  it('handles no target', () => {
    assert.equal(isHighRiskProductDelete(null), false)
  })
})

describe('skuConfirmationMatches', () => {
  it('accepts the exact SKU', () => {
    assert.equal(skuConfirmationMatches('SK-1234', 'SK-1234'), true)
  })

  it('ignores case and surrounding whitespace', () => {
    // The gate is there to make someone stop and look, not to test typing.
    assert.equal(skuConfirmationMatches('sk-1234', 'SK-1234'), true)
    assert.equal(skuConfirmationMatches('  SK-1234  ', 'SK-1234'), true)
  })

  it('rejects an empty box', () => {
    assert.equal(skuConfirmationMatches('', 'SK-1234'), false)
    assert.equal(skuConfirmationMatches('   ', 'SK-1234'), false)
  })

  it('rejects a different or partial SKU', () => {
    assert.equal(skuConfirmationMatches('SK-1235', 'SK-1234'), false)
    assert.equal(skuConfirmationMatches('SK-123', 'SK-1234'), false)
  })

  it('never passes on an empty SKU', () => {
    // A product with no SKU must not become confirmable by leaving the box blank.
    assert.equal(skuConfirmationMatches('', ''), false)
    assert.equal(skuConfirmationMatches('   ', ''), false)
  })
})
