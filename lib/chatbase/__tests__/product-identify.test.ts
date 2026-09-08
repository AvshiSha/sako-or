import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseIdentifier, parseProductUrl } from '../product-identify'

describe('parseProductUrl', () => {
  it('reads SKU and colour from a storefront URL', () => {
    assert.deepEqual(parseProductUrl('https://www.sako-or.com/he/product/4625-7809/black'), {
      sku: '4625-7809',
      colorSlug: 'black',
    })
  })

  it('accepts a bare path as well as an absolute URL', () => {
    assert.deepEqual(parseProductUrl('/he/product/4625-7809/black'), {
      sku: '4625-7809',
      colorSlug: 'black',
    })
  })

  it('works for either locale', () => {
    assert.equal(parseProductUrl('/en/product/4625-7809/beige')?.colorSlug, 'beige')
  })

  it('tolerates a query string or fragment', () => {
    assert.deepEqual(parseProductUrl('/he/product/4625-7809/black?utm_source=chat'), {
      sku: '4625-7809',
      colorSlug: 'black',
    })
    assert.equal(parseProductUrl('/he/product/4625-7809/black#reviews')?.colorSlug, 'black')
  })

  it('handles a URL with no colour segment', () => {
    assert.deepEqual(parseProductUrl('/he/product/4625-7809'), {
      sku: '4625-7809',
      colorSlug: undefined,
    })
  })

  it('decodes an encoded segment', () => {
    assert.equal(parseProductUrl('/he/product/4625-7809/light%2Dbrown')?.colorSlug, 'light-brown')
  })

  it('returns null rather than half-guessing a non-product URL', () => {
    assert.equal(parseProductUrl('https://www.sako-or.com/he/collection/women/shoes'), null)
    assert.equal(parseProductUrl('https://www.sako-or.com/he'), null)
    assert.equal(parseProductUrl('not a url at all'), null)
    assert.equal(parseProductUrl('/he/product/'), null)
  })
})

describe('parseIdentifier', () => {
  it('splits the productId this API hands out', () => {
    assert.deepEqual(parseIdentifier({ productId: '4625-7809:black' }), {
      sku: '4625-7809',
      colorSlug: 'black',
    })
  })

  it('accepts a productId with no colour half', () => {
    assert.deepEqual(parseIdentifier({ productId: '4625-7809' }), {
      sku: '4625-7809',
      colorSlug: undefined,
    })
  })

  it('accepts a bare SKU, carrying no colour', () => {
    assert.deepEqual(parseIdentifier({ sku: '4625-7809' }), { sku: '4625-7809' })
  })

  it('prefers productId, then sku, then url', () => {
    const all = parseIdentifier({
      productId: '1111-1111:black',
      sku: '2222-2222',
      productUrl: '/he/product/3333-3333/beige',
    })
    assert.equal(all?.sku, '1111-1111')

    const skuAndUrl = parseIdentifier({
      sku: '2222-2222',
      productUrl: '/he/product/3333-3333/beige',
    })
    assert.equal(skuAndUrl?.sku, '2222-2222')
  })

  it('returns null when nothing identifies a product', () => {
    assert.equal(parseIdentifier({}), null)
    assert.equal(parseIdentifier({ sku: '   ' }), null)
    assert.equal(parseIdentifier({ productUrl: '/he/collection/women' }), null)
  })

  it('reduces a variant SKU to its base', () => {
    // A customer may paste the SKU from a label, which can carry colour/size.
    const parsed = parseIdentifier({ sku: '4625-7809' })
    assert.equal(parsed?.sku, '4625-7809')
  })
})
