import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { Product } from '@/lib/product-types'
import type { ProductCandidate } from '../product-query'
import type { ProductVariant } from '../product-availability'
import {
  buildMatchReasons,
  buildProductUrl,
  buildSpecifications,
  buildTitle,
  buildVariantImageUrl,
  presentProduct,
} from '../product-presenter'

function makeCandidate(overrides: Partial<ProductCandidate> = {}): ProductCandidate {
  return {
    sku: '4625-7809',
    categories_path: ['women', 'outlet', 'outlet-slippers-x'],
    price: 590,
    salePrice: 249,
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
    shortTitle_en: 'Double-strap leather slipper',
    shortTitle_he: 'כפכפי עור עם רצועות כפולות',
    title_en: 'SAKO SANDALS 7809',
    title_he: 'SAKO SANDALS 7809',
    subSubCategory_en: 'Slippers',
    subSubCategory_he: 'כפכפים',
    ...overrides,
  }
}

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    sku: '4625-7809',
    title_en: 'SAKO SANDALS 7809',
    title_he: 'SAKO SANDALS 7809',
    description_en: '',
    description_he: '',
    category: 'women',
    categories_path: ['women', 'outlet', 'outlet-slippers-x'],
    categories_path_id: ['w', 'o', 's'],
    brand: 'SAKO',
    price: 590,
    salePrice: 249,
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
        images: ['https://cdn.example/black-1.webp', 'https://cdn.example/black-2.webp'],
        primaryImage: 'https://cdn.example/black-primary.webp',
        stockBySize: { '39': 2, '40': 1, '41': 0 },
      },
    },
    ...overrides,
  } as Product
}

const variant = () => makeProduct().colorVariants.black as ProductVariant

describe('buildSpecifications', () => {
  it('omits null, empty and the "undefined" sentinel rather than emitting them', () => {
    const specs = buildSpecifications(
      makeCandidate({
        lining: null,
        insole: '',
        footWidthFit: 'undefined',
        archFit: 'undefined',
        upperMaterial: [],
        heelHeight: null,
      })
    )
    assert.equal('liningMaterial' in specs, false)
    assert.equal('insoleMaterial' in specs, false)
    assert.equal('footWidthFit' in specs, false)
    assert.equal('archFit' in specs, false)
    assert.equal('upperMaterial' in specs, false)
    assert.equal('heelHeightCm' in specs, false)
    // Nothing that survives is ever null or the sentinel.
    for (const value of Object.values(specs)) {
      assert.notEqual(value, null)
      assert.notEqual(value, 'undefined')
    }
  })

  it('returns canonical values, not display labels', () => {
    const specs = buildSpecifications(makeCandidate())
    assert.deepEqual(specs.upperMaterial, ['nappa_leather'])
    assert.equal(specs.footWidthFit, 'most_widths')
    assert.equal(specs.closureType, 'no_closure')
  })

  it('exposes heel height as a number', () => {
    assert.equal(buildSpecifications(makeCandidate({ heelHeight: '3' })).heelHeightCm, 3)
    assert.equal(buildSpecifications(makeCandidate({ heelHeight: '0' })).heelHeightCm, 0)
  })

  it('treats a non-numeric heel height as unknown, never as zero', () => {
    assert.equal('heelHeightCm' in buildSpecifications(makeCandidate({ heelHeight: 'low' })), false)
  })
})

describe('buildTitle', () => {
  it('prefers the short title, which is the real product name', () => {
    assert.equal(buildTitle(makeCandidate(), 'he'), 'כפכפי עור עם רצועות כפולות')
    assert.equal(buildTitle(makeCandidate(), 'en'), 'Double-strap leather slipper')
  })

  it('never returns the bare brand when a category name is available', () => {
    // title_he holds the brand ("SAKO SANDALS 7809"), not a product name.
    const title = buildTitle(makeCandidate({ shortTitle_he: null, shortTitle_en: null }), 'he')
    assert.match(title, /כפכפים/)
    assert.notEqual(title, 'SAKO SANDALS 7809')
  })

  it('falls back to the SKU rather than an empty string', () => {
    const title = buildTitle(
      makeCandidate({
        shortTitle_he: null,
        shortTitle_en: null,
        subSubCategory_he: null,
        subSubCategory_en: null,
        title_he: '',
        title_en: '',
      }),
      'he'
    )
    assert.equal(title, '4625-7809')
  })
})

describe('buildProductUrl', () => {
  it('points at the locale and colour variant', () => {
    const url = buildProductUrl('4625-7809', 'black', 'he')
    assert.match(url, /^https?:\/\//)
    assert.ok(url.endsWith('/he/product/4625-7809/black'), url)
  })

  it('uses the base SKU, so a variant SKU still resolves', () => {
    assert.ok(buildProductUrl('4625-7809', 'black', 'en').endsWith('/en/product/4625-7809/black'))
  })
})

describe('buildVariantImageUrl', () => {
  it('prefers the variant primary image', () => {
    assert.equal(buildVariantImageUrl(variant()), 'https://cdn.example/black-primary.webp')
  })

  it('falls back to the variant first image, never another colour', () => {
    const noPrimary = { ...variant(), primaryImage: undefined }
    assert.equal(buildVariantImageUrl(noPrimary), 'https://cdn.example/black-1.webp')
  })

  it('returns null rather than a placeholder when the variant has no image', () => {
    assert.equal(buildVariantImageUrl({ ...variant(), primaryImage: undefined, images: [] }), null)
  })
})

describe('presentProduct', () => {
  const present = (extra: Partial<Parameters<typeof presentProduct>[0]> = {}) =>
    presentProduct({
      candidate: makeCandidate(),
      product: makeProduct(),
      variant: variant(),
      locale: 'he',
      ...extra,
    })

  it('exposes a public id built from SKU and colour, not a database id', () => {
    const result = present()
    assert.equal(result.productId, '4625-7809:black')
    assert.equal(JSON.stringify(result).includes('categories_path_id'), false)
  })

  it('reports the payable price and the original only when discounted', () => {
    const result = present()
    assert.equal(result.price, 249)
    assert.equal(result.originalPrice, 590)

    const noSale = presentProduct({
      candidate: makeCandidate({ salePrice: null }),
      product: makeProduct({ salePrice: undefined }),
      variant: variant(),
      locale: 'he',
    })
    assert.equal(noSale.price, 590)
    assert.equal(noSale.originalPrice, null)
  })

  it('lists in-stock sizes only, and never a quantity', () => {
    const result = present()
    assert.deepEqual(result.availableSizes, ['39', '40'])
    assert.equal(JSON.stringify(result).includes('stockBySize'), false)
    assert.equal(JSON.stringify(result).includes('"2"'), false)
  })

  it('narrows availableSizes to what was asked for', () => {
    assert.deepEqual(present({ requestedSizes: ['39'] }).availableSizes, ['39'])
  })

  it('marks an outlet product', () => {
    assert.equal(present().isOutlet, true)
  })

  it('localises the colour label', () => {
    assert.equal(present().color.value, 'black')
    assert.equal(present().color.label, 'שחור')
    assert.equal(present({ locale: 'en' }).color.label, 'Black')
  })

  it('always includes arrays for reasons and warnings, never undefined', () => {
    const result = present()
    assert.ok(Array.isArray(result.matchReasons))
    assert.ok(Array.isArray(result.warnings))
  })
})

describe('buildMatchReasons', () => {
  it('leads with the confirmed colour and size', () => {
    const reasons = buildMatchReasons({
      candidate: makeCandidate(),
      color: { value: 'black', label: 'שחור' },
      matchedSizes: ['39'],
      locale: 'he',
      price: 249,
    })
    assert.match(reasons[0], /שחור/)
    assert.match(reasons[0], /39/)
  })

  it('omits a spec that has no stored value rather than inventing one', () => {
    const reasons = buildMatchReasons({
      candidate: makeCandidate({ footWidthFit: 'undefined', archFit: null, heelHeight: null, heelType: null, upperMaterial: [] }),
      color: { value: 'black', label: 'שחור' },
      matchedSizes: [],
      locale: 'he',
      price: 249,
    })
    // Colour line plus the price line, and nothing fabricated in between.
    assert.equal(reasons.length, 2)
    assert.match(reasons[1], /249/)
  })

  it('produces English reasons for an English request', () => {
    const reasons = buildMatchReasons({
      candidate: makeCandidate(),
      color: { value: 'black', label: 'Black' },
      matchedSizes: ['39'],
      locale: 'en',
      price: 249,
    })
    assert.match(reasons[0], /Available in Black in size 39/)
    assert.ok(reasons.some((reason) => /most foot widths/i.test(reason)))
  })
})
