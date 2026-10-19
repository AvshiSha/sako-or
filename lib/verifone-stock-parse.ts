/**
 * Pure parser for the Verifone `GetStockByModel` SOAP response.
 *
 * Lifted verbatim out of `lib/verifone.ts` so the response contract can be
 * exercised from a committed XML fixture. Same split as `lib/turnstile.ts`
 * (pure, unit tested) vs `lib/server/turnstile.ts` (does the HTTP call):
 * `lib/verifone.ts` keeps `import 'server-only'` and owns the request, this
 * module owns `xmlText -> VerifoneGetStockByModelResult` and imports nothing
 * but the XML parser, so `npm test` can reach it under plain `tsx`.
 *
 * Four things here are deliberate, and each one is load-bearing:
 *
 *  1. `toInt`/`toBoolean` are DUPLICATED from `lib/verifone.ts` rather than
 *     moved. The originals are also used by `getVerifoneCustomerByCellular`
 *     and `createOrUpdateVerifoneCustomer`; moving them would put the customer
 *     sync and customer create paths inside the blast radius of a change that
 *     is supposed to touch stock only.
 *  2. The `XMLParser` options match the shared instance in `lib/verifone.ts`
 *     exactly. `parseTagValue: true` in particular means `<Qty>3</Qty>` arrives
 *     as a NUMBER while `<Qty>03</Qty>` and an empty element do not, which is
 *     why both `toInt` and the fixtures have to cope with either shape.
 *  3. The `Object.values(body)[0]` fallback inside
 *     `extractGetStockByModelPayload` is key-order dependent. It is copied
 *     as-is; tidying it would change which node gets picked for a response
 *     whose envelope is shaped unusually.
 *  4. Every early return is preserved, including the five separate
 *     missing-node paths that all answer `{ success: true, items: [] }`. That
 *     is what makes an empty result indistinguishable from "no such model" --
 *     a fact the staff screen has to surface honestly rather than guess at.
 */

import { XMLParser } from 'fast-xml-parser'

export type VerifoneItemStock = {
  productCode: string // Full ProductCode (e.g., "4924-66500135")
  sku: string // Base SKU (e.g., "4924-6650")
  colorCode: string // Color code (e.g., "01")
  size: string // Size (e.g., "35")
  quantity: number // Available quantity
}

export type VerifoneGetStockByModelResult = {
  success: boolean
  status?: number
  statusDescription?: string
  items?: VerifoneItemStock[] // Array of inventory items
}

/** Identical options to the shared parser in `lib/verifone.ts`. */
const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  textNodeName: 'value',
  parseTagValue: true
})

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

function extractGetStockByModelPayload(parsed: any) {
  try {
    const envelope = parsed['soap:Envelope'] ?? parsed.Envelope
    const body = envelope?.['soap:Body'] ?? envelope?.Body
    if (!body) return null

    const response =
      body['GetStockByModelResponse'] ??
      body['GetStockByModelResult'] ??
      Object.values(body)[0]

    const result =
      response?.['GetStockByModelResult'] ??
      response ??
      body['GetStockByModelResult']

    return result ?? null
  } catch {
    return null
  }
}

/**
 * Parses a `GetStockByModel` SOAP response body.
 *
 * Never throws. Returns the same result shape `getStockByModel` has always
 * returned, including on malformed XML.
 */
export function parseStockByModelXml(xmlText: string): VerifoneGetStockByModelResult {
  try {
    const parsed = xmlParser.parse(xmlText)
    const payload = extractGetStockByModelPayload(parsed)

    if (!payload) {
      console.error('[VERIFONE_GET_STOCK_BY_MODEL] Unable to extract GetStockByModelResult payload')
      return {
        success: false,
        statusDescription: 'Malformed Verifone response'
      }
    }

    // Extract RequestResult
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
      return {
        success: false,
        status,
        statusDescription
      }
    }

    // Extract Data -> Stores -> StoreModelStock -> Items -> ItemStock[]
    const data = payload.Data ?? payload['Data']
    if (!data) {
      console.log(
        '[VERIFONE_GET_STOCK_BY_MODEL] No Data node in response, treating as empty'
      )
      return {
        success: true,
        status,
        statusDescription,
        items: []
      }
    }

    const stores = data.Stores ?? data['Stores']
    if (!stores) {
      console.log(
        '[VERIFONE_GET_STOCK_BY_MODEL] No Stores node in response, treating as empty'
      )
      return {
        success: true,
        status,
        statusDescription,
        items: []
      }
    }

    // Get StoreModelStock (could be array or single object)
    let storeModelStock = stores.StoreModelStock ?? stores['StoreModelStock']
    if (!storeModelStock) {
      console.log(
        '[VERIFONE_GET_STOCK_BY_MODEL] No StoreModelStock node in response, treating as empty'
      )
      return {
        success: true,
        status,
        statusDescription,
        items: []
      }
    }

    // Handle array case - find StoreId 13 or use first
    if (Array.isArray(storeModelStock)) {
      storeModelStock =
        storeModelStock.find(
          (s: any) =>
            toInt(s.StoreId ?? s['StoreId']) === 13 ||
            toInt(s.StoreID ?? s['StoreID']) === 13
        ) ?? storeModelStock[0]
    }

    const items = storeModelStock.Items ?? storeModelStock['Items']
    if (!items) {
      console.log(
        '[VERIFONE_GET_STOCK_BY_MODEL] No Items node in response, treating as empty'
      )
      return {
        success: true,
        status,
        statusDescription,
        items: []
      }
    }

    // Get ItemStock array
    let itemStockList = items.ItemStock ?? items['ItemStock']
    if (!itemStockList) {
      console.log(
        '[VERIFONE_GET_STOCK_BY_MODEL] No ItemStock in response, treating as empty'
      )
      return {
        success: true,
        status,
        statusDescription,
        items: []
      }
    }

    // Ensure it's an array
    if (!Array.isArray(itemStockList)) {
      itemStockList = [itemStockList]
    }

    // Parse each ItemStock entry
    const parsedItems: VerifoneItemStock[] = []
    for (const item of itemStockList) {
      const productCode =
        String(item.ProductCode ?? item['ProductCode'] ?? '').trim()
      const qty = toInt(item.Qty ?? item['Qty'] ?? 0)

      if (!productCode || productCode.length < 12) {
        console.warn(
          `[VERIFONE_GET_STOCK_BY_MODEL] Skipping invalid ProductCode: ${productCode}`
        )
        continue
      }

      // Parse ProductCode format: xxxx-xxxxYYZZ
      // First 9 chars (including dash) = SKU
      // Next 2 chars = Color code
      // Last 2 chars = Size
      const sku = productCode.substring(0, 9)
      const colorCode = productCode.substring(9, 11)
      const size = productCode.substring(11, 13)

      parsedItems.push({
        productCode,
        sku,
        colorCode,
        size,
        quantity: qty < 0 ? 0 : qty
      })
    }

    return {
      success: true,
      status,
      statusDescription,
      items: parsedItems
    }
  } catch (err) {
    console.error(
      '[VERIFONE_GET_STOCK_BY_MODEL] Failed to parse Verifone XML response',
      err
    )
    return {
      success: false,
      statusDescription: 'Failed to parse Verifone XML response'
    }
  }
}
