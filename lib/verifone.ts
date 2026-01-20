import 'server-only'

import { XMLParser } from 'fast-xml-parser'
import { e164ToLocalPhone } from './inforu'

const VERIFONE_ENDPOINT =
  'http://62.219.182.125/R360.Server.IIS/Services/Services.asmx'
const VERIFONE_SOAP_ACTION = 'http://tempuri.org/GetCustomers'

const VERIFON_CHAIN_ID = process.env.VERIFON_CHAIN_ID
const VERIFON_USER_NAME = process.env.VERIFON_USER_NAME
const VERIFON_PASSWORD = process.env.VERIFON_PASSWORD

export type VerifoneCustomer = {
  isClubMember: boolean
  creditPoints: number
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
      console.warn(
        '[VERIFONE_GET_CUSTOMERS] Skipping lookup - cannot convert to local phone format',
        { e164Phone, digits }
      )
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
    console.warn(
      '[VERIFONE_GET_CUSTOMERS] Invalid local phone format after conversion',
      { e164Phone, localPhone }
    )
    return { success: false, statusDescription: 'Invalid phone format' }
  }

  const soapEnvelope = buildGetCustomersEnvelope(localPhone)
  const timeoutMs = 10_000

  console.log('[VERIFONE_GET_CUSTOMERS] Requesting customer by Cellular', {
    endpoint: VERIFONE_ENDPOINT,
    originalPhone: e164Phone,
    localPhone,
    phoneFormat: localPhone.startsWith('0') ? 'local (0XXXXXXXXX)' : 'unknown'
  })

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
    const text = await response.text().catch(() => '')
    console.error(
      '[VERIFONE_GET_CUSTOMERS] HTTP error from Verifone',
      response.status,
      text
    )
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
      console.error(
        '[VERIFONE_GET_CUSTOMERS] Unable to extract GetCustomersResult payload',
        parsed
      )
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

    console.log('[VERIFONE_GET_CUSTOMERS] Verifone response meta', {
      isSuccess,
      status,
      statusDescription
    })

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
    const creditPoints = toInt(
      customer.CreditPoints ?? customer['CreditPoints']
    )

    const resultCustomer: VerifoneCustomer = {
      isClubMember,
      creditPoints: creditPoints < 0 ? 0 : creditPoints
    }

    console.log(
      '[VERIFONE_GET_CUSTOMERS] Parsed customer from Verifone response',
      {
        isClubMember: resultCustomer.isClubMember,
        creditPoints: resultCustomer.creditPoints
      }
    )

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

