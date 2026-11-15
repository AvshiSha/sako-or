/**
 * Pure invoice-document math for the Verifone `CreateInvoice` call.
 *
 * Split out of `verifone-invoice.ts` (which is `server-only` and owns the SOAP
 * envelope, the HTTP call and the credentials) so the arithmetic that decides
 * what the customer is invoiced can be unit-tested directly.
 *
 * The one invariant everything here exists to protect:
 *
 *   Σ(product lines) + delivery − points = the amount actually charged
 *
 * Verifone rejects any document where the lines and the header disagree
 * (status 414, "document total is not equal to document lines total"), so the
 * allocation is done in agorot and is exact, and anything that cannot be made
 * to reconcile throws instead of being sent.
 */

// Straight from the colour-code table rather than via `./inventory`, which
// re-exports it but also pulls in firebase-admin and Prisma.
import { COLOR_SLUG_TO_CODE } from './color-codes'
import { parseSku } from './sku-parser'

export const VAT_PERCENT = 18

/**
 * Raised when the invoice we are about to send does not reconcile: the document
 * lines, the header totals and the amount actually charged must agree to the
 * agora, or Verifone rejects the document with status 414. Throwing (instead of
 * logging and sending anyway) is deliberate - a mismatch means our own records
 * are inconsistent and a human has to look at the order.
 */
export type InvoiceTotalsDiagnostics = {
  reason: string
  orderNumber?: string
  orderTotal?: number
  verifiedPaymentAmount?: number
  deliveryFee?: number
  pointsUsed?: number
  recordedDiscount?: number
  merchandiseBase?: number
  targetProductTotal?: number
  impliedDiscount?: number
  sumLinesWithVAT?: number
  headerTotalWithVAT?: number
  expectedTotalPriceIncludeVAT?: number
  lines?: Array<{ LineNo: number; ItemID: string; UnitPrice: number; Qty: number; TotalPrice: number }>
}

export class InvoiceTotalsMismatchError extends Error {
  readonly code = 'INVOICE_TOTALS_MISMATCH'
  readonly diagnostics: InvoiceTotalsDiagnostics

  constructor(message: string, diagnostics: InvoiceTotalsDiagnostics) {
    super(message)
    this.name = 'InvoiceTotalsMismatchError'
    this.diagnostics = diagnostics
  }
}

export type VerifoneInvoiceLine = {
  LineNo: number
  ItemID: string
  UnitPrice: number
  Qty: number
  DiscountPercent: number
  TotalPrice: number
  VatPercent: number
  CreditPointsAccumPrecent: number
}

export type InvoiceTotals = {
  TotalBeforeDiscount_WithoutVAT: number
  Discount: number
  DiscountPercent: number
  TotalAfterDiscount_WithoutVAT: number
  VatPercent: number
  VAT: number
  TotalPriceIncludeVAT: number
  TotalItems: number
  TotalLines: number
}

export function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100
}

function getColorCodeFromSlug(colorSlug: string | null | undefined): string {
  if (!colorSlug) return '00'
  const normalized = colorSlug.toLowerCase().trim()
  return COLOR_SLUG_TO_CODE[normalized] || '00'
}

function formatSizeToTwoDigits(size: string | null | undefined): string {
  if (!size) return '00'

  // Verifone expects "One size" as "OS" (two chars, not digits)
  const normalized = `${size}`.trim().toLowerCase()
  if (
    normalized === 'one size' ||
    normalized === 'one-size' ||
    normalized === 'onesize' ||
    normalized === 'os'
  ) {
    return 'OS'
  }

  const num = parseInt(size, 10)
  if (Number.isNaN(num)) return '00'
  return `${num}`.padStart(2, '0')
}

function toCents(value: number): number {
  return Math.round(value * 100)
}

function fromCents(cents: number): number {
  return Math.round(cents) / 100
}

/**
 * Integer floor division that is immune to float error. `numerator` and
 * `denominator` are both exact integers (agorot), and `numerator` stays well
 * below 2^53 for any realistic order, so the product/quotient corrections below
 * terminate after at most one step.
 */
function floorDiv(numerator: number, denominator: number): { quotient: number; remainder: number } {
  let quotient = Math.floor(numerator / denominator)
  while (quotient * denominator > numerator) quotient -= 1
  while ((quotient + 1) * denominator <= numerator) quotient += 1
  return { quotient, remainder: numerator - quotient * denominator }
}

/**
 * Split `targetCents` across `baseCents` proportionally, using largest-remainder
 * so that the result sums to `targetCents` *exactly* and no entry ever exceeds
 * its own base. Working in agorot (integers) is what makes the sum exact; the
 * previous float-per-line rounding is why line totals could drift away from the
 * amount actually charged.
 */
export function allocateCents(baseCents: number[], targetCents: number): number[] {
  if (baseCents.length === 0) return []

  const totalBase = baseCents.reduce((sum, value) => sum + value, 0)
  if (targetCents === totalBase) return [...baseCents]
  if (totalBase <= 0 || targetCents <= 0) return baseCents.map(() => 0)

  const allocated: number[] = new Array(baseCents.length)
  const remainders: Array<{ index: number; remainder: number }> = []
  let allocatedSum = 0

  for (let i = 0; i < baseCents.length; i++) {
    const { quotient, remainder } = floorDiv(baseCents[i] * targetCents, totalBase)
    allocated[i] = quotient
    allocatedSum += quotient
    remainders.push({ index: i, remainder })
  }

  // Σ of the fractional parts is an integer < (number of non-zero remainders),
  // so there is always enough headroom to hand out the residual agorot without
  // pushing any line above its own base.
  let residual = targetCents - allocatedSum
  remainders.sort((a, b) => b.remainder - a.remainder || a.index - b.index)
  for (const { index } of remainders) {
    if (residual <= 0) break
    if (allocated[index] < baseCents[index]) {
      allocated[index] += 1
      residual -= 1
    }
  }

  if (residual !== 0) {
    throw new InvoiceTotalsMismatchError(
      `Unable to allocate invoice line totals exactly (residual ${residual} agorot)`,
      { reason: 'ALLOCATION_RESIDUAL', targetProductTotal: fromCents(targetCents) }
    )
  }

  return allocated
}

/**
 * The unit price actually charged for an order line, taken from what was
 * recorded when the order was placed - never from the live catalog.
 *
 * `OrderItem.price` already holds the charged price: checkout writes
 * `salePrice ?? price` into it and keeps `salePrice` as a duplicate for display,
 * so `salePrice === price` is the *normal* shape of a discounted line and means
 * nothing is wrong. Older rows stored the pre-sale catalog price in `price` with
 * a genuinely lower `salePrice`, which is the only case the fallback is for.
 */
export function recordedUnitPrice(item: { price: number; salePrice: number | null }): number {
  if (item.salePrice != null && item.salePrice > 0 && item.salePrice < item.price) {
    return item.salePrice
  }
  return item.price
}

/**
 * Order-level discount to spread over the product lines. Checkout rejects
 * combining coupons with the automatic BOGO deal, so coupons win if both are
 * somehow present on an old row.
 */
export function resolveOrderLevelDiscount(order: {
  appliedCoupons?: Array<{ discountAmount: number }> | null
  bogoDiscountAmount?: number | null
}): number {
  const couponTotal = roundToTwoDecimals(
    (order.appliedCoupons ?? []).reduce((sum, coupon) => sum + (coupon.discountAmount || 0), 0)
  )
  if (couponTotal > 0) return couponTotal
  const bogo = roundToTwoDecimals(order.bogoDiscountAmount ?? 0)
  return bogo > 0 ? bogo : 0
}

export type AllocatedProductLine = {
  itemIndex: number
  qty: number
  unitPriceCents: number
  totalCents: number
}

/**
 * Allocate `targetProductCents` across the order's product lines.
 *
 * Allocation happens per *unit* rather than per line, so a line can always be
 * emitted with `UnitPrice * Qty === TotalPrice` exactly. When a line's share
 * cannot be divided evenly over its units (e.g. 100.00 across 3 pairs), it is
 * emitted as two lines a single agora apart instead of silently rounding the
 * document total away from what the customer paid.
 */
export function allocateProductLines(
  items: Array<{ quantity: number; price: number; salePrice: number | null }>,
  targetProductCents: number
): AllocatedProductLine[] {
  const unitItemIndex: number[] = []
  const unitBaseCents: number[] = []

  for (let i = 0; i < items.length; i++) {
    const qty = Math.max(1, Math.trunc(items[i].quantity || 1))
    const unitCents = toCents(recordedUnitPrice(items[i]))
    for (let u = 0; u < qty; u++) {
      unitItemIndex.push(i)
      unitBaseCents.push(unitCents)
    }
  }

  const allocatedUnits = allocateCents(unitBaseCents, targetProductCents)

  const lines: AllocatedProductLine[] = []
  let cursor = 0
  for (let i = 0; i < items.length; i++) {
    const buckets: Array<{ unitPriceCents: number; qty: number }> = []
    while (cursor < unitItemIndex.length && unitItemIndex[cursor] === i) {
      const unitPriceCents = allocatedUnits[cursor]
      const bucket = buckets.find(entry => entry.unitPriceCents === unitPriceCents)
      if (bucket) {
        bucket.qty += 1
      } else {
        buckets.push({ unitPriceCents, qty: 1 })
      }
      cursor += 1
    }
    for (const bucket of buckets) {
      lines.push({
        itemIndex: i,
        qty: bucket.qty,
        unitPriceCents: bucket.unitPriceCents,
        totalCents: bucket.unitPriceCents * bucket.qty
      })
    }
  }

  return lines
}

// Calculate invoice header totals. Derived from the amount actually charged and
// from the lines themselves - never from the live catalog.
export function calculateInvoiceTotals(
  documentLines: VerifoneInvoiceLine[],
  orderTotalPaid: number
): InvoiceTotals {
  const vatRate = VAT_PERCENT / 100

  const TotalPriceIncludeVAT = roundToTwoDecimals(orderTotalPaid)
  const TotalBeforeDiscount_WithoutVAT = roundToTwoDecimals(
    TotalPriceIncludeVAT / (1 + vatRate)
  )
  // VAT by subtraction, not `net * 0.18`: multiplying re-rounds and can leave
  // net + VAT a single agora away from the gross total, which Verifone rejects.
  const VAT = roundToTwoDecimals(TotalPriceIncludeVAT - TotalBeforeDiscount_WithoutVAT)

  // Line-level unit prices are already net of every order-level discount, so the
  // header carries no separate discount.
  const Discount = 0
  const DiscountPercent = 0
  const TotalAfterDiscount_WithoutVAT = TotalBeforeDiscount_WithoutVAT

  return {
    TotalBeforeDiscount_WithoutVAT,
    Discount,
    DiscountPercent,
    TotalAfterDiscount_WithoutVAT,
    VatPercent: VAT_PERCENT,
    VAT,
    TotalPriceIncludeVAT,
    TotalItems: documentLines.reduce((sum, line) => sum + line.Qty, 0),
    TotalLines: documentLines.length
  }
}

/**
 * The amount recorded on the order must equal the amount CardCom says it
 * charged. Checked before anything is built from `Order.total`.
 */
export function assertPaymentAmountMatchesOrderTotal(
  orderTotal: number,
  verifiedPaymentAmount: number | null | undefined,
  orderNumber?: string
): void {
  if (verifiedPaymentAmount == null || !Number.isFinite(verifiedPaymentAmount)) return
  const recorded = roundToTwoDecimals(orderTotal)
  const charged = roundToTwoDecimals(verifiedPaymentAmount)
  if (Math.abs(recorded - charged) > 0.01) {
    throw new InvoiceTotalsMismatchError(
      `Order total ${recorded} does not match the verified payment amount ${charged}`,
      {
        reason: 'ORDER_TOTAL_VS_PAYMENT_MISMATCH',
        orderNumber,
        orderTotal: recorded,
        verifiedPaymentAmount: charged
      }
    )
  }
}

/**
 * Last gate before the envelope is built: the document lines, the header totals
 * and the amount charged must all be the same number, to the agora.
 *
 * Verifone answers status 414 ("document total is not equal to document lines
 * total") when they are not, so this throws rather than logging and sending -
 * logging and sending is what turned ORDER-1794766845298 into a silent
 * invoicing failure after the customer had already been charged.
 */
export function assertInvoiceTotalsReconcile(context: {
  documentLines: VerifoneInvoiceLine[]
  totals: InvoiceTotals
  orderNumber?: string
  orderTotal: number
  verifiedPaymentAmount?: number | null
  deliveryFee?: number
  pointsUsed?: number
  recordedDiscount?: number
}): void {
  const { documentLines, totals } = context

  const sumLinesWithVAT = roundToTwoDecimals(
    documentLines.reduce((sum, line) => sum + line.TotalPrice, 0)
  )
  const headerTotalWithVAT = roundToTwoDecimals(
    totals.TotalAfterDiscount_WithoutVAT + totals.VAT
  )

  if (
    sumLinesWithVAT === totals.TotalPriceIncludeVAT &&
    headerTotalWithVAT === totals.TotalPriceIncludeVAT
  ) {
    return
  }

  const diagnostics: InvoiceTotalsDiagnostics = {
    reason: 'LINES_HEADER_MISMATCH',
    orderNumber: context.orderNumber,
    orderTotal: roundToTwoDecimals(context.orderTotal),
    verifiedPaymentAmount:
      context.verifiedPaymentAmount != null
        ? roundToTwoDecimals(context.verifiedPaymentAmount)
        : undefined,
    deliveryFee: context.deliveryFee,
    pointsUsed: context.pointsUsed,
    recordedDiscount: context.recordedDiscount,
    sumLinesWithVAT,
    headerTotalWithVAT,
    expectedTotalPriceIncludeVAT: totals.TotalPriceIncludeVAT,
    lines: documentLines.map(line => ({
      LineNo: line.LineNo,
      ItemID: line.ItemID,
      UnitPrice: line.UnitPrice,
      Qty: line.Qty,
      TotalPrice: line.TotalPrice
    }))
  }

  console.error(
    '[VERIFONE_CREATE_INVOICE] Invoice totals validation failed - request not sent',
    diagnostics
  )

  throw new InvoiceTotalsMismatchError(
    `Invoice lines total ${sumLinesWithVAT} and header total ${headerTotalWithVAT} do not both equal the charged amount ${totals.TotalPriceIncludeVAT} (difference ${roundToTwoDecimals(sumLinesWithVAT - totals.TotalPriceIncludeVAT)})`,
    diagnostics
  )
}

export type InvoiceOrderItem = {
  productSku: string
  colorName: string | null
  size: string | null
  quantity: number
  price: number
  salePrice: number | null
}

export type BuildDocumentLinesInput = {
  orderItems: InvoiceOrderItem[]
  /** Coupon / BOGO discount recorded on the order (points are a separate line). */
  orderLevelDiscount: number
  /** Points spent, recorded in paymentData. 1 point = 1 ILS. */
  pointsUsed: number
  deliveryFee: number
  /** The amount actually charged for the order (`Order.total`). */
  orderTotal: number
  orderNumber?: string
}

/**
 * Build the Verifone DocumentLines for a completed order.
 *
 * The identity every invoice has to satisfy is
 *
 *   Σ(product lines) + delivery − points = amount charged
 *
 * so the product lines are allocated to `orderTotal − deliveryFee + pointsUsed`,
 * in agorot, and the order-level discount is spread across *all* product lines
 * in proportion to their value.
 *
 * This replaces the previous behaviour, which dumped the whole coupon on the
 * first product line capped at that line's own total: any coupon larger than the
 * first line silently lost the remainder, and the lines then exceeded the header
 * total by exactly that amount (Verifone status 414).
 */
export function buildDocumentLines(input: BuildDocumentLinesInput): VerifoneInvoiceLine[] {
  const { orderItems, pointsUsed, deliveryFee, orderTotal, orderNumber } = input

  const pointsCents = toCents(Math.max(0, pointsUsed || 0))
  const feeCents = toCents(Math.max(0, deliveryFee || 0))
  const totalCents = toCents(orderTotal)
  const recordedDiscountCents = toCents(Math.max(0, input.orderLevelDiscount || 0))

  const merchandiseBaseCents = orderItems.reduce(
    (sum, item) => sum + toCents(recordedUnitPrice(item)) * Math.max(1, Math.trunc(item.quantity || 1)),
    0
  )

  // What the product lines must add up to for the document to reconcile with the
  // amount charged.
  const targetProductCents = totalCents - feeCents + pointsCents
  const impliedDiscountCents = merchandiseBaseCents - targetProductCents

  const diagnostics: InvoiceTotalsDiagnostics = {
    reason: '',
    orderNumber,
    orderTotal: roundToTwoDecimals(orderTotal),
    deliveryFee: fromCents(feeCents),
    pointsUsed: fromCents(pointsCents),
    recordedDiscount: fromCents(recordedDiscountCents),
    merchandiseBase: fromCents(merchandiseBaseCents),
    targetProductTotal: fromCents(targetProductCents),
    impliedDiscount: fromCents(impliedDiscountCents)
  }

  if (orderItems.length === 0) {
    if (targetProductCents !== 0) {
      throw new InvoiceTotalsMismatchError(
        `Order has no items but requires ${fromCents(targetProductCents)} of product lines`,
        { ...diagnostics, reason: 'NO_ITEMS' }
      )
    }
  } else if (targetProductCents < 0) {
    throw new InvoiceTotalsMismatchError(
      `Product lines would have to total ${fromCents(targetProductCents)} (negative)`,
      { ...diagnostics, reason: 'NEGATIVE_PRODUCT_TOTAL' }
    )
  } else if (targetProductCents > merchandiseBaseCents) {
    throw new InvoiceTotalsMismatchError(
      `Product lines would have to total ${fromCents(targetProductCents)}, above the recorded merchandise value ${fromCents(merchandiseBaseCents)}`,
      { ...diagnostics, reason: 'PRODUCT_TOTAL_ABOVE_RECORDED_PRICES' }
    )
  } else if (Math.abs(impliedDiscountCents - recordedDiscountCents) > 1) {
    // The gap between the recorded prices and the amount charged has to be
    // explained by the discount we have on file. If it is not, the order's own
    // records disagree with each other and no invoice should be invented from
    // them.
    throw new InvoiceTotalsMismatchError(
      `Recorded discount ${fromCents(recordedDiscountCents)} does not explain the ${fromCents(impliedDiscountCents)} gap between recorded prices and the amount charged`,
      { ...diagnostics, reason: 'DISCOUNT_DOES_NOT_RECONCILE' }
    )
  }

  const lines: VerifoneInvoiceLine[] = []
  let lineNo = 1

  // Add points line first if points were used
  if (pointsCents > 0) {
    lines.push({
      LineNo: lineNo++,
      ItemID: '777',
      UnitPrice: fromCents(pointsCents),
      Qty: -1,
      DiscountPercent: 0,
      TotalPrice: fromCents(-pointsCents),
      VatPercent: VAT_PERCENT,
      CreditPointsAccumPrecent: 105
    })
  }

  // Add shipping line after points (if deliveryFee > 0)
  if (feeCents > 0) {
    lines.push({
      LineNo: lineNo++,
      ItemID: '9000-99990038',
      UnitPrice: fromCents(feeCents),
      Qty: 1,
      DiscountPercent: 0,
      TotalPrice: fromCents(feeCents),
      VatPercent: VAT_PERCENT,
      CreditPointsAccumPrecent: 0
    })
  }

  // Add product lines, with the order-level discount spread across all of them
  const allocatedLines = allocateProductLines(orderItems, targetProductCents)

  for (const allocated of allocatedLines) {
    const item = orderItems[allocated.itemIndex]

    // Build ItemID: XXXX-XXXXYYZZ format
    // XXXX-XXXX is the base SKU (with dash), YY is color code, ZZ is size
    // Example: 0000-00010135 (0000-0001 is SKU, 01 is black, 35 is size)

    // Extract and format base SKU (should be XXXX-XXXX format)
    let baseSku = item.productSku.trim()

    // If SKU doesn't have a dash, try to format it as XXXX-XXXX
    if (!baseSku.includes('-')) {
      // Remove any existing dashes and format as XXXX-XXXX
      const digitsOnly = baseSku.replace(/-/g, '').replace(/\D/g, '')
      if (digitsOnly.length >= 8) {
        baseSku = `${digitsOnly.substring(0, 4)}-${digitsOnly.substring(4, 8)}`
      } else {
        // Pad with zeros if too short
        const padded = digitsOnly.padEnd(8, '0')
        baseSku = `${padded.substring(0, 4)}-${padded.substring(4, 8)}`
      }
    } else {
      // SKU has dash, ensure it's in XXXX-XXXX format
      const parts = baseSku.split('-')
      if (parts.length >= 2) {
        const part1 = parts[0].replace(/\D/g, '').padStart(4, '0').substring(0, 4)
        const part2 = parts.slice(1).join('').replace(/\D/g, '').padStart(4, '0').substring(0, 4)
        baseSku = `${part1}-${part2}`
      } else {
        // Fallback: format as XXXX-XXXX
        const digitsOnly = baseSku.replace(/-/g, '').replace(/\D/g, '').padEnd(8, '0')
        baseSku = `${digitsOnly.substring(0, 4)}-${digitsOnly.substring(4, 8)}`
      }
    }

    const colorCode = getColorCodeFromSlug(item.colorName)

    // Try to get size from item.size, if null try to parse from productSku
    let sizeValue = item.size
    if (!sizeValue && item.productSku) {
      // Try to extract size from productSku using parseSku function
      // Note: productSku in OrderItem might be baseSku only, but try anyway
      const parsed = parseSku(item.productSku)
      if (parsed.size) {
        sizeValue = parsed.size
      }
    }

    const sizeCode = formatSizeToTwoDigits(sizeValue)

    // ItemID format: XXXX-XXXXYYZZ (base SKU with dash + 2-digit color + 2-digit size)
    const itemID = `${baseSku}${colorCode}${sizeCode}`

    if (!item.size || sizeCode === '00') {
      console.warn(`[VERIFONE_INVOICE] Size missing or invalid for line ${lineNo}, itemID: ${itemID}`)
    }

    // `salePrice === price` is how checkout records a discounted item (price
    // already holds the charged price), so it is not a fault. Only a salePrice
    // strictly above the charged price is odd enough to be worth a log line, and
    // it changes nothing about the amounts below.
    if (item.salePrice != null && item.salePrice > item.price) {
      console.warn(
        `[VERIFONE_INVOICE] salePrice (${item.salePrice}) above recorded charged price (${item.price}) for line ${lineNo}, itemID: ${itemID} - using the recorded charged price`
      )
    }

    lines.push({
      LineNo: lineNo++,
      ItemID: itemID,
      // Per-unit price actually paid (VAT included), net of the order-level
      // discount allocated to this line.
      UnitPrice: fromCents(allocated.unitPriceCents),
      Qty: allocated.qty,
      DiscountPercent: 0,
      TotalPrice: fromCents(allocated.totalCents),
      VatPercent: VAT_PERCENT,
      CreditPointsAccumPrecent: 5
    })
  }

  return lines
}
