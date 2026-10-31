import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

/**
 * Covers the two identifiers Meta reported as missing from Purchase, plus the
 * deduplication key that had no way to be expressed before.
 *
 * `lib/facebookPixel` is a client module that reads `window`/`document` at import
 * time, so a minimal browser surface is installed before it is loaded. The fbq stub
 * records calls rather than reaching the network.
 */

type FbqCall = [string, string, Record<string, any>?, { eventID?: string }?]

let calls: FbqCall[] = []
let cookieJar: Record<string, string> = {}

function installBrowser(): void {
  const scriptEl: any = { async: false, src: '', onload: null, onerror: null }
  const firstScript: any = { parentNode: { insertBefore: () => {} } }

  const fbq: any = (...args: FbqCall) => {
    calls.push(args)
  }
  // initFacebookPixel short-circuits unless the pixel looks loaded, and isFbqReady()
  // treats a truthy callMethod as "a pixel someone else already loaded".
  fbq.callMethod = fbq
  fbq.queue = []
  fbq.loaded = true
  fbq.version = '2.0'
  fbq.push = fbq
  fbq.getState = () => ({ pixels: {} })

  const win: any = {
    fbq,
    crypto: {
      randomUUID: () => 'guest-uuid-0000-0000-0000-000000000000',
      getRandomValues: (arr: Uint8Array) => arr.fill(7),
    },
  }
  win.window = win

  const doc: any = {
    createElement: () => scriptEl,
    getElementsByTagName: () => [firstScript],
    querySelectorAll: () => [],
    get cookie() {
      return Object.entries(cookieJar)
        .map(([k, v]) => `${k}=${v}`)
        .join('; ')
    },
    set cookie(value: string) {
      const [pair] = value.split(';')
      const idx = pair.indexOf('=')
      cookieJar[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim()
    },
  }

  ;(globalThis as any).window = win
  ;(globalThis as any).document = doc
  // `navigator` is a getter-only global in Node 22 and nothing under test reads it.
}

process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID = 'TEST_PIXEL_ID'
installBrowser()

// Loaded with require, not a static import, so the browser globals above are already in
// place when these client modules evaluate. tsx compiles this file to CJS, where a
// top-level await is unavailable.
declare const require: (id: string) => any

const { fbqTrackPurchase, setFacebookPixelAdvancedMatching, buildAdvancedMatchingData } =
  require('./facebookPixel') as typeof import('./facebookPixel')
const { buildPurchaseEventId } =
  require('./purchase-tracking-guard') as typeof import('./purchase-tracking-guard')
const { resolveMetaExternalId } = require('./metaExternalId') as typeof import('./metaExternalId')

beforeEach(() => {
  calls = []
})

function lastInit(): Record<string, any> | undefined {
  const init = [...calls].reverse().find(([command]) => command === 'init')
  return init?.[2]
}

function lastTrack(name: string): FbqCall | undefined {
  return [...calls].reverse().find(([command, event]) => command === 'track' && event === name)
}

test('Purchase carries a deterministic eventID derived from the order number', () => {
  fbqTrackPurchase([{ id: 'SKU-1', quantity: 1, item_price: 100 }], {
    currency: 'ILS',
    value: 100,
    eventId: buildPurchaseEventId('ORD-1001'),
  })

  const call = lastTrack('Purchase')
  assert.ok(call, 'Purchase should be tracked')
  assert.deepEqual(call[3], { eventID: 'ORD-1001' })

  // Deterministic: the same order yields the same id, so a repeat report collapses.
  assert.equal(buildPurchaseEventId('ORD-1001'), 'ORD-1001')
  assert.notEqual(buildPurchaseEventId('ORD-1002'), buildPurchaseEventId('ORD-1001'))
})

test('the event id is the bare transaction id, so it can join the server-side event', () => {
  // A decorated id (e.g. "purchase.<order>") would not match a server tag that maps
  // event_id from the GA4 transaction_id, which is the order number.
  assert.equal(buildPurchaseEventId('SO-2026-10431'), 'SO-2026-10431')
})

test('Purchase keeps its value and currency and omits eventID when none is given', () => {
  fbqTrackPurchase([{ id: 'SKU-1', quantity: 2, item_price: 50 }], { currency: 'ILS' })

  const call = lastTrack('Purchase')
  assert.ok(call)
  assert.equal(call[2]?.value, 100, 'value falls back to price x quantity')
  assert.equal(call[2]?.currency, 'ILS')
  assert.equal(call[3], undefined, 'no 4th argument rather than an empty eventID')
})

test('a signed-in uid is sent as external_id', () => {
  setFacebookPixelAdvancedMatching({
    email: ' Shopper@Example.COM ',
    externalId: 'FirebaseUid123',
  })

  const init = lastInit()
  assert.equal(init?.external_id, 'FirebaseUid123')
  assert.equal(init?.em, 'shopper@example.com', 'existing normalization still applies')
})

test('external_id is not lower-cased, unlike the PII fields', () => {
  const data = buildAdvancedMatchingData({ externalId: '  MixedCaseUid  ', firstName: 'Dana' })

  assert.equal(data?.external_id, 'MixedCaseUid')
  assert.equal(data?.fn, 'dana')
})

test('a guest with no uid still gets a stable external_id', () => {
  cookieJar = {}

  const first = resolveMetaExternalId(undefined)
  assert.ok(first, 'a guest id is minted')
  assert.equal(resolveMetaExternalId(undefined), first, 'and is stable across calls')

  setFacebookPixelAdvancedMatching({ email: 'guest@example.com' })
  assert.equal(lastInit()?.external_id, first, 'guest id is used when no uid is passed')
})

test('a signed-in uid wins over the stored guest id', () => {
  cookieJar = {}
  const guestId = resolveMetaExternalId(undefined)

  assert.equal(resolveMetaExternalId('FirebaseUid123'), 'FirebaseUid123')
  assert.notEqual(resolveMetaExternalId('FirebaseUid123'), guestId)
})

/**
 * The server-side (Stape) tag reads the dataLayer, not the fbq call — so the
 * identifiers and the dedup key have to be published there too, or the browser
 * eventID has nothing to match against.
 */
test('trackPurchase publishes event_id and the Meta identifiers on the dataLayer', () => {
  cookieJar = {
    _fbp: 'fb.1.1730000000000.1234567890',
    _fbc: 'fb.1.1730000000000.IwAR_test',
  }
  const win = (globalThis as any).window
  win.dataLayer = []

  const { trackPurchase } = require('./dataLayer') as typeof import('./dataLayer')

  trackPurchase('SO-2026-10431', [{ name: 'Shoe', id: 'SKU-1', price: 699, quantity: 1 }], {
    currency: 'ILS',
    value: 699,
    externalId: 'FirebaseUid123',
  })

  const purchase = win.dataLayer.find((entry: any) => entry?.event === 'purchase')
  assert.ok(purchase, 'a purchase event reaches the dataLayer')

  assert.equal(purchase.event_id, 'SO-2026-10431', 'dedup key is on the dataLayer')
  assert.equal(purchase.ecommerce.transaction_id, 'SO-2026-10431')
  assert.equal(purchase.user_data.external_id, 'FirebaseUid123')
  assert.equal(purchase.user_data.fbp, 'fb.1.1730000000000.1234567890')
  assert.equal(purchase.user_data.fbc, 'fb.1.1730000000000.IwAR_test')

  // The whole point: both channels carry the identical id.
  const pixelCall = lastTrack('Purchase')
  assert.equal(pixelCall?.[3]?.eventID, purchase.event_id)
})

test('a missing _fbp is omitted rather than sent empty, and never blocks the event', () => {
  cookieJar = {}
  const win = (globalThis as any).window
  win.dataLayer = []

  const { trackPurchase } = require('./dataLayer') as typeof import('./dataLayer')

  trackPurchase('SO-2026-10432', [{ name: 'Shoe', id: 'SKU-1', price: 699, quantity: 1 }], {
    currency: 'ILS',
    value: 699,
  })

  const purchase = win.dataLayer.find((entry: any) => entry?.event === 'purchase')
  assert.ok(purchase, 'the purchase still reports with no _fbp present')
  assert.equal('fbp' in purchase.user_data, false, 'no empty fbp key')
  assert.ok(purchase.user_data.external_id, 'guest external_id still present')
  assert.equal(purchase.event_id, 'SO-2026-10432')
})
