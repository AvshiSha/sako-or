import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { XMLParser } from 'fast-xml-parser'
import { prisma } from '@/lib/prisma'
import { requireUserAuth } from '@/lib/server/auth'

const VERIFONE_ENDPOINT =
  'http://62.219.182.125/R360.Server.IIS/Services/Services.asmx'
const VERIFONE_CREATE_INVOICE_SOAP_ACTION = 'http://tempuri.org/CreateInvoice'

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  textNodeName: 'value',
  parseTagValue: true
})

const ManualUserSchema = z.object({
  ChainID: z.string().min(1),
  Username: z.string().min(1),
  Password: z.string().min(1)
})

const InvoiceSchema = z.object({
  DocNo: z.union([z.number().int(), z.string().min(1)]),
  DocType: z.union([z.number().int(), z.string().min(1)]),
  StoreNo: z.union([z.number().int(), z.string().min(1)]),
  CustomerNo: z.union([z.number().int(), z.string().min(1)]),
  CustomerName: z.string().min(1),
  CreateDate: z.string().regex(/^\d{8}$/), // YYYYMMDD
  SupplyStoreNo: z.union([z.number().int(), z.string().min(1)]),
  CurrencyID: z.union([z.number().int(), z.string().min(1)]),
  CurrencyRate: z.union([z.number(), z.string().min(1)]),
  PriceList: z.union([z.number().int(), z.string().min(1)]),
  NotebookID: z.union([z.number().int(), z.string().min(1)]),
  Published: z.union([z.boolean(), z.string().min(1)]),
  TotalBeforeDiscount_WithoutVAT: z.union([z.number(), z.string().min(1)]),
  Discount: z.union([z.number(), z.string().min(1)]),
  DiscountPercent: z.union([z.number(), z.string().min(1)]),
  TotalAfterDiscount_WithoutVAT: z.union([z.number(), z.string().min(1)]),
  VatPercent: z.union([z.number(), z.string().min(1)]),
  VAT: z.union([z.number(), z.string().min(1)]),
  TotalPriceIncludeVAT: z.union([z.number(), z.string().min(1)]),
  TotalItems: z.union([z.number().int(), z.string().min(1)]),
  TotalLines: z.union([z.number().int(), z.string().min(1)])
})

const DocumentLineSchema = z.object({
  LineNo: z.union([z.number().int(), z.string().min(1)]),
  ItemID: z.string().min(1),
  UnitPrice: z.union([z.number(), z.string().min(1)]),
  Qty: z.union([z.number(), z.string().min(1)]),
  DiscountPercent: z.union([z.number(), z.string().min(1)]),
  TotalPrice: z.union([z.number(), z.string().min(1)]),
  VatPercent: z.union([z.number(), z.string().min(1)]),
  CreditPointsAccumPrecent: z.union([z.number(), z.string().min(1)])
})

const CreditCardSchema = z.object({
  PaymentType: z.string().min(1),
  FirstPayment: z.union([z.number(), z.string().min(1)]),
  OtherPayments: z.union([z.number(), z.string().min(1)]),
  CreditCardNo: z.string().min(1),
  ExpireDate: z.string().min(1),
  CreditCardType: z.string().min(1),
  CustomerIdentity: z.string().min(1),
  ClearanceApproval: z.string().optional().default(''),
  NumberOfPayments: z.union([z.number().int(), z.string().min(1)])
})

const ReceiptLinesSchema = z.object({
  Sum: z.union([z.number(), z.string().min(1)]),
  paymentType: z.string().min(1),
  creditCard: CreditCardSchema
})

const ReceiptSchema = z.object({
  ReceiptNo: z.union([z.number().int(), z.string().min(1)]),
  StoreNo: z.union([z.number().int(), z.string().min(1)]),
  CustomerNo: z.union([z.number().int(), z.string().min(1)]),
  CustomerName: z.string().min(1),
  CreateDate: z.string().regex(/^\d{8}$/),
  CurrencyID: z.union([z.number().int(), z.string().min(1)]),
  CurrencyRate: z.union([z.number(), z.string().min(1)]),
  RecieptTotal: z.union([z.number(), z.string().min(1)]),
  receiptLines: ReceiptLinesSchema
})

const ManualCreateInvoiceSchema = z.object({
  orderNumber: z.string().min(1).optional(),
  user: ManualUserSchema,
  invoice: InvoiceSchema,
  documentLines: z.array(DocumentLineSchema).min(1),
  receipt: ReceiptSchema
})

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
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
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value)
  if (typeof value === 'string') {
    const n = parseInt(value.trim(), 10)
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

function extractCreateInvoicePayload(parsed: any): any {
  try {
    const envelope =
      parsed['soapenv:Envelope'] ?? parsed['soap:Envelope'] ?? parsed.Envelope
    const body =
      envelope?.['soapenv:Body'] ?? envelope?.['soap:Body'] ?? envelope?.Body
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

function buildManualCreateInvoiceEnvelope(input: z.infer<typeof ManualCreateInvoiceSchema>): string {
  const linesXml = input.documentLines
    .map(
      (line) => `          <tem:DocumentLines>
            <tem:LineNo>${line.LineNo}</tem:LineNo>
            <tem:ItemID>${escapeXml(String(line.ItemID))}</tem:ItemID>
            <tem:UnitPrice>${line.UnitPrice}</tem:UnitPrice>
            <tem:Qty>${line.Qty}</tem:Qty>
            <tem:DiscountPercent>${line.DiscountPercent}</tem:DiscountPercent>
            <tem:TotalPrice>${line.TotalPrice}</tem:TotalPrice>
            <tem:VatPercent>${line.VatPercent}</tem:VatPercent>
            <tem:CreditPointsAccumPrecent>${line.CreditPointsAccumPrecent}</tem:CreditPointsAccumPrecent>
          </tem:DocumentLines>`
    )
    .join('\n')

  const invoice = input.invoice
  const receipt = input.receipt
  const receiptLines = receipt.receiptLines
  const cc = receiptLines.creditCard

  return `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/">
  <soapenv:Header/>
  <soapenv:Body>
    <tem:CreateInvoice>
      <tem:User>
        <tem:ChainID>${escapeXml(input.user.ChainID)}</tem:ChainID>
        <tem:Username>${escapeXml(input.user.Username)}</tem:Username>
        <tem:Password>${escapeXml(input.user.Password)}</tem:Password>
      </tem:User>
      <tem:Request>
        <tem:Invoice>
          <tem:DocNo>${invoice.DocNo}</tem:DocNo>
          <tem:DocType>${invoice.DocType}</tem:DocType>
          <tem:StoreNo>${invoice.StoreNo}</tem:StoreNo>
          <tem:CustomerNo>${invoice.CustomerNo}</tem:CustomerNo>
          <tem:CustomerName>${escapeXml(invoice.CustomerName)}</tem:CustomerName>
          <tem:CreateDate>${invoice.CreateDate}</tem:CreateDate>
          <tem:SupplyStoreNo>${invoice.SupplyStoreNo}</tem:SupplyStoreNo>
          <tem:CurrencyID>${invoice.CurrencyID}</tem:CurrencyID>
          <tem:CurrencyRate>${invoice.CurrencyRate}</tem:CurrencyRate>
          <tem:PriceList>${invoice.PriceList}</tem:PriceList>
          <tem:NotebookID>${invoice.NotebookID}</tem:NotebookID>
          <tem:Published>${invoice.Published}</tem:Published>
          <tem:TotalBeforeDiscount_WithoutVAT>${invoice.TotalBeforeDiscount_WithoutVAT}</tem:TotalBeforeDiscount_WithoutVAT>
          <tem:Discount>${invoice.Discount}</tem:Discount>
          <tem:DiscountPercent>${invoice.DiscountPercent}</tem:DiscountPercent>
          <tem:TotalAfterDiscount_WithoutVAT>${invoice.TotalAfterDiscount_WithoutVAT}</tem:TotalAfterDiscount_WithoutVAT>
          <tem:VatPercent>${invoice.VatPercent}</tem:VatPercent>
          <tem:VAT>${invoice.VAT}</tem:VAT>
          <tem:TotalPriceIncludeVAT>${invoice.TotalPriceIncludeVAT}</tem:TotalPriceIncludeVAT>
          <tem:TotalItems>${invoice.TotalItems}</tem:TotalItems>
          <tem:TotalLines>${invoice.TotalLines}</tem:TotalLines>
          <tem:Lines>
${linesXml}
          </tem:Lines>
        </tem:Invoice>
        <tem:Receipt>
          <tem:ReceiptNo>${receipt.ReceiptNo}</tem:ReceiptNo>
          <tem:StoreNo>${receipt.StoreNo}</tem:StoreNo>
          <tem:CustomerNo>${receipt.CustomerNo}</tem:CustomerNo>
          <tem:CustomerName>${escapeXml(receipt.CustomerName)}</tem:CustomerName>
          <tem:CreateDate>${receipt.CreateDate}</tem:CreateDate>
          <tem:CurrencyID>${receipt.CurrencyID}</tem:CurrencyID>
          <tem:CurrencyRate>${receipt.CurrencyRate}</tem:CurrencyRate>
          <tem:RecieptTotal>${receipt.RecieptTotal}</tem:RecieptTotal>
          <tem:receiptLines>
            <tem:ReceiptLines>
              <tem:Sum>${receiptLines.Sum}</tem:Sum>
              <tem:paymentType>${escapeXml(receiptLines.paymentType)}</tem:paymentType>
              <tem:creditCard>
                <tem:PaymentType>${escapeXml(cc.PaymentType)}</tem:PaymentType>
                <tem:FirstPayment>${cc.FirstPayment}</tem:FirstPayment>
                <tem:OtherPayments>${cc.OtherPayments}</tem:OtherPayments>
                <tem:CreditCardNo>${escapeXml(cc.CreditCardNo)}</tem:CreditCardNo>
                <tem:ExpireDate>${escapeXml(cc.ExpireDate)}</tem:ExpireDate>
                <tem:CreditCardType>${escapeXml(cc.CreditCardType)}</tem:CreditCardType>
                <tem:CustomerIdentity>${escapeXml(cc.CustomerIdentity)}</tem:CustomerIdentity>
                <tem:ClearanceApproval>${escapeXml(cc.ClearanceApproval ?? '')}</tem:ClearanceApproval>
                <tem:NumberOfPayments>${cc.NumberOfPayments}</tem:NumberOfPayments>
              </tem:creditCard>
            </tem:ReceiptLines>
          </tem:receiptLines>
        </tem:Receipt>
      </tem:Request>
    </tem:CreateInvoice>
  </soapenv:Body>
</soapenv:Envelope>`
}

export async function POST(request: NextRequest) {
  const auth = await requireUserAuth(request)
  if (auth instanceof NextResponse) return auth
  if (!auth.isAdmin) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const parsed = ManualCreateInvoiceSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid payload', issues: parsed.error.issues },
      { status: 400 }
    )
  }

  const input = parsed.data

  const requestJsonForAudit = {
    orderNumber: input.orderNumber,
    user: {
      ChainID: input.user.ChainID,
      Username: input.user.Username
    },
    invoice: input.invoice,
    documentLines: input.documentLines,
    receipt: input.receipt
  }

  const audit = await prisma.verifoneManualInvoiceAudit.create({
    data: {
      adminEmail: auth.email ?? 'unknown',
      orderNumber: input.orderNumber ?? null,
      requestJson: requestJsonForAudit as any
    }
  })

  const soapEnvelope = buildManualCreateInvoiceEnvelope(input)

  console.log('[ADMIN_VERIFONE_MANUAL_INVOICE] Sending CreateInvoice', {
    auditId: audit.id,
    orderNumber: input.orderNumber ?? null,
    invoiceStoreNo: input.invoice.StoreNo,
    documentLinesCount: input.documentLines.length,
    requestSize: soapEnvelope.length
  })

  const timeoutMs = 15_000
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  let httpStatus: number | null = null
  let responseXml: string | null = null
  let responseParsed: any = null
  let errorMessage: string | null = null

  try {
    const res = await fetch(VERIFONE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        SOAPAction: VERIFONE_CREATE_INVOICE_SOAP_ACTION
      },
      body: soapEnvelope,
      signal: controller.signal
    })

    httpStatus = res.status
    responseXml = await res.text()

    // Best-effort parse even on non-200 (Verifone sometimes returns SOAP faults)
    try {
      const parsedXml = xmlParser.parse(responseXml)
      const payload = extractCreateInvoicePayload(parsedXml)
      const requestResult = payload?.RequestResult ?? payload?.['RequestResult'] ?? payload

      const isSuccess = toBoolean(
        requestResult?.IsSuccess ??
          requestResult?.['IsSuccess'] ??
          requestResult?.['Success']
      )
      const status = toInt(requestResult?.Status ?? requestResult?.['Status'])
      const statusDescription =
        requestResult?.StatusDescription ??
        requestResult?.['StatusDescription'] ??
        requestResult?.['Message'] ??
        undefined

      const data = payload?.Data ?? payload?.['Data']
      responseParsed = {
        success: Boolean(isSuccess && status === 0),
        status,
        statusDescription,
        invoiceNo: data?.InvoiceNo ?? data?.['InvoiceNo'] ?? undefined,
        storeNo: data?.StoreNo ?? data?.['StoreNo'] ?? undefined,
        customerNo: data?.CustomerNo ?? data?.['CustomerNo'] ?? undefined,
        createDate: data?.CreateDate ?? data?.['CreateDate'] ?? undefined,
        createTime: data?.CreateTime ?? data?.['CreateTime'] ?? undefined
      }
    } catch (parseErr) {
      responseParsed = {
        success: false,
        statusDescription: 'Failed to parse Verifone XML response'
      }
      console.error('[ADMIN_VERIFONE_MANUAL_INVOICE] Failed to parse response XML', {
        auditId: audit.id,
        error: parseErr
      })
    }

    if (!res.ok) {
      errorMessage = `HTTP ${res.status}`
    } else if (responseParsed && responseParsed.success === false) {
      errorMessage = responseParsed.statusDescription || 'Verifone returned error'
    }

    return NextResponse.json({
      auditId: audit.id,
      success: Boolean(responseParsed?.success),
      httpStatus,
      parsedResult: responseParsed,
      rawResponseXml: responseXml
    })
  } catch (err: any) {
    errorMessage =
      err?.name === 'AbortError'
        ? `Timeout after ${timeoutMs}ms calling Verifone`
        : err instanceof Error
          ? err.message
          : 'Verifone request failed'

    console.error('[ADMIN_VERIFONE_MANUAL_INVOICE] Network/timeout error', {
      auditId: audit.id,
      errorMessage
    })

    return NextResponse.json(
      {
        auditId: audit.id,
        success: false,
        httpStatus,
        parsedResult: null,
        rawResponseXml: responseXml,
        error: errorMessage
      },
      { status: 502 }
    )
  } finally {
    clearTimeout(timeout)
    try {
      await prisma.verifoneManualInvoiceAudit.update({
        where: { id: audit.id },
        data: {
          responseXml,
          responseParsed: (responseParsed ?? undefined) as any,
          httpStatus: httpStatus ?? undefined,
          errorMessage: errorMessage ?? undefined
        }
      })
    } catch (e) {
      console.error('[ADMIN_VERIFONE_MANUAL_INVOICE] Failed to persist audit update', {
        auditId: audit.id,
        error: e
      })
    }
  }
}

