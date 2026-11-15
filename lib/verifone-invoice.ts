import 'server-only'

import { XMLParser } from 'fast-xml-parser'
import {
  assertInvoiceTotalsReconcile,
  assertPaymentAmountMatchesOrderTotal,
  buildDocumentLines,
  calculateInvoiceTotals,
  resolveOrderLevelDiscount,
  roundToTwoDecimals,
  type InvoiceOrderItem
} from './verifone-invoice-lines'

// The invoice arithmetic lives in a pure module so it can be unit-tested; it is
// re-exported here so callers keep a single entry point.
export {
  InvoiceTotalsMismatchError,
  allocateCents,
  allocateProductLines,
  assertInvoiceTotalsReconcile,
  assertPaymentAmountMatchesOrderTotal,
  buildDocumentLines,
  calculateInvoiceTotals,
  recordedUnitPrice,
  resolveOrderLevelDiscount,
  roundToTwoDecimals
} from './verifone-invoice-lines'
export type {
  AllocatedProductLine,
  BuildDocumentLinesInput,
  InvoiceOrderItem,
  InvoiceTotals,
  InvoiceTotalsDiagnostics,
  VerifoneInvoiceLine
} from './verifone-invoice-lines'

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


// Build ReceiptLines
export function buildReceiptLines(
  transactionInfo: InvoiceTransactionInfo,
  totalPrice: number
): VerifoneReceiptLine {
  // Format expire date: MMYY (CardCom may send CardMonth/CardYear as numbers)
  let expireDate = '0000'
  if (transactionInfo.CardMonth != null && transactionInfo.CardYear != null) {
    const monthStr = String(transactionInfo.CardMonth)
    const yearStr = String(transactionInfo.CardYear)
    const month = monthStr.padStart(2, '0')
    const year = yearStr.length >= 2 ? yearStr.slice(-2) : yearStr.padStart(2, '0')
    expireDate = `${month}${year}`
  }

  return {
    Sum: roundToTwoDecimals(totalPrice),
    paymentType: 'CreditCard',
    creditCard: {
      PaymentType: '3',
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

export type InvoiceTransactionInfo = {
  /** Amount CardCom actually charged, when available - cross-checked against Order.total. */
  Amount?: number
  FirstPaymentAmount?: number
  ConstPaymentAmount?: number
  NumberOfPayments?: number
  Last4CardDigitsString?: string
  CardMonth?: string
  CardYear?: string
  ApprovalNumber?: string
  CardOwnerIdentityNumber?: string
  Brand?: string
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
    orderItems: InvoiceOrderItem[]
    appliedCoupons: Array<{ discountAmount: number }>
    bogoDiscountAmount?: number | null
    user: { verifoneCustomerNo: string | null } | null
  },
  transactionInfo: InvoiceTransactionInfo,
  pointsUsed: number
): string {
  if (!VERIFON_CHAIN_ID || !VERIFON_USER_NAME || !VERIFON_PASSWORD) {
    throw new Error('Missing Verifone credentials')
  }

  const orderLevelDiscount = resolveOrderLevelDiscount(order)
  const deliveryFee = order.deliveryFee || 0

  // The invoice must equal the money actually taken. When CardCom told us the
  // charged amount, require the order's recorded total to match it before
  // anything is built from that total.
  assertPaymentAmountMatchesOrderTotal(order.total, transactionInfo.Amount, order.orderNumber)

  // Build document lines first (throws if the order's own records don't reconcile)
  const documentLines = buildDocumentLines({
    orderItems: order.orderItems,
    orderLevelDiscount,
    pointsUsed,
    deliveryFee,
    orderTotal: order.total,
    orderNumber: order.orderNumber
  })

  // Calculate header totals from the paid order total (CardCom amount)
  const totals = calculateInvoiceTotals(documentLines, order.total)

  // Validation: lines, header and the amount charged must agree to the agora.
  // Throws rather than sending an unsendable document.
  assertInvoiceTotalsReconcile({
    documentLines,
    totals,
    orderNumber: order.orderNumber,
    orderTotal: order.total,
    verifiedPaymentAmount: transactionInfo.Amount,
    deliveryFee,
    pointsUsed,
    recordedDiscount: orderLevelDiscount
  })

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
          <tem:StoreNo>90</tem:StoreNo> <!-- TODO: Change to the store number to 90 -->
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
          <tem:StoreNo>90</tem:StoreNo> <!-- TODO: Change to the store number to 90 -->
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
    requestSize: soapEnvelope.length
  })


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
    console.error('[VERIFONE_CREATE_INVOICE] HTTP error from Verifone', {
      status: response.status,
      statusText: response.statusText
    })
    return {
      success: false,
      statusDescription: `HTTP ${response.status}`
    }
  }

  const xmlText = await response.text()

  try {
    const parsed = xmlParser.parse(xmlText)
    const payload = extractCreateInvoicePayload(parsed)

    if (!payload) {
      console.error('[VERIFONE_CREATE_INVOICE] Unable to extract CreateInvoiceResult payload')
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

    if (!isSuccess || status !== 0) {
      console.error('[VERIFONE_CREATE_INVOICE] Verifone returned error', {
        isSuccess,
        status,
        statusDescription
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

    console.log('[VERIFONE_CREATE_INVOICE] Success', { invoiceNo: result.invoiceNo, storeNo: result.storeNo })

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
