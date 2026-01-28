import 'server-only'

import { XMLParser } from 'fast-xml-parser'
import { COLOR_SLUG_TO_CODE } from './inventory'
import { parseSku } from './sku-parser'

const VERIFONE_ENDPOINT =
  'http://62.219.182.125/R360.Server.IIS/Services/Services.asmx'
const VERIFONE_CREATE_INVOICE_SOAP_ACTION = 'http://tempuri.org/CreateInvoice'

const VERIFON_CHAIN_ID = process.env.VERIFON_CHAIN_ID
const VERIFON_USER_NAME = process.env.VERIFON_USER_NAME
const VERIFON_PASSWORD = process.env.VERIFON_PASSWORD

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  textNodeName: 'value',
  parseTagValue: true
})

// Type definitions
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

export type VerifoneReceiptLine = {
  Sum: number
  paymentType: string
  creditCard: {
    PaymentType: string
    FirstPayment: number
    OtherPayments: number
    CreditCardNo: string
    ExpireDate: string
    CreditCardType: string
    CustomerIdentity: string
    ClearanceApproval: string
    NumberOfPayments: number
  }
}

export type VerifoneCreateInvoiceResult = {
  success: boolean
  status?: number
  statusDescription?: string
  invoiceNo?: string
  storeNo?: string
  customerNo?: string
  createDate?: string
  createTime?: string
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

// Helper utilities
function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100
}

function formatDateYYYYMMDD(date: Date | null | undefined): string {
  if (!date || !(date instanceof Date) || Number.isNaN(date.getTime())) {
    const now = new Date()
    const year = now.getUTCFullYear()
    const month = `${now.getUTCMonth() + 1}`.padStart(2, '0')
    const day = `${now.getUTCDate()}`.padStart(2, '0')
    return `${year}${month}${day}`
  }
  const year = date.getUTCFullYear()
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0')
  const day = `${date.getUTCDate()}`.padStart(2, '0')
  return `${year}${month}${day}`
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

function mapCardBrandToVerifoneType(brand: string | null | undefined): string {
  if (!brand) return '9' // Other
  const brandUpper = brand.toUpperCase()
  if (brandUpper.includes('VISA')) return '1'
  if (brandUpper.includes('LEUMI') || brandUpper.includes('LEUMICARD')) return '2'
  if (brandUpper.includes('AMEX') || brandUpper.includes('AMERICAN')) return '5'
  if (brandUpper.includes('DINERS') || brandUpper.includes('DINER')) return '6'
  if (brandUpper.includes('ISRACARD') || brandUpper.includes('ISRA')) return '8'
  return '9' // Other
}

function toBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') {
    const lower = value.trim().toLowerCase()
    return lower === 'true' || lower === '1' || lower === 'yes'
  }
  return false
}

function toInt(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value)
  }
  if (typeof value === 'string') {
    const n = parseInt(value.trim(), 10)
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

// Calculate VAT at line level (CRITICAL: must be done first)
function calculateLineVAT(grossLineTotal: number, vatPercent: number = 18): {
  netLine: number
  vatLine: number
} {
  const vatRate = vatPercent / 100 // 0.18
  const netLine = roundToTwoDecimals(grossLineTotal / (1 + vatRate))
  const vatLine = roundToTwoDecimals(grossLineTotal - netLine)
  return { netLine, vatLine }
}

// Calculate invoice totals from document lines (VAT calculated at line level first)
export function calculateInvoiceTotalsFromLines(
  documentLines: VerifoneInvoiceLine[],
  orderItems: Array<{
    quantity: number
    price: number
    salePrice: number | null
  }>,
  coupons: Array<{ discountAmount: number }>,
  pointsUsed: number,
  deliveryFee: number
): InvoiceTotals {
  const vatRate = 0.18

  // Step 1: Calculate line-level VAT for all lines (AFTER discounts)
  // NOTE: We need to separate points from actual product/delivery lines for discount calculation
  let sumNetLinesAfterDiscount = 0
  let sumVatLinesAfterDiscount = 0
  let sumNetLinesAfterDiscountExcludingPoints = 0 // For discount calculation (points are payment, not discount)
  let sumVatLinesAfterDiscountExcludingPoints = 0

  for (const line of documentLines) {
    const grossLineTotal = line.TotalPrice // VAT included (after discounts)
    const { netLine, vatLine } = calculateLineVAT(Math.abs(grossLineTotal), line.VatPercent)

    // For points line (negative), adjust signs for total calculation
    if (line.Qty < 0) {
      sumNetLinesAfterDiscount -= netLine
      sumVatLinesAfterDiscount -= vatLine
      // Points are NOT included in discount calculation (they're payment, not discount)
    } else {
      sumNetLinesAfterDiscount += netLine
      sumVatLinesAfterDiscount += vatLine
      // Include in discount calculation (products and delivery)
      sumNetLinesAfterDiscountExcludingPoints += netLine
      sumVatLinesAfterDiscountExcludingPoints += vatLine
    }
  }

  // Step 2: Calculate net BEFORE discount (using full prices, excluding points)
  // Points are payment method, not discount, so exclude from discount calculation
  let sumNetLinesBeforeDiscount = 0

  // Products at full price (before sale/coupon)
  for (const item of orderItems) {
    const fullUnitPrice = item.price
    const qty = item.quantity
    const grossBeforeDiscount = qty * fullUnitPrice
    const { netLine } = calculateLineVAT(grossBeforeDiscount, 18)
    sumNetLinesBeforeDiscount += netLine
  }

  // Delivery fee (no discount)
  if (deliveryFee > 0) {
    const { netLine } = calculateLineVAT(deliveryFee, 18)
    sumNetLinesBeforeDiscount += netLine
  }

  // Step 3: Calculate totals
  const TotalAfterDiscount_WithoutVAT = roundToTwoDecimals(sumNetLinesAfterDiscount)
  const VAT = roundToTwoDecimals(sumVatLinesAfterDiscount)
  const TotalPriceIncludeVAT = roundToTwoDecimals(TotalAfterDiscount_WithoutVAT + VAT)

  // Discount calculation: compare BEFORE vs AFTER, EXCLUDING points (points are payment, not discount)
  const TotalBeforeDiscount_WithoutVAT = roundToTwoDecimals(sumNetLinesBeforeDiscount)
  const TotalAfterDiscountExcludingPoints_WithoutVAT = roundToTwoDecimals(sumNetLinesAfterDiscountExcludingPoints)
  let Discount = roundToTwoDecimals(TotalBeforeDiscount_WithoutVAT - TotalAfterDiscountExcludingPoints_WithoutVAT)

  // Discount should never be negative (rounding errors can cause this)
  // If negative, it means there are no actual discounts, so set to 0
  if (Discount < 0) {
    Discount = 0
  }

  // DiscountPercent based on net before discount
  const DiscountPercent = TotalBeforeDiscount_WithoutVAT > 0 && Discount > 0
    ? roundToTwoDecimals((Discount / TotalBeforeDiscount_WithoutVAT) * 100)
    : 0

  // Count items
  const distinctProducts = orderItems.length
  const TotalItems = distinctProducts + (pointsUsed > 0 ? -1 : 0) + (deliveryFee > 0 ? 1 : 0)
  const TotalLines = distinctProducts + (pointsUsed > 0 ? 1 : 0) + (deliveryFee > 0 ? 1 : 0)

  return {
    TotalBeforeDiscount_WithoutVAT,
    Discount,
    DiscountPercent,
    TotalAfterDiscount_WithoutVAT,
    VatPercent: 18,
    VAT,
    TotalPriceIncludeVAT,
    TotalItems,
    TotalLines
  }
}

// Build DocumentLines array
export function buildDocumentLines(
  orderItems: Array<{
    productSku: string
    colorName: string | null
    size: string | null
    quantity: number
    price: number
    salePrice: number | null
  }>,
  coupons: Array<{ discountAmount: number }>,
  pointsUsed: number,
  deliveryFee: number
): VerifoneInvoiceLine[] {
  // Debug: Log input data to identify price issues
  console.log(`[VERIFONE_INVOICE] buildDocumentLines called with ${orderItems.length} items:`,
    orderItems.map((item, idx) => ({
      index: idx,
      productSku: item.productSku,
      price: item.price,
      salePrice: item.salePrice,
      quantity: item.quantity,
      colorName: item.colorName,
      size: item.size
    }))
  )

  const lines: VerifoneInvoiceLine[] = []
  let lineNo = 1
  const couponAmount = coupons.reduce((sum, c) => sum + c.discountAmount, 0)
  let couponRemaining = couponAmount

  // Add points line first if points were used
  if (pointsUsed > 0) {
    lines.push({
      LineNo: 1,
      ItemID: '777',
      UnitPrice: roundToTwoDecimals(pointsUsed),
      Qty: -1,
      DiscountPercent: 0,
      TotalPrice: roundToTwoDecimals(-pointsUsed),
      VatPercent: 18,
      CreditPointsAccumPrecent: 105
    })
    lineNo = 2
  }

  // Add shipping line after points (if deliveryFee > 0)
  if (deliveryFee > 0) {
    lines.push({
      LineNo: lineNo++,
      ItemID: '9000-99990038',
      UnitPrice: roundToTwoDecimals(deliveryFee),
      Qty: 1,
      DiscountPercent: 0,
      TotalPrice: roundToTwoDecimals(deliveryFee),
      VatPercent: 18,
      CreditPointsAccumPrecent: 0
    })
  }

  // Add product lines
  for (let i = 0; i < orderItems.length; i++) {
    const item = orderItems[i]
    const isFirstProductLine = i === 0

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

    // Log for debugging
    if (!item.size || sizeCode === '00') {
      console.warn(`[VERIFONE_INVOICE] Size missing or invalid for item:`, {
        productSku: item.productSku,
        colorName: item.colorName,
        sizeFromItem: item.size,
        sizeExtracted: sizeValue,
        sizeCode,
        itemID,
        baseSku,
        colorCode
      })
    }

    // Calculate prices
    const unitPrice = item.price // Full price before sale
    // Use salePrice only if it exists, is > 0, AND is actually a discount (less than regular price)
    // If salePrice is higher than price, it's invalid data - use regular price instead
    const effectivePrice = (item.salePrice != null && item.salePrice > 0 && item.salePrice < item.price)
      ? item.salePrice
      : item.price

    // Warn if salePrice exists but is invalid (higher than or equal to regular price)
    if (item.salePrice != null && item.salePrice > 0 && item.salePrice >= item.price) {
      console.warn(`[VERIFONE_INVOICE] Invalid salePrice detected (salePrice >= price), using regular price:`, {
        itemID,
        productSku: item.productSku,
        price: item.price,
        salePrice: item.salePrice,
        effectivePrice
      })
    }

    const qty = item.quantity

    // Debug logging to track price per item
    console.log(`[VERIFONE_INVOICE] Processing item ${i + 1}/${orderItems.length}:`, {
      itemID,
      productSku: item.productSku,
      unitPrice,
      salePrice: item.salePrice,
      effectivePrice,
      quantity: qty
    })

    const fullLineTotal = qty * unitPrice
    const baseLineTotal = qty * effectivePrice

    // Apply coupon only to first product line
    let couponApplied = 0
    if (isFirstProductLine && couponRemaining > 0) {
      couponApplied = Math.min(couponRemaining, baseLineTotal)
      couponRemaining -= couponApplied
    }

    // Calculate line discount
    const lineDiscountFromSale = fullLineTotal - baseLineTotal
    const lineDiscountTotal = lineDiscountFromSale + couponApplied
    let lineDiscountPercent = fullLineTotal > 0
      ? roundToTwoDecimals((lineDiscountTotal / fullLineTotal) * 100)
      : 0

    // Discount should never be negative (can happen due to rounding or data inconsistencies)
    // If negative, it means there's no actual discount, so set to 0
    if (lineDiscountPercent < 0) {
      console.warn(`[VERIFONE_INVOICE] Negative discount detected, setting to 0:`, {
        itemID,
        unitPrice,
        effectivePrice,
        fullLineTotal,
        baseLineTotal,
        lineDiscountFromSale,
        couponApplied,
        lineDiscountTotal,
        calculatedDiscountPercent: lineDiscountPercent
      })
      lineDiscountPercent = 0
    }

    // TotalPrice for this line (VAT included) - use effectivePrice
    const totalPrice = roundToTwoDecimals(baseLineTotal - couponApplied)

    lines.push({
      LineNo: lineNo++,
      ItemID: itemID,
      UnitPrice: roundToTwoDecimals(effectivePrice), // Use effectivePrice (salePrice if exists, else unitPrice)
      Qty: qty,
      DiscountPercent: lineDiscountPercent,
      TotalPrice: totalPrice,
      VatPercent: 18,
      CreditPointsAccumPrecent: 5
    })
  }

  return lines
}

// Build ReceiptLines
export function buildReceiptLines(
  transactionInfo: {
    FirstPaymentAmount?: number
    ConstPaymentAmount?: number
    NumberOfPayments?: number
    Last4CardDigitsString?: string
    CardMonth?: string
    CardYear?: string
    ApprovalNumber?: string
    CardOwnerIdentityNumber?: string
    Brand?: string
  },
  totalPrice: number
): VerifoneReceiptLine {
  // Format expire date: MMYY
  let expireDate = '0000'
  if (transactionInfo.CardMonth && transactionInfo.CardYear) {
    const month = transactionInfo.CardMonth.padStart(2, '0')
    const year = transactionInfo.CardYear.length >= 2
      ? transactionInfo.CardYear.slice(-2)
      : transactionInfo.CardYear.padStart(2, '0')
    expireDate = `${month}${year}`
  }

  return {
    Sum: roundToTwoDecimals(totalPrice),
    paymentType: 'CreditCard',
    creditCard: {
      PaymentType: '1',
      FirstPayment: roundToTwoDecimals(transactionInfo.FirstPaymentAmount || totalPrice),
      OtherPayments: roundToTwoDecimals(transactionInfo.ConstPaymentAmount || 0),
      CreditCardNo: transactionInfo.Last4CardDigitsString || '0000',
      ExpireDate: expireDate,
      CreditCardType: mapCardBrandToVerifoneType(transactionInfo.Brand),
      CustomerIdentity: transactionInfo.CardOwnerIdentityNumber || '123456789',
      ClearanceApproval: transactionInfo.ApprovalNumber || '',
      NumberOfPayments: toInt(transactionInfo.NumberOfPayments || 1)
    }
  }
}

// Build SOAP envelope for CreateInvoice
export function buildCreateInvoiceEnvelope(
  order: {
    id: string
    orderNumber: string
    total: number
    customerName: string | null
    createdAt: Date
    deliveryFee: number
    orderItems: Array<{
      productSku: string
      colorName: string | null
      size: string | null
      quantity: number
      price: number
      salePrice: number | null
    }>
    appliedCoupons: Array<{ discountAmount: number }>
    user: { verifoneCustomerNo: string | null } | null
  },
  transactionInfo: {
    FirstPaymentAmount?: number
    ConstPaymentAmount?: number
    NumberOfPayments?: number
    Last4CardDigitsString?: string
    CardMonth?: string
    CardYear?: string
    ApprovalNumber?: string
    CardOwnerIdentityNumber?: string
    Brand?: string
  },
  pointsUsed: number
): string {
  if (!VERIFON_CHAIN_ID || !VERIFON_USER_NAME || !VERIFON_PASSWORD) {
    throw new Error('Missing Verifone credentials')
  }

  // Build document lines first
  const documentLines = buildDocumentLines(
    order.orderItems,
    order.appliedCoupons,
    pointsUsed,
    order.deliveryFee || 0
  )

  // Calculate totals from document lines (VAT calculated at line level)
  const totals = calculateInvoiceTotalsFromLines(
    documentLines,
    order.orderItems.map(item => ({
      quantity: item.quantity,
      price: item.price,
      salePrice: item.salePrice
    })),
    order.appliedCoupons,
    pointsUsed,
    order.deliveryFee || 0
  )

  // Build receipt lines
  const receiptLine = buildReceiptLines(transactionInfo, totals.TotalPriceIncludeVAT)

  // Customer mapping
  const customerNo = order.user?.verifoneCustomerNo
    ? parseInt(order.user.verifoneCustomerNo, 10)
    : 1 // Guest

  // Customer name
  const customerName = order.customerName || 'Guest'

  // Date
  const createDate = formatDateYYYYMMDD(order.createdAt)

  // Log invoice data being built
  console.log('[VERIFONE_CREATE_INVOICE] Building invoice envelope', {
    orderNumber: order.orderNumber,
    customerNo: customerNo,
    customerName: customerName,
    createDate: createDate,
    totals: {
      TotalBeforeDiscount_WithoutVAT: totals.TotalBeforeDiscount_WithoutVAT,
      Discount: totals.Discount,
      DiscountPercent: totals.DiscountPercent,
      TotalAfterDiscount_WithoutVAT: totals.TotalAfterDiscount_WithoutVAT,
      VAT: totals.VAT,
      TotalPriceIncludeVAT: totals.TotalPriceIncludeVAT,
      TotalItems: totals.TotalItems,
      TotalLines: totals.TotalLines
    },
    documentLinesCount: documentLines.length,
    documentLines: documentLines.map(line => ({
      LineNo: line.LineNo,
      ItemID: line.ItemID,
      Qty: line.Qty,
      UnitPrice: line.UnitPrice,
      TotalPrice: line.TotalPrice,
      DiscountPercent: line.DiscountPercent
    })),
    receiptLine: {
      Sum: receiptLine.Sum,
      paymentType: receiptLine.paymentType,
      creditCard: {
        PaymentType: receiptLine.creditCard.PaymentType,
        FirstPayment: receiptLine.creditCard.FirstPayment,
        OtherPayments: receiptLine.creditCard.OtherPayments,
        CreditCardNo: receiptLine.creditCard.CreditCardNo,
        ExpireDate: receiptLine.creditCard.ExpireDate,
        CreditCardType: receiptLine.creditCard.CreditCardType,
        NumberOfPayments: receiptLine.creditCard.NumberOfPayments
      }
    },
    pointsUsed,
    deliveryFee: order.deliveryFee || 0
  })

  // Build XML
  const documentLinesXml = documentLines
    .map(
      line => `          <tem:DocumentLines>
            <tem:LineNo>${line.LineNo}</tem:LineNo>
            <tem:ItemID>${escapeXml(line.ItemID)}</tem:ItemID>
            <tem:UnitPrice>${line.UnitPrice}</tem:UnitPrice>
            <tem:Qty>${line.Qty}</tem:Qty>
            <tem:DiscountPercent>${line.DiscountPercent}</tem:DiscountPercent>
            <tem:TotalPrice>${line.TotalPrice}</tem:TotalPrice>
            <tem:VatPercent>${line.VatPercent}</tem:VatPercent>
            <tem:CreditPointsAccumPrecent>${line.CreditPointsAccumPrecent}</tem:CreditPointsAccumPrecent>
          </tem:DocumentLines>`
    )
    .join('\n')

  return `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/">
  <soapenv:Header/>
  <soapenv:Body>
    <tem:CreateInvoice>
      <tem:User>
        <tem:ChainID>${VERIFON_CHAIN_ID}</tem:ChainID>
        <tem:Username>${VERIFON_USER_NAME}</tem:Username>
        <tem:Password>${VERIFON_PASSWORD}</tem:Password>
      </tem:User>
      <tem:Request>
        <tem:Invoice>
          <tem:DocNo>0</tem:DocNo>
          <tem:DocType>1</tem:DocType>
          <tem:StoreNo>98</tem:StoreNo> <!-- TODO: Change to the store number to 90 -->
          <tem:CustomerNo>${customerNo}</tem:CustomerNo>
          <tem:CustomerName>${escapeXml(customerName)}</tem:CustomerName>
          <tem:CreateDate>${createDate}</tem:CreateDate>
          <tem:SupplyStoreNo>13</tem:SupplyStoreNo>
          <tem:CurrencyID>1</tem:CurrencyID>
          <tem:CurrencyRate>1</tem:CurrencyRate>
          <tem:PriceList>1</tem:PriceList>
          <tem:NotebookID>2</tem:NotebookID>
          <tem:Published>true</tem:Published>
          <tem:TotalBeforeDiscount_WithoutVAT>${totals.TotalBeforeDiscount_WithoutVAT}</tem:TotalBeforeDiscount_WithoutVAT>
          <tem:Discount>${totals.Discount}</tem:Discount>
          <tem:DiscountPercent>${totals.DiscountPercent}</tem:DiscountPercent>
          <tem:TotalAfterDiscount_WithoutVAT>${totals.TotalAfterDiscount_WithoutVAT}</tem:TotalAfterDiscount_WithoutVAT>
          <tem:VatPercent>${totals.VatPercent}</tem:VatPercent>
          <tem:VAT>${totals.VAT}</tem:VAT>
          <tem:TotalPriceIncludeVAT>${totals.TotalPriceIncludeVAT}</tem:TotalPriceIncludeVAT>
          <tem:TotalItems>${totals.TotalItems}</tem:TotalItems>
          <tem:TotalLines>${totals.TotalLines}</tem:TotalLines>
          <tem:Lines>
${documentLinesXml}
          </tem:Lines>
        </tem:Invoice>
        <tem:Receipt>
          <tem:ReceiptNo>0</tem:ReceiptNo>
          <tem:StoreNo>98</tem:StoreNo> <!-- TODO: Change to the store number to 90 -->
          <tem:CustomerNo>${customerNo}</tem:CustomerNo>
          <tem:CustomerName>${escapeXml(customerName)}</tem:CustomerName>
          <tem:CreateDate>${createDate}</tem:CreateDate>
          <tem:CurrencyID>1</tem:CurrencyID>
          <tem:CurrencyRate>1</tem:CurrencyRate>
          <tem:RecieptTotal>${receiptLine.Sum}</tem:RecieptTotal>
          <tem:receiptLines>
            <tem:ReceiptLines>
              <tem:Sum>${receiptLine.Sum}</tem:Sum>
              <tem:paymentType>${receiptLine.paymentType}</tem:paymentType>
              <tem:creditCard>
                <tem:PaymentType>${receiptLine.creditCard.PaymentType}</tem:PaymentType>
                <tem:FirstPayment>${receiptLine.creditCard.FirstPayment}</tem:FirstPayment>
                <tem:OtherPayments>${receiptLine.creditCard.OtherPayments}</tem:OtherPayments>
                <tem:CreditCardNo>${receiptLine.creditCard.CreditCardNo}</tem:CreditCardNo>
                <tem:ExpireDate>${receiptLine.creditCard.ExpireDate}</tem:ExpireDate>
                <tem:CreditCardType>${receiptLine.creditCard.CreditCardType}</tem:CreditCardType>
                <tem:CustomerIdentity>${receiptLine.creditCard.CustomerIdentity}</tem:CustomerIdentity>
                <tem:ClearanceApproval>${receiptLine.creditCard.ClearanceApproval}</tem:ClearanceApproval>
                <tem:NumberOfPayments>${receiptLine.creditCard.NumberOfPayments}</tem:NumberOfPayments>
              </tem:creditCard>
            </tem:ReceiptLines>
          </tem:receiptLines>
        </tem:Receipt>
      </tem:Request>
    </tem:CreateInvoice>
  </soapenv:Body>
</soapenv:Envelope>`
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

// Extract CreateInvoice response payload
function extractCreateInvoicePayload(parsed: any): any {
  try {
    const envelope = parsed['soapenv:Envelope'] ?? parsed['soap:Envelope'] ?? parsed.Envelope
    const body = envelope?.['soapenv:Body'] ?? envelope?.['soap:Body'] ?? envelope?.Body
    if (!body) return null

    const response =
      body['CreateInvoiceResponse'] ??
      body['CreateInvoiceResult'] ??
      Object.values(body)[0]

    const result =
      response?.['CreateInvoiceResult'] ??
      response ??
      body['CreateInvoiceResult']

    return result ?? null
  } catch {
    return null
  }
}

// Call Verifone CreateInvoice API
export async function callVerifoneCreateInvoice(
  soapEnvelope: string
): Promise<VerifoneCreateInvoiceResult> {
  if (!VERIFON_CHAIN_ID || !VERIFON_USER_NAME || !VERIFON_PASSWORD) {
    return {
      success: false,
      statusDescription: 'Missing Verifone credentials'
    }
  }

  const timeoutMs = 10_000

  console.log('[VERIFONE_CREATE_INVOICE] Sending CreateInvoice request', {
    endpoint: VERIFONE_ENDPOINT,
    soapAction: VERIFONE_CREATE_INVOICE_SOAP_ACTION,
    requestSize: soapEnvelope.length,
    requestPreview: soapEnvelope.substring(0, 500) + '...'
  })

  // Log full SOAP request (for debugging)
  console.log('[VERIFONE_CREATE_INVOICE] Full SOAP request:', soapEnvelope)

  const fetchPromise = fetch(VERIFONE_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      SOAPAction: VERIFONE_CREATE_INVOICE_SOAP_ACTION
    },
    body: soapEnvelope
  })

  let response: Response
  try {
    response = (await Promise.race([
      fetchPromise,
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(
            new Error(
              `[VERIFONE_CREATE_INVOICE] Timeout after ${timeoutMs}ms calling Verifone`
            )
          )
        }, timeoutMs)
      })
    ])) as Response
  } catch (err) {
    console.error('[VERIFONE_CREATE_INVOICE] Network/timeout error', err)
    return {
      success: false,
      statusDescription: err instanceof Error ? err.message : 'Verifone request failed'
    }
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    console.error(
      '[VERIFONE_CREATE_INVOICE] HTTP error from Verifone',
      {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        responseBody: text
      }
    )
    return {
      success: false,
      statusDescription: `HTTP ${response.status}`
    }
  }

  const xmlText = await response.text()

  console.log('[VERIFONE_CREATE_INVOICE] Received response', {
    status: response.status,
    statusText: response.statusText,
    responseSize: xmlText.length,
    responsePreview: xmlText.substring(0, 500) + (xmlText.length > 500 ? '...' : '')
  })

  // Log full SOAP response (for debugging)
  console.log('[VERIFONE_CREATE_INVOICE] Full SOAP response:', xmlText)

  try {
    const parsed = xmlParser.parse(xmlText)
    const payload = extractCreateInvoicePayload(parsed)

    if (!payload) {
      console.error(
        '[VERIFONE_CREATE_INVOICE] Unable to extract CreateInvoiceResult payload',
        parsed
      )
      return {
        success: false,
        statusDescription: 'Malformed Verifone response'
      }
    }

    const requestResult = payload.RequestResult ?? payload['RequestResult'] ?? payload

    const isSuccess = toBoolean(
      requestResult.IsSuccess ??
      requestResult['IsSuccess'] ??
      requestResult['Success']
    )
    const status = toInt(requestResult.Status ?? requestResult['Status'])
    const statusDescription =
      requestResult.StatusDescription ??
      requestResult['StatusDescription'] ??
      requestResult['Message'] ??
      undefined

    console.log('[VERIFONE_CREATE_INVOICE] Verifone response meta', {
      isSuccess,
      status,
      statusDescription,
      payloadKeys: Object.keys(payload || {})
    })

    if (!isSuccess || status !== 0) {
      console.error('[VERIFONE_CREATE_INVOICE] Verifone returned error', {
        isSuccess,
        status,
        statusDescription,
        fullPayload: JSON.stringify(payload, null, 2)
      })
      return {
        success: false,
        status,
        statusDescription
      }
    }

    // Extract invoice data
    const data = payload.Data ?? payload['Data']
    const invoiceNo = data?.InvoiceNo ?? data?.['InvoiceNo'] ?? undefined
    const storeNo = data?.StoreNo ?? data?.['StoreNo'] ?? undefined
    const customerNo = data?.CustomerNo ?? data?.['CustomerNo'] ?? undefined
    const createDate = data?.CreateDate ?? data?.['CreateDate'] ?? undefined
    const createTime = data?.CreateTime ?? data?.['CreateTime'] ?? undefined

    const result = {
      success: true,
      status,
      statusDescription,
      invoiceNo: invoiceNo ? String(invoiceNo) : undefined,
      storeNo: storeNo ? String(storeNo) : undefined,
      customerNo: customerNo ? String(customerNo) : undefined,
      createDate: createDate ? String(createDate) : undefined,
      createTime: createTime ? String(createTime) : undefined
    }

    console.log('[VERIFONE_CREATE_INVOICE] Successfully parsed response', {
      invoiceNo: result.invoiceNo,
      storeNo: result.storeNo,
      customerNo: result.customerNo,
      createDate: result.createDate,
      createTime: result.createTime,
      fullData: JSON.stringify(data, null, 2)
    })

    return result
  } catch (err) {
    console.error(
      '[VERIFONE_CREATE_INVOICE] Failed to parse Verifone XML response',
      err
    )
    return {
      success: false,
      statusDescription: 'Failed to parse Verifone XML response'
    }
  }
}
