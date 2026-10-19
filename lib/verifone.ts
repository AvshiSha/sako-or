import 'server-only'

import { XMLParser } from 'fast-xml-parser'
import { e164ToLocalPhone } from './inforu'
import {
  parseStockByModelXml,
  type VerifoneGetStockByModelResult,
  type VerifoneItemStock
} from './verifone-stock-parse'

const VERIFONE_ENDPOINT =
  'http://62.219.182.125/R360.Server.IIS/Services/Services.asmx'
const VERIFONE_SOAP_ACTION = 'http://tempuri.org/GetCustomers'

const VERIFON_CHAIN_ID = process.env.VERIFON_CHAIN_ID
const VERIFON_USER_NAME = process.env.VERIFON_USER_NAME
const VERIFON_PASSWORD = process.env.VERIFON_PASSWORD

const VERIFONE_CREATE_OR_UPDATE_SOAP_ACTION =
  'http://tempuri.org/CreateOrUpdateCustomer'

const VERIFONE_GET_STOCK_BY_MODEL_SOAP_ACTION =
  'http://tempuri.org/GetStockByModel'

export type VerifoneCustomer = {
  isClubMember: boolean
  creditPoints: number
  customerNo?: string | null
}

export type VerifoneGetCustomersResult = {
  success: boolean
  status?: number
  statusDescription?: string
  customer?: VerifoneCustomer
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  textNodeName: 'value',
  parseTagValue: true
})

function buildGetCustomersEnvelope(cellular: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
               xmlns:xsd="http://www.w3.org/2001/XMLSchema"
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetCustomers xmlns="http://tempuri.org/">
      <User>
        <ChainID>${VERIFON_CHAIN_ID}</ChainID>
        <Username>${VERIFON_USER_NAME}</Username>
        <Password>${VERIFON_PASSWORD}</Password>
      </User>
      <Request>
        <Cellular>${cellular}</Cellular>
      </Request>
    </GetCustomers>
  </soap:Body>
</soap:Envelope>`
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

function toDecimal(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string') {
    const n = parseFloat(value.trim())
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

function extractGetCustomersPayload(parsed: any) {
  try {
    const envelope = parsed['soap:Envelope'] ?? parsed.Envelope
    const body = envelope?.['soap:Body'] ?? envelope?.Body
    if (!body) return null

    const response =
      body['GetCustomersResponse'] ??
      body['GetCustomersResult'] ??
      Object.values(body)[0]

    const result =
      response?.['GetCustomersResult'] ??
      response ??
      body['GetCustomersResult']

    return result ?? null
  } catch {
    return null
  }
}

function formatDateYYYYMMDD(date: Date | null | undefined): string | null {
  if (!date || !(date instanceof Date) || Number.isNaN(date.getTime())) {
    return null
  }
  const year = date.getUTCFullYear()
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0')
  const day = `${date.getUTCDate()}`.padStart(2, '0')
  return `${year}${month}${day}`
}

type VerifoneCreateOrUpdateCustomerInput = {
  customerNo: string | number
  firstName: string | null
  lastName: string | null
  phoneE164: string | null
  email: string | null
  addressCity: string | null
  addressStreet: string | null
  addressStreetNumber: string | null
  addressApt: string | null
  addressFloor: string | null
  birthday: Date | null
  isNewsletter: boolean
  ClassCode: string | null
}

export type VerifoneCreateOrUpdateCustomerResult = {
  success: boolean
  status?: number
  statusDescription?: string
  customerNo?: string | null
}

// Defined in `./verifone-stock-parse` and re-exported so that every existing
// import of these types from `lib/verifone` keeps resolving.
export type { VerifoneItemStock, VerifoneGetStockByModelResult }

function buildGetStockByModelEnvelope(itemCode: string): string | null {
  if (!VERIFON_CHAIN_ID || !VERIFON_USER_NAME || !VERIFON_PASSWORD) {
    console.error(
      '[VERIFONE_GET_STOCK_BY_MODEL] Missing Verifone env vars: VERIFON_CHAIN_ID / VERIFON_USER_NAME / VERIFON_PASSWORD'
    )
    return null
  }

  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
               xmlns:xsd="http://www.w3.org/2001/XMLSchema"
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetStockByModel xmlns="http://tempuri.org/">
      <User>
        <ChainID>${VERIFON_CHAIN_ID}</ChainID>
        <Username>${VERIFON_USER_NAME}</Username>
        <Password>${VERIFON_PASSWORD}</Password>
      </User>
      <Request>
        <ItemCode>${itemCode}</ItemCode>
        <StoreId>13</StoreId>
      </Request>
    </GetStockByModel>
  </soap:Body>
</soap:Envelope>`
}


function buildCreateOrUpdateCustomerEnvelope(
  input: VerifoneCreateOrUpdateCustomerInput
): string | null {
  if (!VERIFON_CHAIN_ID || !VERIFON_USER_NAME || !VERIFON_PASSWORD) {
    console.error(
      '[VERIFONE_CREATE_OR_UPDATE] Missing Verifone env vars: VERIFON_CHAIN_ID / VERIFON_USER_NAME / VERIFON_PASSWORD'
    )
    return null
  }

  const localPhone = input.phoneE164 ? e164ToLocalPhone(input.phoneE164) : null
  if (!localPhone) {
    console.warn('[VERIFONE_CREATE_OR_UPDATE] Skipping - cannot convert phone to local format')
    return null
  }

  const birthDate = formatDateYYYYMMDD(input.birthday)

  // Marketing permissions mapping from isNewsletter
  const marketingFlag = input.isNewsletter ? 1 : 0

  const customerNoStr = String(input.customerNo ?? '0')

  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
               xmlns:xsd="http://www.w3.org/2001/XMLSchema"
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <CreateOrUpdateCustomer xmlns="http://tempuri.org/">
      <User>
        <ChainID>${VERIFON_CHAIN_ID}</ChainID>
        <Username>${VERIFON_USER_NAME}</Username>
        <Password>${VERIFON_PASSWORD}</Password>
      </User>
      <Request>
        <Customer>
          <CustomerNo>${customerNoStr}</CustomerNo>

          <FirstName>${input.firstName ?? ''}</FirstName>
          <LastName>${input.lastName ?? ''}</LastName>
          <CustomerName>${(input.firstName || '')} ${(input.lastName || '')}</CustomerName>

          <CellPhone>${localPhone}</CellPhone>
          <Email>${input.email ?? ''}</Email>

          <City>${input.addressCity ?? ''}</City>
          <Street>${input.addressStreet ?? ''}</Street>
          <HouseNumber>${input.addressStreetNumber ?? ''}</HouseNumber>
          <Apartment>${input.addressApt ?? ''}</Apartment>
          <Floor>${input.addressFloor ?? ''}</Floor>
          <Country>10</Country>

          <BirthDate>${birthDate ?? ''}</BirthDate>

          <IsEmailAccept>${marketingFlag}</IsEmailAccept>
          <IsSMSAccepts>${marketingFlag}</IsSMSAccepts>
          <IsMailAccept>${marketingFlag}</IsMailAccept>

          <ChainNo>${VERIFON_CHAIN_ID}</ChainNo>
          <ClassCode>2</ClassCode>
          <StoreNo>90</StoreNo>
        </Customer>
      </Request>
    </CreateOrUpdateCustomer>
  </soap:Body>
</soap:Envelope>`
}

function extractCreateOrUpdateCustomerPayload(parsed: any) {
  try {
    const envelope = parsed['soap:Envelope'] ?? parsed.Envelope
    const body = envelope?.['soap:Body'] ?? envelope?.Body
    if (!body) return null

    const response =
      body['CreateOrUpdateCustomerResponse'] ??
      body['CreateOrUpdateCustomerResult'] ??
      Object.values(body)[0]

    const result =
      response?.['CreateOrUpdateCustomerResult'] ??
      response ??
      body['CreateOrUpdateCustomerResult']

    return result ?? null
  } catch {
    return null
  }
}

export async function getVerifoneCustomerByCellular(
  e164Phone: string | null | undefined
): Promise<VerifoneGetCustomersResult> {
  if (!VERIFON_CHAIN_ID || !VERIFON_USER_NAME || !VERIFON_PASSWORD) {
    console.error(
      '[VERIFONE_GET_CUSTOMERS] Missing Verifone env vars: VERIFON_CHAIN_ID / VERIFON_USER_NAME / VERIFON_PASSWORD'
    )
    return { success: false, statusDescription: 'Missing Verifone credentials' }
  }

  if (!e164Phone) {
    console.warn(
      '[VERIFONE_GET_CUSTOMERS] Skipping lookup - missing phone (e164Phone is null/undefined)'
    )
    return { success: false, statusDescription: 'Missing phone number' }
  }

  let localPhone = e164ToLocalPhone(e164Phone)

  // Fallback: if conversion fails, try to extract digits and ensure "0" prefix
  if (!localPhone) {
    const digits = e164Phone.replace(/\D/g, '')
    // If it starts with 972, remove it and add 0
    if (digits.startsWith('972') && digits.length >= 11) {
      localPhone = `0${digits.slice(3)}`
    } else if (digits.startsWith('0') && digits.length >= 9 && digits.length <= 10) {
      // Already in local format
      localPhone = digits
    } else {
      console.warn('[VERIFONE_GET_CUSTOMERS] Skipping lookup - cannot convert to local phone format')
      return { success: false, statusDescription: 'Invalid phone format' }
    }
  }

  // Ensure phone number starts with "0" (local format) - strip any "+972" if present
  if (!localPhone.startsWith('0')) {
    const digits = localPhone.replace(/\D/g, '')
    if (digits.startsWith('972')) {
      localPhone = `0${digits.slice(3)}`
    } else if (digits.startsWith('0')) {
      localPhone = digits
    } else {
      localPhone = `0${digits}`
    }
  }

  // Final validation: must start with "0" and be 9-10 digits
  if (!localPhone.startsWith('0') || localPhone.length < 9 || localPhone.length > 10) {
    console.warn('[VERIFONE_GET_CUSTOMERS] Invalid local phone format after conversion')
    return { success: false, statusDescription: 'Invalid phone format' }
  }

  const soapEnvelope = buildGetCustomersEnvelope(localPhone)
  const timeoutMs = 10_000

  const fetchPromise = fetch(VERIFONE_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      SOAPAction: VERIFONE_SOAP_ACTION
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
              `[VERIFONE_GET_CUSTOMERS] Timeout after ${timeoutMs}ms calling Verifone`
            )
          )
        }, timeoutMs)
      })
    ])) as Response
  } catch (err) {
    console.error('[VERIFONE_GET_CUSTOMERS] Network/timeout error', err)
    return {
      success: false,
      statusDescription:
        err instanceof Error ? err.message : 'Verifone request failed'
    }
  }

  if (!response.ok) {
    console.error('[VERIFONE_GET_CUSTOMERS] HTTP error from Verifone', response.status)
    return {
      success: false,
      statusDescription: `HTTP ${response.status}`
    }
  }

  const xmlText = await response.text()


  try {
    const parsed = xmlParser.parse(xmlText)
    const payload = extractGetCustomersPayload(parsed)

    if (!payload) {
      console.error('[VERIFONE_GET_CUSTOMERS] Unable to extract GetCustomersResult payload')
      return {
        success: false,
        statusDescription: 'Malformed Verifone response'
      }
    }

    // In the actual response, IsSuccess/Status live under RequestResult
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

    const data = payload.Data ?? payload['Data']
    const customersNode = data?.Customers ?? data?.['Customers']

    if (!isSuccess || status !== 0) {
      return {
        success: false,
        status,
        statusDescription
      }
    }

    if (!customersNode) {
      console.log(
        '[VERIFONE_GET_CUSTOMERS] No Customers node in response, treating as empty'
      )
      return {
        success: true,
        status,
        statusDescription
      }
    }

    let customer = customersNode.Customer ?? customersNode['Customer']

    if (!customer) {
      console.log(
        '[VERIFONE_GET_CUSTOMERS] Customers node present but empty, treating as no customer'
      )
      return {
        success: true,
        status,
        statusDescription
      }
    }

    if (Array.isArray(customer)) {
      customer = customer[0]
    }

    const isClubMember = toBoolean(
      customer.IsClubMember ?? customer['IsClubMember']
    )
    // Use toDecimal to preserve decimal precision (2 decimal places)
    const creditPointsRaw = toDecimal(
      customer.CreditPoints ?? customer['CreditPoints']
    )
    // Round to 2 decimal places
    const creditPoints = Math.round(creditPointsRaw * 100) / 100
    const customerNo = (customer.CustomerNo ?? customer['CustomerNo'] ?? null) as
      | string
      | number
      | null

    const resultCustomer: VerifoneCustomer = {
      isClubMember,
      creditPoints: creditPoints < 0 ? 0 : creditPoints,
      customerNo:
        customerNo === null || typeof customerNo === 'undefined'
          ? null
          : String(customerNo)
    }

    return {
      success: true,
      status,
      statusDescription,
      customer: resultCustomer
    }
  } catch (err) {
    console.error(
      '[VERIFONE_GET_CUSTOMERS] Failed to parse Verifone XML response',
      err
    )
    return {
      success: false,
      statusDescription: 'Failed to parse Verifone XML response'
    }
  }
}

export async function createOrUpdateVerifoneCustomer(
  input: VerifoneCreateOrUpdateCustomerInput
): Promise<VerifoneCreateOrUpdateCustomerResult> {
  const envelope = buildCreateOrUpdateCustomerEnvelope(input)
  if (!envelope) {
    return {
      success: false,
      statusDescription:
        'Missing credentials, invalid phone, or failed to build SOAP envelope'
    }
  }

  const timeoutMs = 10_000

  const fetchPromise = fetch(VERIFONE_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      SOAPAction: VERIFONE_CREATE_OR_UPDATE_SOAP_ACTION
    },
    body: envelope
  })

  let response: Response
  try {
    response = (await Promise.race([
      fetchPromise,
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(
            new Error(
              `[VERIFONE_CREATE_OR_UPDATE] Timeout after ${timeoutMs}ms calling Verifone`
            )
          )
        }, timeoutMs)
      })
    ])) as Response
  } catch (err) {
    console.error('[VERIFONE_CREATE_OR_UPDATE] Network/timeout error', err)
    return {
      success: false,
      statusDescription:
        err instanceof Error ? err.message : 'Verifone request failed'
    }
  }

  if (!response.ok) {
    console.error('[VERIFONE_CREATE_OR_UPDATE] HTTP error from Verifone', response.status)
    return {
      success: false,
      statusDescription: `HTTP ${response.status}`
    }
  }

  const xmlText = await response.text()

  try {
    const parsed = xmlParser.parse(xmlText)
    const payload = extractCreateOrUpdateCustomerPayload(parsed)

    if (!payload) {
      console.error('[VERIFONE_CREATE_OR_UPDATE] Unable to extract CreateOrUpdateCustomerResult payload')
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

    let customerNo: string | null = null
    const dataNode = payload.Data ?? payload['Data']
    if (dataNode) {
      // CustomerNo is a direct child of Data, not nested under Customer
      const rawCustomerNo = dataNode.CustomerNo ?? dataNode['CustomerNo'] ?? null
      if (
        rawCustomerNo !== null &&
        typeof rawCustomerNo !== 'undefined' &&
        String(rawCustomerNo).trim() !== ''
      ) {
        customerNo = String(rawCustomerNo).trim()
      }
    }

    if (!isSuccess || status !== 0) {
      return {
        success: false,
        status,
        statusDescription,
        customerNo
      }
    }

    return {
      success: true,
      status,
      statusDescription,
      customerNo
    }
  } catch (err) {
    console.error(
      '[VERIFONE_CREATE_OR_UPDATE] Failed to parse Verifone XML response',
      err
    )
    return {
      success: false,
      statusDescription: 'Failed to parse Verifone XML response'
    }
  }
}

export async function getStockByModel(
  itemCode: string
): Promise<VerifoneGetStockByModelResult> {
  if (!VERIFON_CHAIN_ID || !VERIFON_USER_NAME || !VERIFON_PASSWORD) {
    console.error(
      '[VERIFONE_GET_STOCK_BY_MODEL] Missing Verifone env vars: VERIFON_CHAIN_ID / VERIFON_USER_NAME / VERIFON_PASSWORD'
    )
    return { success: false, statusDescription: 'Missing Verifone credentials' }
  }

  if (!itemCode || !itemCode.trim()) {
    console.warn(
      '[VERIFONE_GET_STOCK_BY_MODEL] Skipping lookup - missing itemCode'
    )
    return { success: false, statusDescription: 'Missing item code' }
  }

  const soapEnvelope = buildGetStockByModelEnvelope(itemCode.trim())
  if (!soapEnvelope) {
    return {
      success: false,
      statusDescription: 'Failed to build SOAP envelope'
    }
  }

  const timeoutMs = 10_000

  // An AbortController, where this used to be a Promise.race against a
  // setTimeout. The race never cleared its timer and never cancelled the
  // request, so a timed-out call kept running and left a 10s timer pending.
  // At one call per three-hour cron run that was invisible; /api/staff/stock
  // calls this on every debounced search, which would make the leak
  // continuous. The returned statusDescription keeps the old wording so
  // anything grepping the logs still matches.
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  let response: Response
  try {
    response = await fetch(VERIFONE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        SOAPAction: VERIFONE_GET_STOCK_BY_MODEL_SOAP_ACTION
      },
      body: soapEnvelope,
      signal: controller.signal
    })
  } catch (err) {
    const timedOut = (err as { name?: string } | null)?.name === 'AbortError'
    console.error('[VERIFONE_GET_STOCK_BY_MODEL] Network/timeout error', err)
    return {
      success: false,
      statusDescription: timedOut
        ? `[VERIFONE_GET_STOCK_BY_MODEL] Timeout after ${timeoutMs}ms calling Verifone`
        : err instanceof Error
          ? err.message
          : 'Verifone request failed'
    }
  } finally {
    clearTimeout(timeoutId)
  }

  if (!response.ok) {
    console.error('[VERIFONE_GET_STOCK_BY_MODEL] HTTP error from Verifone', response.status)
    return {
      success: false,
      statusDescription: `HTTP ${response.status}`
    }
  }

  const xmlText = await response.text()

  // The parse itself lives in `lib/verifone-stock-parse.ts` so it can be unit
  // tested from a committed XML fixture; this file keeps `server-only`.
  const result = parseStockByModelXml(xmlText)

  // Debug: log raw Verifone response only for SKU 5024-0019
  if (itemCode.trim() === '5024-0019') {
    console.log(
      `[VERIFONE_GET_STOCK_BY_MODEL] ItemCode=${itemCode} -> ${result.items?.length ?? 0} items:`,
      JSON.stringify(result.items ?? [], null, 2)
    )
  }

  return result
}
