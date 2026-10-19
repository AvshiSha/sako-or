/**
 * Contract-aligned `GetStockByModel` SOAP fixtures.
 *
 * Derived from the implementation in `lib/verifone-stock-parse.ts` (itself
 * lifted verbatim from `lib/verifone.ts`), because the repository contains no
 * captured Verifone response and the endpoint is IP-allowlisted, so a real one
 * cannot be fetched from a development machine or from CI.
 *
 * Read that honestly: these fixtures pin the behaviour of OUR PARSER against
 * the envelope shape our parser walks. They are not evidence that Verifone
 * emits exactly this. The live contract check is a separate, manual step run
 * from an environment with the allowlisted outbound IPs -- see
 * docs/staff-stock-lookup.md.
 *
 * `parseTagValue: true` is why several fixtures carry deliberately mixed value
 * shapes: `<Qty>3</Qty>` reaches the parser as a NUMBER, `<Qty></Qty>` as an
 * empty string, and a non-numeric `ProductCode` stays a string. A fixture set
 * that used only one shape would not exercise `toInt`.
 */

function envelope(result: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
               xmlns:xsd="http://www.w3.org/2001/XMLSchema"
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetStockByModelResponse xmlns="http://tempuri.org/">
      <GetStockByModelResult>
${result}
      </GetStockByModelResult>
    </GetStockByModelResponse>
  </soap:Body>
</soap:Envelope>`
}

const OK_REQUEST_RESULT = `        <RequestResult>
          <IsSuccess>true</IsSuccess>
          <Status>0</Status>
          <StatusDescription>Success</StatusDescription>
        </RequestResult>`

function store(storeId: string, itemsXml: string): string {
  return `          <StoreModelStock>
            <StoreId>${storeId}</StoreId>
            <Items>
${itemsXml}
            </Items>
          </StoreModelStock>`
}

function item(productCode: string, qty: string): string {
  return `              <ItemStock>
                <ProductCode>${productCode}</ProductCode>
                <Qty>${qty}</Qty>
              </ItemStock>`
}

/**
 * The ordinary case: one model, three colours, several sizes each.
 *
 * Deliberately includes a genuine zero (`4925-03010136`), a negative quantity
 * that the parser clamps to 0 (`4925-03011036`), and an unmapped colour code
 * `77` that must survive rather than being dropped. The one-size marker lives
 * in its own fixture below, since `OS` occupies the size slice.
 */
export const STOCK_OK = envelope(`${OK_REQUEST_RESULT}
        <Data>
          <Stores>
${store(
  '13',
  [
    // black (01)
    item('4925-03010135', '3'),
    item('4925-03010136', '0'),
    item('4925-03010137', '12'),
    // dark-blue (10) -- negative quantity, clamped to 0
    item('4925-03011036', '-4'),
    item('4925-03011037', '2'),
    // colour code 77 is absent from COLOR_CODE_MAP on purpose
    item('4925-03017738', '5'),
  ].join('\n')
)}
          </Stores>
        </Data>`)

/** A one-size item: the size slice is the literal `OS`. */
export const STOCK_ONE_SIZE = envelope(`${OK_REQUEST_RESULT}
        <Data>
          <Stores>
${store('13', item('4925-030101OS', '7'))}
          </Stores>
        </Data>`)

/**
 * `Qty` shapes that `parseTagValue: true` turns into different JS types:
 * a plain integer becomes a number, an empty element becomes an empty string,
 * and a space-padded value stays a string.
 */
export const STOCK_MIXED_QTY_SHAPES = envelope(`${OK_REQUEST_RESULT}
        <Data>
          <Stores>
${store(
  '13',
  [
    item('4925-03010135', '4'),
    item('4925-03010136', ''),
    item('4925-03010137', ' 9 '),
  ].join('\n')
)}
          </Stores>
        </Data>`)

/**
 * A 12-character `ProductCode`, which passes the `length < 12` guard but is one
 * character short of the 13 the slices need, so the size comes out as a single
 * character. This is pre-existing behaviour; the fixture characterises it
 * rather than asserting it is correct.
 */
export const STOCK_SHORT_PRODUCT_CODE = envelope(`${OK_REQUEST_RESULT}
        <Data>
          <Stores>
${store('13', item('4925-0301013', '2'))}
          </Stores>
        </Data>`)

/** An 11-character `ProductCode`: below the guard, so the row is skipped. */
export const STOCK_TOO_SHORT_PRODUCT_CODE = envelope(`${OK_REQUEST_RESULT}
        <Data>
          <Stores>
${store('13', [item('4925-03001', '2'), item('4925-03010135', '6')].join('\n'))}
          </Stores>
        </Data>`)

/** Several stores, one of which is 13: the parser must select 13, not the first. */
export const STOCK_MULTI_STORE_WITH_13 = envelope(`${OK_REQUEST_RESULT}
        <Data>
          <Stores>
${store('90', item('4925-03010135', '99'))}
${store('13', item('4925-03010135', '3'))}
          </Stores>
        </Data>`)

/** Several stores, none of them 13: the parser falls back to the first. */
export const STOCK_MULTI_STORE_WITHOUT_13 = envelope(`${OK_REQUEST_RESULT}
        <Data>
          <Stores>
${store('90', item('4925-03010135', '11'))}
${store('91', item('4925-03010135', '22'))}
          </Stores>
        </Data>`)

/** A single `ItemStock` element, which the XML parser hands over unwrapped. */
export const STOCK_SINGLE_ITEM = envelope(`${OK_REQUEST_RESULT}
        <Data>
          <Stores>
${store('13', item('4925-03010135', '1'))}
          </Stores>
        </Data>`)

/** `IsSuccess` false. */
export const STOCK_NOT_SUCCESS = envelope(`        <RequestResult>
          <IsSuccess>false</IsSuccess>
          <Status>0</Status>
          <StatusDescription>General failure</StatusDescription>
        </RequestResult>`)

/** `IsSuccess` true but a non-zero `Status`, which is still a failure. */
export const STOCK_NONZERO_STATUS = envelope(`        <RequestResult>
          <IsSuccess>true</IsSuccess>
          <Status>7</Status>
          <StatusDescription>Item not found</StatusDescription>
        </RequestResult>`)

/**
 * The five separate "missing node" shapes. Every one of them answers
 * `{ success: true, items: [] }`, which is precisely why an empty result cannot
 * be reported to staff as "model not found".
 */
export const STOCK_NO_DATA = envelope(OK_REQUEST_RESULT)

export const STOCK_NO_STORES = envelope(`${OK_REQUEST_RESULT}
        <Data>
        </Data>`)

export const STOCK_NO_STORE_MODEL_STOCK = envelope(`${OK_REQUEST_RESULT}
        <Data>
          <Stores>
          </Stores>
        </Data>`)

export const STOCK_NO_ITEMS = envelope(`${OK_REQUEST_RESULT}
        <Data>
          <Stores>
          <StoreModelStock>
            <StoreId>13</StoreId>
          </StoreModelStock>
          </Stores>
        </Data>`)

export const STOCK_NO_ITEM_STOCK = envelope(`${OK_REQUEST_RESULT}
        <Data>
          <Stores>
          <StoreModelStock>
            <StoreId>13</StoreId>
            <Items>
            </Items>
          </StoreModelStock>
          </Stores>
        </Data>`)

/** No SOAP body at all. */
export const STOCK_MALFORMED_ENVELOPE = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
</soap:Envelope>`

/** Not XML. */
export const STOCK_NOT_XML = 'upstream returned an HTML error page'

/**
 * Parsed `items` for 4925-0301 as the staff service receives them, for tests
 * that need stock input without going through the XML at all.
 */
export const PARSED_ITEMS_4925_0301 = [
  { productCode: '4925-03010135', sku: '4925-0301', colorCode: '01', size: '35', quantity: 3 },
  { productCode: '4925-03010136', sku: '4925-0301', colorCode: '01', size: '36', quantity: 0 },
  { productCode: '4925-03010137', sku: '4925-0301', colorCode: '01', size: '37', quantity: 12 },
  { productCode: '4925-03011036', sku: '4925-0301', colorCode: '10', size: '36', quantity: 0 },
  { productCode: '4925-03011037', sku: '4925-0301', colorCode: '10', size: '37', quantity: 2 },
  { productCode: '4925-03017738', sku: '4925-0301', colorCode: '77', size: '38', quantity: 5 },
]
