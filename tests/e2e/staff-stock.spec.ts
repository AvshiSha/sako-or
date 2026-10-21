import { test, expect, request as playwrightRequest } from '@playwright/test'

/**
 * Access control and RTL for the staff warehouse screen (/staff/stock).
 *
 * ## What these lock down
 *
 * - **The gate.** `/staff/*` has two server layers, the same shape as the admin
 *   area: a cookie-presence redirect in `middleware.ts` and an authoritative
 *   `verifySessionCookie` in `app/(staff)/staff/layout.tsx`. Both are pinned
 *   here, including the forged-cookie case that only the Node layer can catch.
 * - **Write denial.** The shared viewer account can search and read all day and
 *   cannot change a location. Every mutating endpoint is asserted to refuse an
 *   unauthenticated caller, and `PUT /api/staff/locations` to refuse even a
 *   well-formed body with no manager grant.
 * - **Right-to-left.** The whole surface is Hebrew and RTL. `dir` has to be on
 *   `<html>`, not on a wrapper, or Headless UI's portalled dialog panels and
 *   the `[dir="rtl"]` descendant rules in `app/globals.css` silently do not
 *   apply. The assertion below fails if someone ever moves it.
 * - **Locale routing.** `/staff/stock` must NOT be rewritten to
 *   `/he/staff/stock`. That depends on `'staff'` being in `UNLOCALIZED_ROUTES`
 *   in `middleware.ts`, and without it the screen 404s.
 *
 * ## What is NOT covered here, and why
 *
 * The signed-in screen itself. The credential is a Firebase SESSION COOKIE
 * minted by `adminAuth.createSessionCookie` and verified against Google with
 * `checkRevoked`, so unlike a client Firebase session it cannot be faked from
 * `page.addInitScript` the way `order-summary-regression.spec.ts` fakes one.
 * Stubbing it would mean adding a test-only bypass to the gate, and a bypass
 * that QA depends on is a bypass that eventually ships.
 *
 * So the behind-the-gate test below performs a REAL sign-in, and skips itself
 * unless `QA_STAFF_EMAIL` and `QA_STAFF_PASSWORD` are set. Run it with
 * Cloudflare's always-pass Turnstile test keys, exactly as
 * `tests/e2e/README.md` prescribes for the admin happy path:
 *
 *   NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA \
 *   TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA \
 *   npm run build && PORT=3002 npm run start
 *
 *   QA_STAFF_EMAIL=... QA_STAFF_PASSWORD=... \
 *   QA_BASE_URL=http://127.0.0.1:3002 npx playwright test staff-stock
 *
 * Note this must run against a local production build, never a Vercel preview:
 * deployment protection is `all_except_custom_domains`, so a preview URL asks
 * for a Vercel login first. And never against `next dev` -- React does not
 * hydrate there under headless Chromium (see tests/e2e/README.md).
 *
 * The presentation logic these tests cannot reach is unit-tested instead, in
 * `lib/__tests__/staff-combine-stock.test.ts`: colour cards, locations per
 * colour, one location across sizes, zero stock, missing images, unmapped
 * colour codes and size ordering.
 */

const PROTECTED_PATHS = ['/staff', '/staff/stock']

test.describe('staff pages are gated server-side', () => {
  for (const path of PROTECTED_PATHS) {
    test(`${path} redirects to the staff login when signed out`, async ({ page }) => {
      const response = await page.goto(path, { waitUntil: 'domcontentloaded' })

      expect(response, `no response for ${path}`).not.toBeNull()
      await expect(page).toHaveURL(/\/staff\/login/)

      // The originally requested path is preserved so the login can return the
      // user to where they were going.
      expect(new URL(page.url()).searchParams.get('from')).toBe(path)
    })
  }

  test('a forged session cookie serves no staff content', async ({ page, context, baseURL }) => {
    // Middleware only checks that the cookie is PRESENT -- it runs on the Edge
    // and cannot verify a Firebase session cookie. This asserts the second
    // layer, the Node layout, actually rejects a cookie that merely exists.
    const url = new URL(baseURL!)
    await context.addCookies([
      {
        name: url.protocol === 'https:' ? '__Host-sako_staff' : 'sako_staff_dev',
        value: 'forged-not-a-real-session-cookie',
        domain: url.hostname,
        path: '/',
      },
    ])

    await page.goto('/staff/stock', { waitUntil: 'domcontentloaded' })

    // The model-number field is the one thing every signed-in view has.
    await expect(page.getByTestId('staff-model-input')).toHaveCount(0)
  })

  test('the login page itself stays reachable while signed out', async ({ page }) => {
    const response = await page.goto('/staff/login', { waitUntil: 'domcontentloaded' })

    expect(response?.status()).toBeLessThan(400)
    await expect(page).toHaveURL(/\/staff\/login/)
    await expect(page.getByTestId('staff-login-submit')).toBeVisible()
  })
})

test.describe('the staff surface is Hebrew and right-to-left', () => {
  test('dir is on <html>, not on a wrapper', async ({ page }) => {
    await page.goto('/staff/login', { waitUntil: 'domcontentloaded' })

    // Load-bearing: Headless UI portals dialog panels to document.body, so a
    // `dir` set on a nested div would not reach the manager PIN dialog, and the
    // `[dir="rtl"] …` descendant rules in app/globals.css would match nothing.
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
    await expect(page.locator('html')).toHaveAttribute('lang', 'he')
  })

  test('the staff paths are not locale-rewritten', async ({ page }) => {
    // Without 'staff' in UNLOCALIZED_ROUTES, middleware 308s this to
    // /he/staff/stock, which does not exist.
    await page.goto('/staff/stock', { waitUntil: 'domcontentloaded' })
    expect(page.url()).not.toContain('/he/staff')
  })
})

test.describe('the staff API refuses unauthenticated callers', () => {
  test('every endpoint answers 401 with no session', async ({ baseURL }) => {
    const api = await playwrightRequest.newContext({ baseURL })

    const stock = await api.get('/api/staff/stock?model=4925-0301')
    expect(stock.status()).toBe(401)

    const unlock = await api.post('/api/staff/locations/unlock', {
      data: { modelCode: '4925-0301', colorCode: '01', pin: '123456' },
    })
    expect(unlock.status()).toBe(401)

    const revoke = await api.post('/api/staff/locations/revoke', { data: {} })
    expect(revoke.status()).toBe(401)

    const save = await api.put('/api/staff/locations', {
      data: {
        modelCode: '4925-0301',
        colorCode: '01',
        room: 1,
        route: 1,
        drawer: 1,
        expectedVersion: null,
      },
    })
    expect(save.status()).toBe(401)

    await api.dispose()
  })

  test('the admin location API is not reachable without an admin session', async ({ baseURL }) => {
    const api = await playwrightRequest.newContext({ baseURL })

    const read = await api.get('/api/admin/warehouse-locations?modelCode=4925-0301')
    expect(read.status()).toBe(401)

    const write = await api.put('/api/admin/warehouse-locations', {
      data: {
        modelCode: '4925-0301',
        colorCode: '01',
        room: 1,
        route: 1,
        drawer: 1,
        expectedVersion: null,
      },
    })
    expect(write.status()).toBe(401)

    await api.dispose()
  })

  test('a stock lookup never reaches Verifone with an invalid model number', async ({
    baseURL,
  }) => {
    // Authentication is checked before validation, so these are 401 rather than
    // 400 -- which is the point: an unauthenticated caller cannot use this
    // endpoint to probe the upstream at all.
    const api = await playwrightRequest.newContext({ baseURL })

    for (const model of ['', '123', '4925-03010135', 'abcdabcd']) {
      const response = await api.get(`/api/staff/stock?model=${encodeURIComponent(model)}`)
      expect(response.status()).toBe(401)
    }

    await api.dispose()
  })
})

/**
 * Behind the gate. Skipped unless a real QA staff credential is supplied -- see
 * the header for why this cannot be stubbed.
 */
test.describe('signed in', () => {
  const email = process.env.QA_STAFF_EMAIL
  const password = process.env.QA_STAFF_PASSWORD

  test.skip(
    !email || !password,
    'Set QA_STAFF_EMAIL and QA_STAFF_PASSWORD to run the signed-in staff checks'
  )

  test.beforeEach(async ({ page }) => {
    await page.goto('/staff/login', { waitUntil: 'domcontentloaded' })
    await page.getByTestId('staff-login-email').fill(email!)
    await page.getByTestId('staff-login-password').fill(password!)
    await page.getByTestId('staff-login-submit').click()
    await expect(page).toHaveURL(/\/staff\/stock/, { timeout: 30_000 })
  })

  test('the lookup field is usable on this viewport', async ({ page }) => {
    const input = page.getByTestId('staff-model-input')
    await expect(input).toBeVisible()

    // Touch target and the iOS zoom floor, asserted on the real device metrics
    // of whichever iPad project is running.
    const box = await input.boundingBox()
    expect(box!.height).toBeGreaterThanOrEqual(44)

    const fontSize = await input.evaluate((el) =>
      parseFloat(window.getComputedStyle(el).fontSize)
    )
    expect(fontSize).toBeGreaterThanOrEqual(16)

    // The search button must be reachable without scrolling on either orientation.
    await expect(page.getByTestId('staff-search')).toBeInViewport()
  })

  test('the input and the Search button share one row', async ({ page }) => {
    const input = page.getByTestId('staff-model-input')
    const button = page.getByTestId('staff-search')

    const inputBox = (await input.boundingBox())!
    const buttonBox = (await button.boundingBox())!

    // Same row: tops aligned, not stacked.
    expect(Math.abs(inputBox.y - buttonBox.y)).toBeLessThanOrEqual(2)
    // Matching heights, which is what `items-stretch` buys.
    expect(Math.abs(inputBox.height - buttonBox.height)).toBeLessThanOrEqual(2)
    // The input takes the remaining width; the button stays at its own size.
    expect(inputBox.width).toBeGreaterThan(buttonBox.width)
    // RTL: the button sits to the LEFT of the field.
    expect(buttonBox.x + buttonBox.width).toBeLessThanOrEqual(inputBox.x + 2)
  })

  test('the row does not reflow while a search is loading', async ({ page }) => {
    // Hold the response open so the button is in its loading state when
    // measured -- the label swaps to a different string there.
    await page.route('**/api/staff/stock**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2000))
      await route.fulfill({ status: 500, contentType: 'application/json', body: '{}' })
    })

    const input = page.getByTestId('staff-model-input')
    const button = page.getByTestId('staff-search')

    await input.fill('4925-0301')
    const before = (await button.boundingBox())!

    await button.click()
    await expect(button).toBeDisabled()

    const during = (await button.boundingBox())!
    const inputDuring = (await input.boundingBox())!

    // The min-width on the button absorbs the longer loading label.
    expect(Math.abs(before.width - during.width)).toBeLessThanOrEqual(1)
    expect(Math.abs(inputDuring.y - during.y)).toBeLessThanOrEqual(2)
  })

  test('nothing is looked up until the Search button is pressed', async ({ page }) => {
    let requests = 0
    await page.route('**/api/staff/stock**', async (route) => {
      requests++
      await route.fulfill({ status: 500, contentType: 'application/json', body: '{}' })
    })

    const input = page.getByTestId('staff-model-input')

    // An incomplete number: nothing to search for.
    await input.fill('4925')
    await page.waitForTimeout(800)
    expect(requests).toBe(0)

    // A COMPLETE, valid number must still not fire on its own. This is the
    // behaviour change: typing or pasting a whole SKU prepares the field, it
    // does not call the ERP.
    await input.fill('4925-0301')
    await page.waitForTimeout(800)
    expect(requests).toBe(0)

    // Pasting it in one go is the same.
    await input.fill('')
    await input.fill('50240019')
    await page.waitForTimeout(800)
    expect(requests).toBe(0)

    // Only the explicit press searches.
    await page.getByTestId('staff-search').click()
    await expect.poll(() => requests).toBe(1)
  })

  test('an invalid model number is rejected in Hebrew, without a request', async ({ page }) => {
    let requests = 0
    await page.route('**/api/staff/stock**', async (route) => {
      requests++
      await route.continue()
    })

    await page.getByTestId('staff-model-input').fill('4925-03a1')
    await page.getByTestId('staff-search').click()

    await expect(page.getByTestId('staff-model-error')).toBeVisible()
    // Hebrew, not English.
    await expect(page.getByTestId('staff-model-error')).toContainText(/[֐-׿]/)
    expect(requests).toBe(0)
  })

  test('a viewer cannot save a location without a manager PIN', async ({ page }) => {
    // The session is real, so this is the actual write-denial path: a valid
    // viewer session with no grant.
    const response = await page.request.put('/api/staff/locations', {
      data: {
        modelCode: '4925-0301',
        colorCode: '01',
        room: 1,
        route: 1,
        drawer: 1,
        expectedVersion: null,
      },
    })

    expect(response.status()).toBe(403)
    const body = await response.json()
    expect(body.code).toBe('FORBIDDEN')
  })

  test('a wrong manager PIN is refused', async ({ page }) => {
    const response = await page.request.post('/api/staff/locations/unlock', {
      data: { modelCode: '4925-0301', colorCode: '01', pin: '000000' },
    })

    // 403 for a wrong PIN, 429 once the throttle has tripped, 503 if no PIN is
    // configured in this environment. Never 200.
    expect([403, 429, 503]).toContain(response.status())
  })

  test('the stock response keeps failure, empty and zero apart', async ({ page }) => {
    // Served from a stub so the assertion does not depend on Verifone being
    // reachable, which it is not from a development machine.
    await page.route('**/api/staff/stock**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          modelCode: '4925-0301',
          productName: 'נעלי סירה',
          fetchedAt: new Date().toISOString(),
          stock: { state: 'ok', detail: null },
          locations: { state: 'ok' },
          totalQuantity: 3,
          warehouse: { roomRoutes: { 1: [1, 2, 3] }, configError: null },
          colors: [
            {
              colorCode: '01',
              colorSlug: 'black',
              colorName: 'שחור',
              colorNameSource: 'hebrew',
              stockKnown: true,
              location: {
                room: 2,
                route: 1,
                drawer: 18,
                onFloor: false,
                version: 1,
                updatedAt: new Date().toISOString(),
                updatedBy: null,
              },
              sizes: [
                { size: '35', label: '35', quantity: 3, soldOut: false, trusted: true },
                { size: '36', label: '36', quantity: 0, soldOut: true, trusted: true },
              ],
              totalQuantity: 3,
              image: null,
              soldOut: false,
            },
            {
              colorCode: '77',
              colorSlug: null,
              colorName: 'גוון 77',
              colorNameSource: 'code',
              stockKnown: true,
              location: null,
              sizes: [{ size: '38', label: '38', quantity: 5, soldOut: false, trusted: true }],
              totalQuantity: 5,
              image: null,
              soldOut: false,
            },
          ],
        }),
      })
    })

    await page.getByTestId('staff-model-input').fill('4925-0301')
    await page.getByTestId('staff-search').click()
    await expect(page.getByTestId('staff-result')).toBeVisible()

    // Two colours, each with its own card.
    await expect(page.getByTestId('staff-color-card')).toHaveCount(2)

    // A real zero is shown as a row, not hidden.
    await expect(page.getByTestId('staff-size-quantity').nth(1)).toHaveText('0')

    // The assigned colour shows its location; the unassigned one says so
    // explicitly rather than showing a blank or an error.
    await expect(page.getByTestId('staff-location')).toContainText('18')
    await expect(page.getByTestId('staff-location-unassigned')).toBeVisible()

    // No image for either colour, so no image element at all -- not a
    // placeholder and not reserved space.
    await expect(page.getByTestId('staff-color-image')).toHaveCount(0)

    // The heading comes from the response, never from the input field.
    await expect(page.getByTestId('staff-result-model')).toHaveText('4925-0301')
  })

  test('a Verifone failure is never rendered as zero stock', async ({ page }) => {
    await page.route('**/api/staff/stock**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          modelCode: '4925-0301',
          productName: null,
          fetchedAt: new Date().toISOString(),
          stock: { state: 'unavailable', detail: 'HTTP 503' },
          locations: { state: 'ok' },
          // Null, not 0.
          totalQuantity: null,
          warehouse: { roomRoutes: { 2: [1] }, configError: null },
          colors: [
            {
              colorCode: '01',
              colorSlug: 'black',
              colorName: 'שחור',
              colorNameSource: 'hebrew',
              // Location is known, stock is not.
              stockKnown: false,
              location: {
                room: 2,
                route: 1,
                drawer: 18,
                onFloor: false,
                version: 1,
                updatedAt: new Date().toISOString(),
                updatedBy: null,
              },
              sizes: [],
              totalQuantity: 0,
              image: null,
              soldOut: false,
            },
          ],
        }),
      })
    })

    await page.getByTestId('staff-model-input').fill('4925-0301')
    await page.getByTestId('staff-search').click()

    await expect(page.getByTestId('staff-stock-error')).toBeVisible()
    // The location half is still usable.
    await expect(page.getByTestId('staff-location')).toContainText('18')
    // And no size table, so nothing reads as "we have none".
    await expect(page.getByTestId('staff-size-table')).toHaveCount(0)
    await expect(page.getByTestId('staff-color-total')).toHaveCount(0)
  })

  test('one model stock can never appear under another model heading', async ({ page }) => {
    // The slow response is for the first model, the fast one for the second.
    await page.route('**/api/staff/stock**', async (route) => {
      const model = new URL(route.request().url()).searchParams.get('model')
      const slow = model === '4925-0301'
      if (slow) await new Promise((resolve) => setTimeout(resolve, 2500))

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          modelCode: model,
          productName: null,
          fetchedAt: new Date().toISOString(),
          stock: { state: 'ok', detail: null },
          locations: { state: 'ok' },
          totalQuantity: slow ? 111 : 222,
          warehouse: { roomRoutes: { 1: [1] }, configError: null },
          colors: [
            {
              colorCode: '01',
              colorSlug: 'black',
              colorName: 'שחור',
              colorNameSource: 'hebrew',
              stockKnown: true,
              location: null,
              sizes: [
                { size: '35', label: '35', quantity: slow ? 111 : 222, soldOut: false, trusted: true },
              ],
              totalQuantity: slow ? 111 : 222,
              image: null,
              soldOut: false,
            },
          ],
        }),
      })
    })

    const input = page.getByTestId('staff-model-input')

    // First search: the stub holds this one open for 2.5s.
    await input.fill('4925-0301')
    await page.getByTestId('staff-search').click()

    // Switch models while it is still in flight. Enter rather than the button,
    // because the button is disabled during a search -- Enter is the deliberate
    // escape hatch for "this one is hanging, I need the other model now".
    await input.fill('5024-0019')
    await input.press('Enter')

    await expect(page.getByTestId('staff-result-model')).toHaveText('5024-0019')
    await expect(page.getByTestId('staff-size-quantity')).toHaveText('222')

    // The slow first response lands here. It must be discarded.
    await page.waitForTimeout(3000)
    await expect(page.getByTestId('staff-result-model')).toHaveText('5024-0019')
    await expect(page.getByTestId('staff-size-quantity')).toHaveText('222')
  })

  test('the manager PIN dialog opens right-to-left and is portalled', async ({ page }) => {
    await page.route('**/api/staff/stock**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          modelCode: '4925-0301',
          productName: null,
          fetchedAt: new Date().toISOString(),
          stock: { state: 'ok', detail: null },
          locations: { state: 'ok' },
          totalQuantity: 1,
          warehouse: { roomRoutes: { 1: [1] }, configError: null },
          colors: [
            {
              colorCode: '01',
              colorSlug: 'black',
              colorName: 'שחור',
              colorNameSource: 'hebrew',
              stockKnown: true,
              location: null,
              sizes: [{ size: '35', label: '35', quantity: 1, soldOut: false, trusted: true }],
              totalQuantity: 1,
              image: null,
              soldOut: false,
            },
          ],
        }),
      })
    })

    await page.getByTestId('staff-model-input').fill('4925-0301')
    await page.getByTestId('staff-search').click()
    await page.getByTestId('staff-edit-location').click()

    const pinInput = page.getByTestId('staff-pin-input')
    await expect(pinInput).toBeVisible()

    // The panel carries its own dir, because Headless UI renders it under
    // <body> rather than inside the staff layout.
    const dir = await pinInput.evaluate(
      (el) => el.closest('[dir]')?.getAttribute('dir') ?? null
    )
    expect(dir).toBe('rtl')

    // The PIN must not be readable over a shoulder on a shared tablet.
    await expect(pinInput).toHaveAttribute('type', 'password')
  })
})

/**
 * Auto-formatting of the model-number field, on the real page.
 *
 * The rules themselves are unit tested in
 * `lib/__tests__/staff-model-input-format.test.ts`; what needs a browser is the
 * wiring -- that the caret really is restored after a controlled re-render, and
 * that no attribute on the element quietly blocks an edit. A `maxLength` did
 * exactly that during development: it made overtyping a digit in a full field
 * do nothing, and only a real browser showed it.
 */
test.describe('signed in: model-number formatting', () => {
  const email = process.env.QA_STAFF_EMAIL
  const password = process.env.QA_STAFF_PASSWORD

  test.skip(
    !email || !password,
    'Set QA_STAFF_EMAIL and QA_STAFF_PASSWORD to run the signed-in staff checks'
  )

  test.beforeEach(async ({ page }) => {
    await page.goto('/staff/login', { waitUntil: 'domcontentloaded' })
    await page.getByTestId('staff-login-email').fill(email!)
    await page.getByTestId('staff-login-password').fill(password!)
    await page.getByTestId('staff-login-submit').click()
    await expect(page).toHaveURL(/\/staff\/stock/, { timeout: 30_000 })
  })

  /** The field value and caret, as the DOM actually holds them. */
  const fieldState = (page: import('@playwright/test').Page) =>
    page.evaluate(() => {
      const el = document.querySelector(
        '[data-testid="staff-model-input"]'
      ) as HTMLInputElement
      return { value: el.value, caret: el.selectionStart }
    })

  const setCaret = (page: import('@playwright/test').Page, at: number) =>
    page.evaluate((position) => {
      const el = document.querySelector(
        '[data-testid="staff-model-input"]'
      ) as HTMLInputElement
      el.setSelectionRange(position, position)
    }, at)

  test('typing eight digits inserts the separator', async ({ page }) => {
    await page.getByTestId('staff-model-input').click()
    await page.keyboard.type('51276825')

    const state = await fieldState(page)
    expect(state.value).toBe('5127-6825')
    expect(state.caret).toBe(9)
  })

  test('the numeric keyboard is preserved', async ({ page }) => {
    const input = page.getByTestId('staff-model-input')
    await expect(input).toHaveAttribute('inputmode', 'numeric')
    // type=text, not number: number would strip leading zeros and the dash.
    await expect(input).toHaveAttribute('type', 'text')
  })

  test('an already-formatted number does not gain a second separator', async ({ page }) => {
    await page.getByTestId('staff-model-input').fill('5127-6825')
    expect((await fieldState(page)).value).toBe('5127-6825')
  })

  test('leading zeros survive and the field caps at eight digits', async ({ page }) => {
    const input = page.getByTestId('staff-model-input')

    await input.fill('00120034')
    expect((await fieldState(page)).value).toBe('0012-0034')

    await input.fill('')
    await input.click()
    await page.keyboard.type('512768259999')
    expect((await fieldState(page)).value).toBe('5127-6825')
  })

  test('editing a digit mid-number does not send the caret to the end', async ({ page }) => {
    // The regression this guards: a full field plus a value-replacing
    // re-render is where auto-formatting fields usually become unusable.
    const input = page.getByTestId('staff-model-input')
    await input.fill('51276825')
    await setCaret(page, 2)
    await page.keyboard.type('9')

    const state = await fieldState(page)
    expect(state.value).toBe('5192-7682')
    expect(state.caret).toBe(3)
  })

  test('Backspace and Delete behave naturally around the separator', async ({ page }) => {
    const input = page.getByTestId('staff-model-input')

    // Caret just after the separator: Backspace removes the digit before it,
    // rather than appearing to do nothing.
    await input.fill('51276825')
    await setCaret(page, 5)
    await page.keyboard.press('Backspace')
    expect((await fieldState(page)).value).toBe('5126-825')

    // Caret just before the separator: Delete removes the digit after it.
    await input.fill('51276825')
    await setCaret(page, 4)
    await page.keyboard.press('Delete')
    expect((await fieldState(page)).value).toBe('5127-825')
  })

  test('replacing a selection works', async ({ page }) => {
    await page.getByTestId('staff-model-input').fill('51276825')
    await page.evaluate(() => {
      const el = document.querySelector(
        '[data-testid="staff-model-input"]'
      ) as HTMLInputElement
      el.setSelectionRange(0, 4)
    })
    await page.keyboard.type('9999')
    expect((await fieldState(page)).value).toBe('9999-6825')
  })

  test('formatting never triggers a stock request', async ({ page }) => {
    let requests = 0
    await page.route('**/api/staff/stock**', async (route) => {
      requests++
      await route.fulfill({ status: 500, contentType: 'application/json', body: '{}' })
    })

    const input = page.getByTestId('staff-model-input')
    await input.click()
    await page.keyboard.type('51276825')
    await input.fill('0012-0034')
    await setCaret(page, 2)
    await page.keyboard.type('9')
    await page.waitForTimeout(800)

    expect(requests).toBe(0)

    // Still explicit, and the value sent upstream is the formatted one.
    await page.getByTestId('staff-search').click()
    await expect.poll(() => requests).toBe(1)
  })
})

/**
 * Out-of-stock labelling and floor placement, on the real page.
 *
 * Both are served from a stub, so the assertions do not depend on Verifone
 * being reachable -- which it is not from a development machine.
 */
test.describe('signed in: sold out and floor placement', () => {
  const email = process.env.QA_STAFF_EMAIL
  const password = process.env.QA_STAFF_PASSWORD

  test.skip(
    !email || !password,
    'Set QA_STAFF_EMAIL and QA_STAFF_PASSWORD to run the signed-in staff checks'
  )

  const stock = (colors: unknown[]) => ({
    modelCode: '5127-6825',
    productName: 'נעלי סירה',
    fetchedAt: new Date().toISOString(),
    stock: { state: 'ok', detail: null },
    locations: { state: 'ok' },
    totalQuantity: 5,
    warehouse: { roomRoutes: { 3: [1, 2, 3] }, configError: null },
    colors,
  })

  const withStock = {
    colorCode: '01',
    colorSlug: 'black',
    colorName: 'שחור',
    colorNameSource: 'hebrew',
    stockKnown: true,
    location: {
      room: 3,
      route: 1,
      drawer: 41,
      onFloor: false,
      version: 1,
      updatedAt: new Date().toISOString(),
      updatedBy: null,
    },
    sizes: [
      { size: '35', label: '35', quantity: 5, soldOut: false, trusted: true },
      { size: '36', label: '36', quantity: 0, soldOut: true, trusted: true },
    ],
    totalQuantity: 5,
    image: null,
    soldOut: false,
  }

  /** Same drawer, but recorded as the floor beneath it. */
  const onFloorColor = {
    ...withStock,
    colorCode: '10',
    colorName: 'כחול כהה',
    colorSlug: 'dark-blue',
    location: { ...withStock.location, onFloor: true },
  }

  const allSoldOut = {
    ...withStock,
    colorCode: '10',
    colorName: 'כחול כהה',
    colorSlug: 'dark-blue',
    // On the floor rather than in a drawer.
    location: { ...withStock.location, drawer: null, placement: 'FLOOR' },
    sizes: [
      { size: '35', label: '35', quantity: 0, soldOut: true, trusted: true },
      { size: '36', label: '36', quantity: 0, soldOut: true, trusted: true },
    ],
    totalQuantity: 0,
    soldOut: true,
  }

  const stockUnknown = {
    ...withStock,
    colorCode: '77',
    colorName: 'גוון 77',
    colorSlug: null,
    colorNameSource: 'code',
    stockKnown: false,
    sizes: [],
    totalQuantity: 0,
    soldOut: false,
  }

  async function search(page: import('@playwright/test').Page, colors: unknown[]) {
    await page.route('**/api/staff/stock**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(stock(colors)),
      })
    })
    await page.goto('/staff/login', { waitUntil: 'domcontentloaded' })
    await page.getByTestId('staff-login-email').fill(email!)
    await page.getByTestId('staff-login-password').fill(password!)
    await page.getByTestId('staff-login-submit').click()
    await expect(page).toHaveURL(/\/staff\/stock/, { timeout: 30_000 })
    await page.getByTestId('staff-model-input').fill('51276825')
    await page.getByTestId('staff-search').click()
    await page.getByTestId('staff-color-card').first().waitFor()
  }

  test('a zero size is labelled in red', async ({ page }) => {
    await search(page, [withStock])

    const label = page.getByTestId('staff-size-sold-out')
    await expect(label).toHaveCount(1)
    await expect(label).toHaveText('אזל מהמלאי')

    // The design system red, not an invented colour.
    const color = await label.evaluate((el) => getComputedStyle(el).color)
    expect(color).toBe('rgb(182, 68, 68)')
  })

  test('the colour is labelled only when every size is zero', async ({ page }) => {
    await search(page, [withStock, allSoldOut])

    const cards = page.getByTestId('staff-color-card')
    // Has stock at 35, so no colour-level badge.
    await expect(cards.nth(0).getByTestId('staff-color-sold-out')).toHaveCount(0)
    // Every size zero.
    await expect(cards.nth(1).getByTestId('staff-color-sold-out')).toHaveText('אזל מהמלאי')
  })

  test('unreadable stock is never shown as sold out', async ({ page }) => {
    // The most damaging false positive available: an ERP outage telling a
    // picker the shelf is empty.
    await search(page, [stockUnknown])

    const card = page.getByTestId('staff-color-card').first()
    await expect(card.getByTestId('staff-color-sold-out')).toHaveCount(0)
    await expect(card.getByTestId('staff-size-sold-out')).toHaveCount(0)
    await expect(card.getByTestId('staff-size-table')).toHaveCount(0)
  })

  test('the floor flag is appended to the location, not instead of the drawer', async ({
    page,
  }) => {
    await search(page, [withStock, onFloorColor])

    const locations = page.getByTestId('staff-location')
    await expect(locations.nth(0)).toHaveText('חדר 3 · מסלול 1 · מגירה 41')
    await expect(locations.nth(1)).toHaveText('חדר 3 · מסלול 1 · מגירה 41 · רצפה')
  })

  test('the toggle sits after the selectors and restores its saved state', async ({
    page,
  }) => {
    await search(page, [onFloorColor])

    await page.route('**/api/staff/locations/unlock', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          grantId: '00000000-0000-4000-8000-000000000000',
          expiresAt: new Date(Date.now() + 180_000).toISOString(),
          modelCode: '5127-6825',
          colorCode: '10',
        }),
      })
    })

    await page.getByTestId('staff-edit-location').first().click()
    await page.getByTestId('staff-pin-input').fill('246813')
    await page.getByTestId('staff-pin-submit').click()

    const toggle = page.getByTestId('staff-floor-toggle')
    await toggle.waitFor()
    await expect(toggle).toHaveText('רצפה')
    // Restored from the saved assignment.
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')

    // The drawer is still required and still chosen separately.
    await expect(page.getByTestId('staff-drawer-select')).toHaveValue('41')
    await expect(page.getByTestId('staff-room-select')).toBeVisible()
    await expect(page.getByTestId('staff-route-select')).toBeVisible()

    // Toggling off sends the drawer with the flag cleared.
    const captured: { body: Record<string, unknown> | null } = { body: null }
    await page.route('**/api/staff/locations', async (route) => {
      if (route.request().method() === 'PUT') {
        captured.body = JSON.parse(route.request().postData() ?? '{}')
      }
      await route.fulfill({ status: 500, contentType: 'application/json', body: '{}' })
    })

    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-pressed', 'false')
    await page.getByTestId('staff-save-location').click()

    await expect.poll(() => captured.body?.onFloor).toBe(false)
    expect(captured.body?.drawer).toBe(41)
  })
})
