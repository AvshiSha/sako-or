import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { Product } from '@/lib/product-types'
import {
  activeVariants,
  availableColors,
  availableColorsForSize,
  availableSizesForColor,
  isProductPurchasable,
  isVariantPurchasable,
  purchasableVariants,
  resolveVariantPricing,
  sortSizes,
} from '../product-availability'

/**
 * Fixtures only - no network, no credentials. These are the rules that decide
 * whether a customer can buy something, so they are checked against explicit
 * stock tables rather than whatever the catalogue happens to hold today.
 */
function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    sku: '1234-5678',
    title_en: 'BRAND',
    title_he: 'BRAND',
    description_en: '',
    description_he: '',
    category: 'women',
    categories_path: ['women', 'shoes', 'pumps'],
    categories_path_id: ['w', 's', 'p'],
    brand: 'BRAND',
    price: 500,
    currency: 'ILS',
    isEnabled: true,
    isDeleted: false,
    newProduct: false,
    featuredProduct: false,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    colorVariants: {
      black: {
        colorSlug: 'black',
        images: [],
        stockBySize: { '38': 0, '39': 2, '40': 1 },
      },
      beige: {
        colorSlug: 'beige',
        images: [],
        stockBySize: { '38': 3, '39': 0 },
      },
    },
    ...overrides,
  } as Product
}

describe('isProductPurchasable', () => {
  it('rejects deleted and unpublished products', () => {
    assert.equal(isProductPurchasable(makeProduct()), true)
    assert.equal(isProductPurchasable(makeProduct({ isDeleted: true })), false)
    assert.equal(isProductPurchasable(makeProduct({ isEnabled: false })), false)
    assert.equal(isProductPurchasable(null), false)
  })
})

describe('activeVariants', () => {
  it('treats a missing isActive as active and excludes an explicit false', () => {
    const product = makeProduct({
      colorVariants: {
        black: { colorSlug: 'black', images: [], stockBySize: { '39': 1 } },
        red: { colorSlug: 'red', isActive: false, images: [], stockBySize: { '39': 5 } },
      },
    } as Partial<Product>)
    assert.deepEqual(
      activeVariants(product).map((v) => v.colorSlug),
      ['black']
    )
  })
})

describe('isVariantPurchasable', () => {
  const product = makeProduct()

  it('requires stock in the exact size', () => {
    const black = product.colorVariants.black
    assert.equal(isVariantPurchasable(product, black, '39'), true)
    assert.equal(isVariantPurchasable(product, black, '38'), false)
  })

  it('normalises the size before looking it up', () => {
    assert.equal(isVariantPurchasable(product, product.colorVariants.black, '39.0'), true)
  })

  it('without a size, requires some stock rather than mere existence', () => {
    const empty = { colorSlug: 'x', images: [], stockBySize: { '39': 0 } }
    assert.equal(isVariantPurchasable(product, product.colorVariants.black), true)
    assert.equal(isVariantPurchasable(product, empty), false)
  })

  it('rejects an inactive variant even when it has stock', () => {
    const inactive = { colorSlug: 'x', isActive: false, images: [], stockBySize: { '39': 9 } }
    assert.equal(isVariantPurchasable(product, inactive, '39'), false)
  })

  it('rejects every variant of an unpublished product', () => {
    const unpublished = makeProduct({ isEnabled: false })
    assert.equal(
      isVariantPurchasable(unpublished, unpublished.colorVariants.black, '39'),
      false
    )
  })
})

describe('purchasableVariants', () => {
  const product = makeProduct()

  it('requires colour and size on the SAME variant', () => {
    // black has 39, beige has 38. Neither combination crosses over.
    assert.deepEqual(
      purchasableVariants(product, { colors: ['black'], sizes: ['39'] }).map((v) => v.colorSlug),
      ['black']
    )
    assert.deepEqual(purchasableVariants(product, { colors: ['black'], sizes: ['38'] }), [])
    assert.deepEqual(purchasableVariants(product, { colors: ['beige'], sizes: ['39'] }), [])
    assert.deepEqual(
      purchasableVariants(product, { colors: ['beige'], sizes: ['38'] }).map((v) => v.colorSlug),
      ['beige']
    )
  })

  it('does not let another colour satisfy the size, or another size the colour', () => {
    // The product genuinely has a 39 and genuinely has beige - but not together.
    const combined = purchasableVariants(product, { colors: ['beige'], sizes: ['39'] })
    assert.equal(combined.length, 0, 'beige/39 must not be satisfied by black/39 or beige/38')
  })

  it('matches any of several requested sizes', () => {
    assert.deepEqual(
      purchasableVariants(product, { colors: ['black'], sizes: ['38', '40'] }).map(
        (v) => v.colorSlug
      ),
      ['black']
    )
  })
})

describe('availableSizesForColor', () => {
  it('reports only that colour, in numeric order', () => {
    const product = makeProduct()
    assert.deepEqual(availableSizesForColor(product, 'black'), ['39', '40'])
    assert.deepEqual(availableSizesForColor(product, 'beige'), ['38'])
  })

  it('is empty for an unknown or inactive colour', () => {
    const product = makeProduct({
      colorVariants: {
        red: { colorSlug: 'red', isActive: false, images: [], stockBySize: { '39': 4 } },
      },
    } as Partial<Product>)
    assert.deepEqual(availableSizesForColor(product, 'red'), [])
    assert.deepEqual(availableSizesForColor(product, 'green'), [])
  })
})

describe('availableColorsForSize', () => {
  it('never reports a colour whose stock is in a different size', () => {
    const product = makeProduct()
    assert.deepEqual(availableColorsForSize(product, '39'), ['black'])
    assert.deepEqual(availableColorsForSize(product, '38'), ['beige'])
    assert.deepEqual(availableColorsForSize(product, '41'), [])
  })
})

describe('availableColors', () => {
  it('lists colours with any stock at all', () => {
    assert.deepEqual(availableColors(makeProduct()), ['beige', 'black'])
  })
})

describe('sortSizes', () => {
  it('orders numerically and de-duplicates', () => {
    assert.deepEqual(sortSizes(['40', '9', '38', '40']), ['9', '38', '40'])
  })
})

describe('resolveVariantPricing', () => {
  it('reports no original price when nothing is discounted', () => {
    const product = makeProduct()
    assert.deepEqual(resolveVariantPricing(product, product.colorVariants.black), {
      price: 500,
      originalPrice: null,
    })
  })

  it('uses the product sale price and exposes the original', () => {
    const product = makeProduct({ salePrice: 299 })
    assert.deepEqual(resolveVariantPricing(product, product.colorVariants.black), {
      price: 299,
      originalPrice: 500,
    })
  })

  it('prefers a variant sale price over the product one', () => {
    const product = makeProduct({ salePrice: 400 })
    const variant = { ...product.colorVariants.black, salePrice: 250 }
    assert.deepEqual(resolveVariantPricing(product, variant), {
      price: 250,
      originalPrice: 500,
    })
  })

  it('ignores a sale price that is not actually a discount', () => {
    const product = makeProduct({ salePrice: 600 })
    assert.deepEqual(resolveVariantPricing(product, product.colorVariants.black), {
      price: 500,
      originalPrice: null,
    })
  })

  it('honours a variant price override as the base', () => {
    const product = makeProduct()
    const variant = { ...product.colorVariants.black, priceOverride: 700 }
    assert.deepEqual(resolveVariantPricing(product, variant), {
      price: 700,
      originalPrice: null,
    })
  })
})
