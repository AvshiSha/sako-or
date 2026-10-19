import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { parseStockByModelXml } from '../verifone-stock-parse'
import {
  STOCK_MALFORMED_ENVELOPE,
  STOCK_MIXED_QTY_SHAPES,
  STOCK_MULTI_STORE_WITH_13,
  STOCK_MULTI_STORE_WITHOUT_13,
  STOCK_NONZERO_STATUS,
  STOCK_NOT_SUCCESS,
  STOCK_NOT_XML,
  STOCK_NO_DATA,
  STOCK_NO_ITEMS,
  STOCK_NO_ITEM_STOCK,
  STOCK_NO_STORES,
  STOCK_NO_STORE_MODEL_STOCK,
  STOCK_OK,
  STOCK_ONE_SIZE,
  STOCK_SHORT_PRODUCT_CODE,
  STOCK_SINGLE_ITEM,
  STOCK_TOO_SHORT_PRODUCT_CODE,
} from '../staff/__fixtures__/get-stock-by-model'

/**
 * Pins the GetStockByModel response contract as this codebase actually parses
 * it. The parser was lifted verbatim out of `lib/verifone.ts` so that the
 * three-hourly inventory cron and the new staff lookup share one
 * implementation; these tests are what make "behaviour-identical" checkable
 * instead of merely asserted.
 *
 * What they do NOT establish: that Verifone emits these envelopes. The endpoint
 * is IP-allowlisted, so that is a manual check from an allowlisted environment.
 */
describe('parseStockByModelXml', () => {
  it('parses colour and size out of ProductCode and clamps negatives to zero', () => {
    const result = parseStockByModelXml(STOCK_OK)

    assert.equal(result.success, true)
    assert.equal(result.status, 0)
    assert.deepEqual(result.items, [
      { productCode: '4925-03010135', sku: '4925-0301', colorCode: '01', size: '35', quantity: 3 },
      { productCode: '4925-03010136', sku: '4925-0301', colorCode: '01', size: '36', quantity: 0 },
      { productCode: '4925-03010137', sku: '4925-0301', colorCode: '01', size: '37', quantity: 12 },
      { productCode: '4925-03011036', sku: '4925-0301', colorCode: '10', size: '36', quantity: 0 },
      { productCode: '4925-03011037', sku: '4925-0301', colorCode: '10', size: '37', quantity: 2 },
      { productCode: '4925-03017738', sku: '4925-0301', colorCode: '77', size: '38', quantity: 5 },
    ])
  })

  it('keeps a colour code that is absent from COLOR_CODE_MAP', () => {
    // The cron drops these via parseInventorySku; the parser itself must not,
    // or the staff screen would silently hide stock that physically exists.
    const result = parseStockByModelXml(STOCK_OK)
    assert.ok(result.items?.some((i) => i.colorCode === '77'))
  })

  it('reads OS as the size for a one-size item', () => {
    const result = parseStockByModelXml(STOCK_ONE_SIZE)
    assert.deepEqual(result.items, [
      { productCode: '4925-030101OS', sku: '4925-0301', colorCode: '01', size: 'OS', quantity: 7 },
    ])
  })

  it('coerces every Qty shape parseTagValue can produce', () => {
    // 4 arrives as a number, '' as an empty string, ' 9 ' as a padded string.
    const result = parseStockByModelXml(STOCK_MIXED_QTY_SHAPES)
    assert.deepEqual(
      result.items?.map((i) => i.quantity),
      [4, 0, 9]
    )
  })

  it('selects store 13 when the response carries several stores', () => {
    const result = parseStockByModelXml(STOCK_MULTI_STORE_WITH_13)
    assert.deepEqual(
      result.items?.map((i) => i.quantity),
      [3]
    )
  })

  it('falls back to the first store when 13 is absent', () => {
    const result = parseStockByModelXml(STOCK_MULTI_STORE_WITHOUT_13)
    assert.deepEqual(
      result.items?.map((i) => i.quantity),
      [11]
    )
  })

  it('wraps a lone ItemStock element into an array', () => {
    const result = parseStockByModelXml(STOCK_SINGLE_ITEM)
    assert.equal(result.items?.length, 1)
  })

  it('skips a ProductCode shorter than 12 characters', () => {
    const result = parseStockByModelXml(STOCK_TOO_SHORT_PRODUCT_CODE)
    assert.deepEqual(
      result.items?.map((i) => i.productCode),
      ['4925-03010135']
    )
  })

  it('characterises the 12-character ProductCode edge: a one-character size', () => {
    // The guard is `length < 12` but the slices need 13, so a 12-character code
    // yields a 1-character size. Pre-existing behaviour, shared with the cron.
    // Changing the guard would change what the cron writes, so this test
    // records the oddity instead; `lib/staff/combine-stock.ts` is what refuses
    // to show staff a size it cannot trust.
    const result = parseStockByModelXml(STOCK_SHORT_PRODUCT_CODE)
    assert.equal(result.success, true)
    assert.equal(result.items?.length, 1)
    assert.equal(result.items?.[0].size, '3')
  })

  describe('failure is never reported as zero stock', () => {
    it('treats IsSuccess false as a failure, with no items array', () => {
      const result = parseStockByModelXml(STOCK_NOT_SUCCESS)
      assert.equal(result.success, false)
      assert.equal(result.items, undefined)
      assert.equal(result.statusDescription, 'General failure')
    })

    it('treats a non-zero Status as a failure even when IsSuccess is true', () => {
      const result = parseStockByModelXml(STOCK_NONZERO_STATUS)
      assert.equal(result.success, false)
      assert.equal(result.status, 7)
      assert.equal(result.items, undefined)
    })

    it('reports a malformed envelope as malformed, not as empty', () => {
      const result = parseStockByModelXml(STOCK_MALFORMED_ENVELOPE)
      assert.equal(result.success, false)
      assert.equal(result.statusDescription, 'Malformed Verifone response')
      assert.equal(result.items, undefined)
    })

    it('never throws on input that is not XML', () => {
      const result = parseStockByModelXml(STOCK_NOT_XML)
      assert.equal(result.success, false)
      assert.equal(result.items, undefined)
    })
  })

  describe('every missing-node path answers success with an empty list', () => {
    // This is the reason the staff screen must not claim "model not found" on
    // an empty result: a model that does not exist and a model with no stock
    // rows are indistinguishable here.
    const cases: Array<[string, string]> = [
      ['no Data', STOCK_NO_DATA],
      ['no Stores', STOCK_NO_STORES],
      ['no StoreModelStock', STOCK_NO_STORE_MODEL_STOCK],
      ['no Items', STOCK_NO_ITEMS],
      ['no ItemStock', STOCK_NO_ITEM_STOCK],
    ]

    for (const [label, xml] of cases) {
      it(label, () => {
        const result = parseStockByModelXml(xml)
        assert.equal(result.success, true)
        assert.deepEqual(result.items, [])
      })
    }
  })
})
