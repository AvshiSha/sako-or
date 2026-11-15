import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  InvoiceTotalsMismatchError,
  allocateCents,
  allocateProductLines,
  assertInvoiceTotalsReconcile,
  assertPaymentAmountMatchesOrderTotal,
  buildDocumentLines,
  calculateInvoiceTotals,
  recordedUnitPrice,
  resolveOrderLevelDiscount,
  type BuildDocumentLinesInput,
  type InvoiceOrderItem,
} from '../verifone-invoice-lines'

/**
 * The Verifone invoice document, from the one rule that matters:
 *
 *   Σ(product lines) + delivery − points = the amount actually charged
 *
 * Verifone checks it on its side and answers status 414 when it doesn't hold, so
 * every case below is really asking the same question in different shapes - and
 * ORDER-1794766845298 is the shape that got through.
 */

const VAT = 18

function item(overrides: Partial<InvoiceOrderItem> & { price: number }): InvoiceOrderItem {
  return {
    productSku: '5105-0002',
    colorName: 'black',
    size: '37',
    quantity: 1,
    salePrice: null,
    ...overrides,
  }
}

function sumLines(lines: Array<{ TotalPrice: number }>): number {
  return Math.round(lines.reduce((sum, line) => sum + line.TotalPrice, 0) * 100) / 100
}

function build(input: Partial<BuildDocumentLinesInput> & { orderItems: InvoiceOrderItem[]; orderTotal: number }) {
  return buildDocumentLines({
    orderLevelDiscount: 0,
    pointsUsed: 0,
    deliveryFee: 0,
    ...input,
  })
}

describe('ORDER-1794766845298 - the coupon remainder that was dropped', () => {
  // The order as recorded: seven pairs at the prices actually charged, a fixed
  // 1018 coupon, 200 points spent, no delivery fee, 3735 charged.
  const orderItems: InvoiceOrderItem[] = [
    item({ productSku: '5105-0002', price: 990 }),
    item({ productSku: '5103-0032', price: 1390 }),
    item({ productSku: '5129-6188', price: 449 }),
    item({ productSku: '5004-0016', price: 490, salePrice: 490 }),
    item({ productSku: '5004-0016', price: 490, salePrice: 490, colorName: 'dark-brown' }),
    item({ productSku: '4704-0100', price: 645, salePrice: 645, colorName: 'beige' }),
    item({ productSku: '5022-5723', price: 499, salePrice: 499, colorName: 'dark-brown' }),
  ]
  const order = {
    orderItems,
    orderLevelDiscount: 1018,
    pointsUsed: 200,
    deliveryFee: 0,
    orderTotal: 3735,
    orderNumber: 'ORDER-1794766845298',
  }

  it('produces lines that sum to the amount charged', () => {
    const lines = buildDocumentLines(order)
    assert.equal(sumLines(lines), 3735)
  })

  it('spreads the whole coupon instead of capping it at the first line', () => {
    const lines = buildDocumentLines(order)
    const productLines = lines.filter(line => line.ItemID !== '777')

    // The old behaviour: the full 1018 was pushed onto the first product line,
    // capped at that line's own 990, and the leftover 28 was silently dropped -
    // leaving the lines 28 above the header (3763 vs 3735).
    assert.equal(sumLines(productLines), 3935)
    assert.notEqual(productLines[0].TotalPrice, 0)

    // Every line carries its share, none of them the whole discount.
    const discountPerLine = productLines.map((line, index) =>
      Math.round((orderItems[index].price - line.UnitPrice) * 100) / 100
    )
    assert.ok(discountPerLine.every(discount => discount > 0))
    assert.equal(
      Math.round(discountPerLine.reduce((sum, discount) => sum + discount, 0) * 100) / 100,
      1018
    )
  })

  it('reconciles lines, header and the charged amount', () => {
    const lines = buildDocumentLines(order)
    const totals = calculateInvoiceTotals(lines, order.orderTotal)

    assert.equal(totals.TotalPriceIncludeVAT, 3735)
    assert.equal(
      Math.round((totals.TotalAfterDiscount_WithoutVAT + totals.VAT) * 100) / 100,
      3735
    )
    assert.equal(sumLines(lines), totals.TotalPriceIncludeVAT)
    // 7 items minus the points line's -1
    assert.equal(totals.TotalItems, 6)
    assert.equal(totals.TotalLines, lines.length)
    assert.equal(totals.TotalLines, 8)
  })

  it('keeps the points line first and negative', () => {
    const lines = buildDocumentLines(order)
    assert.equal(lines[0].ItemID, '777')
    assert.equal(lines[0].Qty, -1)
    assert.equal(lines[0].TotalPrice, -200)
    assert.deepEqual(
      lines.map(line => line.LineNo),
      [1, 2, 3, 4, 5, 6, 7, 8]
    )
  })
})

describe('salePrice at or above price', () => {
  it('treats salePrice === price as the normal shape of a sale line', () => {
    // Checkout writes `salePrice ?? price` into OrderItem.price and keeps
    // salePrice as a duplicate, so this is what every discounted item looks
    // like - not bad data, and not the cause of any totals gap.
    assert.equal(recordedUnitPrice({ price: 490, salePrice: 490 }), 490)
  })

  it('ignores a salePrice above the charged price', () => {
    assert.equal(recordedUnitPrice({ price: 490, salePrice: 700 }), 490)
  })

  it('still honours a genuinely lower salePrice on legacy rows', () => {
    assert.equal(recordedUnitPrice({ price: 700, salePrice: 490 }), 490)
  })

  it('changes nothing about the document totals', () => {
    const withDuplicate = build({
      orderItems: [item({ price: 490, salePrice: 490 }), item({ price: 645, salePrice: 645 })],
      orderTotal: 1135,
    })
    const withoutDuplicate = build({
      orderItems: [item({ price: 490 }), item({ price: 645 })],
      orderTotal: 1135,
    })
    assert.deepEqual(
      withDuplicate.map(line => line.TotalPrice),
      withoutDuplicate.map(line => line.TotalPrice)
    )
    assert.equal(sumLines(withDuplicate), 1135)
  })

  it('prices a legacy row from its lower salePrice', () => {
    // price = pre-sale catalog price, salePrice = what was charged.
    const lines = build({
      orderItems: [item({ price: 700, salePrice: 490 })],
      orderTotal: 490,
    })
    assert.equal(lines[0].UnitPrice, 490)
    assert.equal(sumLines(lines), 490)
  })
})

describe('quantities', () => {
  it('splits a discount evenly over the units of a line', () => {
    const lines = build({
      orderItems: [item({ price: 500, quantity: 2 })],
      orderLevelDiscount: 100,
      orderTotal: 900,
    })
    assert.equal(lines.length, 1)
    assert.equal(lines[0].Qty, 2)
    assert.equal(lines[0].UnitPrice, 450)
    assert.equal(lines[0].TotalPrice, 900)
  })

  it('splits a line in two when its share will not divide over its units', () => {
    // 100.00 across 3 pairs is 33.333...: emitted as 2 x 33.34 + 1 x 33.33 so
    // that UnitPrice * Qty is exact on both lines and they still sum to 100.
    const lines = build({
      orderItems: [item({ price: 100, quantity: 3 })],
      orderLevelDiscount: 200,
      orderTotal: 100,
    })
    assert.equal(lines.length, 2)
    for (const line of lines) {
      assert.equal(Math.round(line.UnitPrice * line.Qty * 100) / 100, line.TotalPrice)
    }
    assert.equal(lines.reduce((sum, line) => sum + line.Qty, 0), 3)
    assert.equal(sumLines(lines), 100)
    assert.deepEqual(lines.map(line => line.LineNo), [1, 2])
  })

  it('keeps UnitPrice * Qty === TotalPrice on every line', () => {
    const lines = build({
      orderItems: [
        item({ price: 333.33, quantity: 3 }),
        item({ price: 199.99, quantity: 2 }),
        item({ price: 49.9 }),
      ],
      // 333.33 x 3 + 199.99 x 2 + 49.90 = 1449.87, less the 123.45 discount
      orderLevelDiscount: 123.45,
      orderTotal: 1326.42,
    })
    for (const line of lines) {
      assert.equal(Math.round(line.UnitPrice * line.Qty * 100) / 100, line.TotalPrice)
    }
    assert.equal(sumLines(lines), 1326.42)
  })
})

describe('delivery fee and points', () => {
  it('adds delivery as its own full-price line', () => {
    const lines = build({
      orderItems: [item({ price: 300 })],
      deliveryFee: 35,
      orderTotal: 335,
    })
    const delivery = lines.find(line => line.ItemID === '9000-99990038')
    assert.ok(delivery)
    assert.equal(delivery.TotalPrice, 35)
    assert.equal(delivery.CreditPointsAccumPrecent, 0)
    assert.equal(sumLines(lines), 335)
  })

  it('reconciles coupon, points and delivery together', () => {
    // 1000 merchandise − 150 coupon − 50 points + 35 delivery = 835 charged.
    const lines = build({
      orderItems: [item({ price: 600 }), item({ price: 400 })],
      orderLevelDiscount: 150,
      pointsUsed: 50,
      deliveryFee: 35,
      orderTotal: 835,
    })
    assert.equal(sumLines(lines), 835)
    const totals = calculateInvoiceTotals(lines, 835)
    assert.equal(
      Math.round((totals.TotalAfterDiscount_WithoutVAT + totals.VAT) * 100) / 100,
      totals.TotalPriceIncludeVAT
    )
    // points line + delivery line + 2 products
    assert.equal(totals.TotalLines, 4)
    assert.equal(totals.TotalItems, 2)
  })

  it('never discounts the delivery line to make the numbers fit', () => {
    const lines = build({
      orderItems: [item({ price: 100 })],
      orderLevelDiscount: 100,
      deliveryFee: 35,
      orderTotal: 35,
    })
    const delivery = lines.find(line => line.ItemID === '9000-99990038')
    assert.equal(delivery?.TotalPrice, 35)
    assert.equal(sumLines(lines), 35)
  })
})

describe('rounding', () => {
  it('allocates a discount that does not divide evenly, to the agora', () => {
    // 10 identical 100.00 lines sharing a 33.33 discount: the per-line share is
    // 3.333, so the agorot have to land somewhere without changing the total.
    const lines = build({
      orderItems: Array.from({ length: 10 }, () => item({ price: 100 })),
      orderLevelDiscount: 33.33,
      orderTotal: 966.67,
    })
    assert.equal(sumLines(lines), 966.67)
    // Within an agora of each other, not a lump on one line (compared in agorot,
    // since 96.67 - 96.66 is not exactly 0.01 in binary floating point).
    const unitAgorot = lines.map(line => Math.round(line.UnitPrice * 100))
    assert.ok(Math.max(...unitAgorot) - Math.min(...unitAgorot) <= 1)
    assert.deepEqual(new Set(unitAgorot), new Set([9667, 9666]))
  })

  it('derives header VAT by subtraction so net + VAT is never off by an agora', () => {
    // 100 / 1.18 = 84.745..., and 84.75 * 0.18 = 15.255 -> 15.26, which used to
    // make net + VAT come to 100.01 and fail validation on Verifone's side.
    const totals = calculateInvoiceTotals([], 100)
    assert.equal(totals.TotalBeforeDiscount_WithoutVAT, 84.75)
    assert.equal(totals.VAT, 15.25)
    assert.equal(
      Math.round((totals.TotalAfterDiscount_WithoutVAT + totals.VAT) * 100) / 100,
      100
    )
    assert.equal(totals.VatPercent, VAT)
  })

  it('keeps net + VAT === gross across a wide range of totals', () => {
    for (let cents = 1; cents <= 200000; cents += 7) {
      const total = cents / 100
      const totals = calculateInvoiceTotals([], total)
      assert.equal(
        Math.round((totals.TotalAfterDiscount_WithoutVAT + totals.VAT) * 100) / 100,
        totals.TotalPriceIncludeVAT,
        `net + VAT drifted for ${total}`
      )
    }
  })
})

describe('allocateCents', () => {
  it('sums to the target exactly', () => {
    const allocated = allocateCents([1000, 1000, 1000], 2000)
    assert.equal(allocated.reduce((sum, value) => sum + value, 0), 2000)
  })

  it('never exceeds a base', () => {
    const bases = [10, 1000, 50]
    const allocated = allocateCents(bases, 60)
    allocated.forEach((value, index) => assert.ok(value <= bases[index]))
    assert.equal(allocated.reduce((sum, value) => sum + value, 0), 60)
  })

  it('passes bases through untouched when there is no discount', () => {
    assert.deepEqual(allocateCents([101, 202, 303], 606), [101, 202, 303])
  })

  it('hands the residual agorot to the largest remainders', () => {
    // 100 across three equal lines: 33 + 33 + 34, not 33 + 33 + 33.
    const allocated = allocateCents([100, 100, 100], 100)
    assert.equal(allocated.reduce((sum, value) => sum + value, 0), 100)
    assert.deepEqual(allocated.slice().sort((a, b) => a - b), [33, 33, 34])
  })

  it('handles an empty line set and a zero target', () => {
    assert.deepEqual(allocateCents([], 0), [])
    assert.deepEqual(allocateCents([100, 200], 0), [0, 0])
  })
})

describe('allocateProductLines', () => {
  it('allocates per unit, not per line', () => {
    const allocated = allocateProductLines(
      [
        { quantity: 2, price: 100, salePrice: null },
        { quantity: 1, price: 100, salePrice: null },
      ],
      29700
    )
    assert.equal(
      allocated.reduce((sum, line) => sum + line.totalCents, 0),
      29700
    )
    for (const line of allocated) {
      assert.equal(line.unitPriceCents * line.qty, line.totalCents)
    }
  })
})

describe('a genuine mismatch stops the invoice', () => {
  const orderItems = [item({ price: 500 }), item({ price: 500 })]

  it('refuses when the recorded discount does not explain the charged amount', () => {
    assert.throws(
      () =>
        build({
          orderItems,
          orderLevelDiscount: 100, // on file
          orderTotal: 700, // but 300 was taken off
        }),
      (error: unknown) => {
        assert.ok(error instanceof InvoiceTotalsMismatchError)
        assert.equal(error.code, 'INVOICE_TOTALS_MISMATCH')
        assert.equal(error.diagnostics.reason, 'DISCOUNT_DOES_NOT_RECONCILE')
        assert.equal(error.diagnostics.recordedDiscount, 100)
        assert.equal(error.diagnostics.impliedDiscount, 300)
        assert.equal(error.diagnostics.merchandiseBase, 1000)
        assert.equal(error.diagnostics.targetProductTotal, 700)
        return true
      }
    )
  })

  it('refuses when the lines would have to exceed the recorded prices', () => {
    assert.throws(
      () => build({ orderItems, orderTotal: 1200 }),
      (error: unknown) => {
        assert.ok(error instanceof InvoiceTotalsMismatchError)
        assert.equal(error.diagnostics.reason, 'PRODUCT_TOTAL_ABOVE_RECORDED_PRICES')
        return true
      }
    )
  })

  it('refuses when the product lines would have to be negative', () => {
    assert.throws(
      () => build({ orderItems, deliveryFee: 35, orderTotal: 20 }),
      (error: unknown) => {
        assert.ok(error instanceof InvoiceTotalsMismatchError)
        assert.equal(error.diagnostics.reason, 'NEGATIVE_PRODUCT_TOTAL')
        return true
      }
    )
  })

  it('refuses an order with no items but a non-zero total', () => {
    assert.throws(
      () => build({ orderItems: [], orderTotal: 100 }),
      (error: unknown) => {
        assert.ok(error instanceof InvoiceTotalsMismatchError)
        assert.equal(error.diagnostics.reason, 'NO_ITEMS')
        return true
      }
    )
  })

  it('tolerates a single agora of float noise', () => {
    // Recorded discount and charged total can disagree by one agora purely from
    // the float arithmetic upstream; that is not a reconciliation failure.
    const lines = build({ orderItems, orderLevelDiscount: 100.01, orderTotal: 900 })
    assert.equal(sumLines(lines), 900)
  })

  it('carries the order number into the diagnostics', () => {
    assert.throws(
      () =>
        buildDocumentLines({
          orderItems,
          orderLevelDiscount: 0,
          pointsUsed: 0,
          deliveryFee: 0,
          orderTotal: 700,
          orderNumber: 'ORDER-TEST',
        }),
      (error: unknown) => {
        assert.ok(error instanceof InvoiceTotalsMismatchError)
        assert.equal(error.diagnostics.orderNumber, 'ORDER-TEST')
        return true
      }
    )
  })
})

describe('the gate in front of the Verifone call', () => {
  const okLines = [
    { LineNo: 1, ItemID: '1000-000101', UnitPrice: 300, Qty: 1, DiscountPercent: 0, TotalPrice: 300, VatPercent: VAT, CreditPointsAccumPrecent: 5 },
  ]

  it('passes a document that reconciles', () => {
    assertInvoiceTotalsReconcile({
      documentLines: okLines,
      totals: calculateInvoiceTotals(okLines, 300),
      orderTotal: 300,
    })
  })

  it('refuses to send when the lines exceed the header, as in ORDER-1794766845298', () => {
    // The exact shape Verifone rejected: lines 3763, header 3735.
    const lines = [
      { ...okLines[0], UnitPrice: 3763, TotalPrice: 3763 },
    ]
    assert.throws(
      () =>
        assertInvoiceTotalsReconcile({
          documentLines: lines,
          totals: calculateInvoiceTotals(lines, 3735),
          orderNumber: 'ORDER-1794766845298',
          orderTotal: 3735,
        }),
      (error: unknown) => {
        assert.ok(error instanceof InvoiceTotalsMismatchError)
        assert.equal(error.diagnostics.reason, 'LINES_HEADER_MISMATCH')
        assert.equal(error.diagnostics.sumLinesWithVAT, 3763)
        assert.equal(error.diagnostics.expectedTotalPriceIncludeVAT, 3735)
        // The 28 appears in the message, so the log says what is wrong.
        assert.match(error.message, /difference 28/)
        // And the offending lines are attached for recovery.
        assert.equal(error.diagnostics.lines?.length, 1)
        return true
      }
    )
  })

  it('refuses when the recorded total is not what was charged', () => {
    assert.throws(
      () => assertPaymentAmountMatchesOrderTotal(3735, 3763, 'ORDER-TEST'),
      (error: unknown) => {
        assert.ok(error instanceof InvoiceTotalsMismatchError)
        assert.equal(error.diagnostics.reason, 'ORDER_TOTAL_VS_PAYMENT_MISMATCH')
        assert.equal(error.diagnostics.orderTotal, 3735)
        assert.equal(error.diagnostics.verifiedPaymentAmount, 3763)
        return true
      }
    )
  })

  it('accepts a matching charge, and skips the check when CardCom sent no amount', () => {
    assertPaymentAmountMatchesOrderTotal(3735, 3735)
    assertPaymentAmountMatchesOrderTotal(3735, 3735.004)
    assertPaymentAmountMatchesOrderTotal(3735, null)
    assertPaymentAmountMatchesOrderTotal(3735, undefined)
  })
})

describe('resolveOrderLevelDiscount', () => {
  it('sums the applied coupons', () => {
    assert.equal(
      resolveOrderLevelDiscount({ appliedCoupons: [{ discountAmount: 1000 }, { discountAmount: 18 }] }),
      1018
    )
  })

  it('falls back to the BOGO amount when there are no coupons', () => {
    assert.equal(resolveOrderLevelDiscount({ appliedCoupons: [], bogoDiscountAmount: 249 }), 249)
  })

  it('prefers coupons over BOGO, which checkout forbids combining', () => {
    assert.equal(
      resolveOrderLevelDiscount({ appliedCoupons: [{ discountAmount: 100 }], bogoDiscountAmount: 249 }),
      100
    )
  })

  it('reads a missing discount as zero', () => {
    assert.equal(resolveOrderLevelDiscount({}), 0)
    assert.equal(resolveOrderLevelDiscount({ appliedCoupons: null, bogoDiscountAmount: null }), 0)
  })

  it('reconciles a BOGO order end to end', () => {
    const lines = build({
      orderItems: [item({ price: 690 }), item({ price: 690 })],
      orderLevelDiscount: resolveOrderLevelDiscount({ appliedCoupons: [], bogoDiscountAmount: 345 }),
      orderTotal: 1035,
    })
    assert.equal(sumLines(lines), 1035)
  })
})

describe('line shape Verifone expects', () => {
  it('stamps VAT and points accrual per line kind', () => {
    const lines = build({
      orderItems: [item({ price: 300 })],
      pointsUsed: 20,
      deliveryFee: 35,
      orderTotal: 315,
    })
    const [points, delivery, product] = lines
    assert.equal(points.CreditPointsAccumPrecent, 105)
    assert.equal(delivery.CreditPointsAccumPrecent, 0)
    assert.equal(product.CreditPointsAccumPrecent, 5)
    for (const line of lines) {
      assert.equal(line.VatPercent, VAT)
      // Discounts are carried in UnitPrice, never as a line percentage.
      assert.equal(line.DiscountPercent, 0)
    }
  })

  it('builds the ItemID from SKU, colour and size', () => {
    const lines = build({
      orderItems: [item({ productSku: '5004-0016', colorName: 'dark-brown', size: '37', price: 490 })],
      orderTotal: 490,
    })
    assert.match(lines[0].ItemID, /^5004-0016\d{2}37$/)
  })
})
