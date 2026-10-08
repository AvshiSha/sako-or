import { expect, test, type Page } from '@playwright/test'

/**
 * Regression cover for two tracking defects found 2026-10-08 and fixed in the
 * same change. Both were invisible to a shopper and visible only in ad
 * reporting, which is why they survived until something asserted on the events
 * themselves.
 *
 * 1. `ViewContent` / Firebase `view_item` fired **twice** on every PDP view.
 *    The analytics effect in `ProductColorClient` keys off the `product` and
 *    `currentVariant` objects, and the realtime Firestore listener replaces
 *    both with freshly built values on every snapshot — including the initial
 *    one delivered the moment the listener attaches, whose data is identical to
 *    the server-rendered props. New identity, same data, second event.
 *    Guarded by `lastReportedViewKeyRef`, which holds the **last** reported
 *    variant: snapshots for the colour on screen report once, while real
 *    navigation (including a return to a colour already seen) still reports.
 *
 * 2. `/[lng]/product/[baseSku]` dropped the entire query string when
 *    redirecting to the primary colour. That hop is server-side, so `fbclid`
 *    never reached the browser at all and `fbevents.js` could not set `_fbc`;
 *    every `utm_*` was lost with it.
 *
 * Run against a **production build**, never `next dev` — see README.md.
 */

/**
 * Four in-stock colours, seven numeric sizes, six images. Chosen because the
 * colour round trip below needs at least two colours that are both in stock.
 */
const PRODUCT = {
  baseSku: '5124-5317',
  colour: 'black',
  otherColour: 'red',
  price: 499,
  sizes: ['37', '38'],
} as const

/** The query shape a Meta ad click actually arrives with. */
const META_QUERY =
  'fbclid=IwAR2QaTestClickIdForLocalQaOnly_0123456789abcdefg' +
  '&utm_source=facebook&utm_medium=paid_social&utm_campaign=autumn_2026_prospecting'

const pdpUrl = (colour: string = PRODUCT.colour) =>
  `/he/product/${PRODUCT.baseSku}/${colour}?${META_QUERY}`

/* ------------------------------------------------------------------ helpers */

interface FbqCall {
  args: unknown[]
}

/**
 * Records every `fbq(...)` call and keeps the real pixel off the network.
 *
 * The property trap is the only place that sees the function: `initFacebookPixel`
 * assigns the Meta base stub itself, so a setter is what catches it before the
 * app starts calling it. It must forward the properties the app reads back off
 * that function (`queue`, `loaded`, `callMethod`, `getState`, …) or
 * `initFacebookPixel` throws.
 *
 * `connect.facebook.net` is answered with an empty 200 rather than aborted:
 * aborting sends the app into its `scheduleFbqLoadRetry` path, and the point is
 * to measure dispatch, not a simulated CDN outage. Stubbing it at all is
 * deliberate — letting the real script load would fire these events at the
 * production pixel from a test run and pollute live ad reporting.
 */
async function installPixelRecorder(page: Page): Promise<void> {
  await page.route('https://connect.facebook.net/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: '' })
  )
  await page.route('https://www.facebook.com/tr**', (route) =>
    route.fulfill({ status: 200, contentType: 'image/gif', body: '' })
  )

  await page.addInitScript(() => {
    const calls: { args: unknown[] }[] = []
    ;(window as any).__fbqCalls = calls

    let inner: any
    const wrapper = function (this: unknown, ...args: unknown[]) {
      calls.push({ args: JSON.parse(JSON.stringify(args)) })
      if (typeof inner === 'function') return inner.apply(this, args)
      return undefined
    }

    Object.defineProperty(window, 'fbq', {
      configurable: true,
      get() {
        return inner === undefined ? undefined : wrapper
      },
      set(value) {
        inner = value
        for (const key of ['queue', 'loaded', 'version', 'push', 'callMethod', 'getState']) {
          Object.defineProperty(wrapper, key, {
            configurable: true,
            get: () => inner?.[key],
            set: (v) => {
              if (inner) inner[key] = v
            },
          })
        }
      },
    })
  })
}

/** The params of each `fbq('track', '<eventName>', …)` call, in order. */
async function pixelEvents(page: Page, eventName: string): Promise<Record<string, any>[]> {
  const calls: FbqCall[] = await page.evaluate(() => (window as any).__fbqCalls ?? [])
  return calls
    .filter((c) => (c.args[0] === 'track' || c.args[0] === 'trackCustom') && c.args[1] === eventName)
    .map((c) => (c.args[2] ?? {}) as Record<string, any>)
}

async function viewContentIds(page: Page): Promise<string[]> {
  const events = await pixelEvents(page, 'ViewContent')
  return events.flatMap((event) => event.content_ids ?? [])
}

/**
 * The buy-box CTA, anchored and filtered to the visible copy.
 *
 * Both matter. The PDP renders the buy box twice — mobile under `lg:hidden`,
 * desktop under `hidden lg:block`, only CSS hides one — so a bare role query is
 * a strict-mode violation. And a sold-out size cell's accessible name is
 * `"42 — אזל מהמלאי"`, so an *unanchored* pattern containing the CTA's own
 * out-of-stock label matches a disabled size button instead; because the size
 * grid precedes the CTA in the DOM, `.first()` then picks it and `click()`
 * silently waits out the whole timeout.
 */
const addToCart = (page: Page) =>
  page
    .getByRole('button', {
      name: /^(הוסף לעגלה|Add to Cart|בחרי מידה|Select Size|אזל מהמלאי|Out of Stock|מוסיף לעגלה\.\.\.|Adding to Cart\.\.\.)$/,
    })
    .filter({ visible: true })
    .first()

const sizeCell = (page: Page, size: string) =>
  page
    .getByRole('button', { name: new RegExp(`^${size}( —|$)`) })
    .filter({ visible: true })
    .first()

const swatch = (page: Page, name: RegExp) =>
  page.getByRole('button', { name }).filter({ visible: true }).first()

/** Analytics is deferred to idle, so every assertion needs room past that. */
const SETTLE_MS = 8_000

/* ------------------------------------------- F2 — one view, one ViewContent */

test.describe('ViewContent is reported once per product view', () => {
  test('a cold ad landing reports exactly one view', async ({ page }) => {
    await installPixelRecorder(page)

    await page.goto(pdpUrl(), { waitUntil: 'domcontentloaded' })
    await expect(addToCart(page)).toBeVisible()
    await page.waitForTimeout(SETTLE_MS)

    const events = await pixelEvents(page, 'ViewContent')
    expect(events.length, `ViewContent fired ${events.length}× on one page view`).toBe(1)
    expect(events[0].content_type).toBe('product')
    expect(events[0].content_ids).toEqual([`${PRODUCT.baseSku}-${PRODUCT.colour}`])
    expect(events[0].currency).toBe('ILS')
    expect(Number(events[0].value)).toBe(PRODUCT.price)
  })

  test('it stays at one while the realtime listener keeps updating', async ({ page }) => {
    await installPixelRecorder(page)

    await page.goto(pdpUrl(), { waitUntil: 'domcontentloaded' })
    await expect(addToCart(page)).toBeVisible()

    // The Firestore listener attaches on idle and its initial snapshot is what
    // used to produce the second event. Sit well past that, then interact so
    // the component re-renders for reasons unrelated to a new page view.
    await page.waitForTimeout(10_000)
    await sizeCell(page, PRODUCT.sizes[0]).click()
    await sizeCell(page, PRODUCT.sizes[1]).click()
    await page.waitForTimeout(4_000)

    expect(await viewContentIds(page)).toEqual([`${PRODUCT.baseSku}-${PRODUCT.colour}`])
  })

  test('a colour change reports the new variant, once', async ({ page }) => {
    await installPixelRecorder(page)

    await page.goto(pdpUrl(), { waitUntil: 'domcontentloaded' })
    await expect(addToCart(page)).toBeVisible()
    await page.waitForTimeout(SETTLE_MS)

    const red = swatch(page, /^(אדום|Red)$/i)
    if ((await red.count()) === 0) test.skip(true, 'red swatch not rendered')

    await red.click()
    await page.waitForURL(new RegExp(`/${PRODUCT.baseSku}/${PRODUCT.otherColour}`), {
      timeout: 30_000,
    })
    await expect(addToCart(page)).toBeVisible()
    await page.waitForTimeout(SETTLE_MS)

    expect(await viewContentIds(page)).toEqual([
      `${PRODUCT.baseSku}-${PRODUCT.colour}`,
      `${PRODUCT.baseSku}-${PRODUCT.otherColour}`,
    ])
  })

  test('returning to a colour already seen reports a new view', async ({ page }) => {
    await installPixelRecorder(page)

    await page.goto(pdpUrl(), { waitUntil: 'domcontentloaded' })
    await expect(addToCart(page)).toBeVisible()
    await page.waitForTimeout(SETTLE_MS)

    const red = swatch(page, /^(אדום|Red)$/i)
    const black = swatch(page, /^(שחור|Black)$/i)
    if ((await red.count()) === 0 || (await black.count()) === 0) {
      test.skip(true, 'both swatches are needed for the round trip')
    }

    await red.click()
    await page.waitForURL(new RegExp(`/${PRODUCT.baseSku}/${PRODUCT.otherColour}`), {
      timeout: 30_000,
    })
    await expect(addToCart(page)).toBeVisible()
    await page.waitForTimeout(SETTLE_MS)

    await black.click()
    await page.waitForURL(new RegExp(`/${PRODUCT.baseSku}/${PRODUCT.colour}`), { timeout: 30_000 })
    await expect(addToCart(page)).toBeVisible()
    await page.waitForTimeout(SETTLE_MS)

    // The guard holds only the *last* reported variant, so this is a third
    // genuine view. A guard built on a set of everything seen would swallow it,
    // which is the failure mode the de-duplication must not introduce.
    expect(await viewContentIds(page)).toEqual([
      `${PRODUCT.baseSku}-${PRODUCT.colour}`,
      `${PRODUCT.baseSku}-${PRODUCT.otherColour}`,
      `${PRODUCT.baseSku}-${PRODUCT.colour}`,
    ])
  })

  test('PageView and AddToCart are untouched by the de-duplication', async ({ page }) => {
    await installPixelRecorder(page)

    await page.goto(pdpUrl(), { waitUntil: 'domcontentloaded' })
    await expect(addToCart(page)).toBeVisible()
    await page.waitForTimeout(SETTLE_MS)

    // Guards the other direction: a de-dup that over-reached would suppress
    // these too, and the purchase signal matters more than the view signal.
    const pageViews = await pixelEvents(page, 'PageView')
    expect(pageViews.length, `PageView fired ${pageViews.length}×`).toBe(1)

    await sizeCell(page, PRODUCT.sizes[1]).click()
    await addToCart(page).click()
    await expect(page.getByRole('dialog').first()).toBeVisible({ timeout: 20_000 })
    await page.waitForTimeout(1_500)

    const addToCartEvents = await pixelEvents(page, 'AddToCart')
    expect(addToCartEvents.length, `AddToCart fired ${addToCartEvents.length}× for one click`).toBe(1)
    expect(addToCartEvents[0].content_ids).toEqual([
      `${PRODUCT.baseSku}-${PRODUCT.colour}-${PRODUCT.sizes[1]}`,
    ])
  })
})

/* ------------------------------- F1 — the base-SKU redirect keeps the query */

/**
 * Asserted on the `Location` header with redirects disabled, rather than on the
 * browser's final URL: the header is the thing that was wrong, and this needs
 * no page load.
 */
test.describe('the base-SKU redirect preserves the query string', () => {
  test('fbclid and every utm_* survive', async ({ request }) => {
    const response = await request.get(
      `/he/product/${PRODUCT.baseSku}?${META_QUERY}`,
      { maxRedirects: 0 }
    )

    expect(response.status()).toBe(307)
    const location = new URL(response.headers()['location'], 'http://127.0.0.1')

    expect(location.pathname).toMatch(new RegExp(`^/he/product/${PRODUCT.baseSku}/[a-z0-9-]+$`))
    expect(
      location.searchParams.get('fbclid'),
      'fbclid dropped — fbevents.js can never set _fbc and the click is unattributable'
    ).toBeTruthy()
    expect(location.searchParams.get('utm_source')).toBe('facebook')
    expect(location.searchParams.get('utm_medium')).toBe('paid_social')
    expect(location.searchParams.get('utm_campaign')).toBe('autumn_2026_prospecting')
  })

  test('repeated keys and encoded values survive', async ({ request }) => {
    // `searchParams` hands a repeated key over as an array, which is the case a
    // naive rebuild of the query string collapses to one value.
    const response = await request.get(
      `/he/product/${PRODUCT.baseSku}` +
        '?utm_source=instagram&utm_source=facebook' +
        '&fbclid=IwAR%2Ftest%3Dvalue%26more' +
        '&utm_campaign=test%20campaign%20with%20spaces',
      { maxRedirects: 0 }
    )

    expect(response.status()).toBe(307)
    const location = new URL(response.headers()['location'], 'http://127.0.0.1')

    expect(location.searchParams.getAll('utm_source')).toEqual(['instagram', 'facebook'])
    expect(location.searchParams.get('fbclid')).toBe('IwAR/test=value&more')
    expect(location.searchParams.get('utm_campaign')).toBe('test campaign with spaces')
  })

  test('a bare base-SKU URL redirects without a trailing "?"', async ({ request }) => {
    const response = await request.get(`/he/product/${PRODUCT.baseSku}`, { maxRedirects: 0 })

    expect(response.status()).toBe(307)
    expect(response.headers()['location']).toMatch(
      new RegExp(`^/he/product/${PRODUCT.baseSku}/[a-z0-9-]+$`)
    )
  })

  test('an unknown base SKU still answers a real 404', async ({ request }) => {
    // The redirect now reads searchParams; the three notFound() paths must still
    // be reached on exactly the conditions they were before.
    const response = await request.get(`/he/product/0000-0000?${META_QUERY}`, { maxRedirects: 0 })
    expect(response.status()).toBe(404)
  })
})
