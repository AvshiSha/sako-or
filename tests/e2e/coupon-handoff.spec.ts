import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { test, expect, type Page } from '@playwright/test'

/**
 * A coupon applied on the cart must reach checkout, survive a refresh, and be
 * the number the gateway is asked to charge.
 *
 * The defect this covers (fixed 2026-10-25) is a sibling of the points handoff
 * in `order-summary-regression.spec.ts`, but a different mechanism. Codes *were*
 * persisted to `cart_coupons`; the restore threw them away. `useCartPricing`
 * cleared its `pendingCodesRef` before calling `revalidateCouponCodes`, and that
 * call bails immediately while `cartItemsPayload` is empty — which it always is
 * for the first frames of a route mount, because `useCart` flips `loading` to
 * false in the same tick it seeds every line with `maxStock: 0` /
 * `stockStatus: 'checking'`, and those lines are filtered out of
 * `purchasableItems`. One pass, no codes left, nothing to retry: the coupon was
 * silently dropped and the customer was charged full price.
 *
 * So the load-bearing assertion here is the checkout *total*, not the presence
 * of a chip — the discount was genuinely gone, not merely unrendered.
 *
 * ## Why everything is stubbed
 *
 * Same reasoning as the points spec: a fake Firebase session, every network edge
 * answered locally, no order created and no production row touched. `/api/cart/
 * validate` is the important one — without it every line stays 'checking' and
 * the summary holds at ₪0.00, which is the very state the restore has to wait
 * out. `/api/coupons/apply` is **not** stubbed: the whole point is that the real
 * validator agrees with the cart on both routes.
 */

const CART_SKU = 'QA-COUPON-1'
const UNIT_PRICE = 500
const QUANTITY = 2
const SUBTOTAL = UNIT_PRICE * QUANTITY // 1000

/** Live percent_all coupon: 10% off everything, no minimum, not stackable. */
const COUPON_CODE = 'ELEC10'
const DISCOUNT = SUBTOTAL * 0.1 // 100
const DISCOUNTED_TOTAL = SUBTOTAL - DISCOUNT // 900

const FAKE_UID = 'qa-coupon-uid'

/** See the note in order-summary-regression.spec.ts — the repo-root firebase.js
 * key is a stale leftover and is not the one the app runs with. */
function firebaseApiKey(): string {
  for (const file of ['.env.local', '.env']) {
    try {
      const match = readFileSync(resolve(process.cwd(), file), 'utf8').match(
        /^NEXT_PUBLIC_FIREBASE_API_KEY\s*=\s*"?([^"\r\n]+)"?/m
      )
      if (match?.[1]) return match[1].trim()
    } catch {
      // Not present in this checkout; try the next one.
    }
  }
  throw new Error('NEXT_PUBLIC_FIREBASE_API_KEY not found in .env.local or .env')
}

const FIREBASE_API_KEY = firebaseApiKey()

const CART_LINE = {
  sku: CART_SKU,
  name: { he: 'נעל בדיקה', en: 'QA Shoe' },
  price: UNIT_PRICE,
  salePrice: null,
  currency: 'ILS',
  image: '',
  size: '38',
  color: 'black',
  quantity: QUANTITY,
  stock: 10,
  finalQuantity: QUANTITY,
  outOfStock: false
}

async function seedCartAndStubBackend(page: Page) {
  await page.addInitScript(
    ({ apiKey, uid, cartLine }) => {
      try {
        Object.defineProperty(window, 'indexedDB', { get: () => undefined })
      } catch {
        // Already shadowed by another init script; the seed below still stands.
      }

      try {
        localStorage.setItem(
          `firebase:authUser:${apiKey}:[DEFAULT]`,
          JSON.stringify({
            uid,
            email: 'qa-coupon@example.com',
            emailVerified: true,
            displayName: 'QA Coupon',
            isAnonymous: false,
            phoneNumber: null,
            photoURL: null,
            providerData: [
              {
                providerId: 'password',
                uid: 'qa-coupon@example.com',
                displayName: 'QA Coupon',
                email: 'qa-coupon@example.com',
                phoneNumber: null,
                photoURL: null
              }
            ],
            stsTokenManager: {
              refreshToken: 'qa-refresh-token',
              accessToken: 'qa-access-token',
              expirationTime: Date.now() + 60 * 60 * 1000
            },
            createdAt: String(Date.now()),
            lastLoginAt: String(Date.now()),
            apiKey,
            appName: '[DEFAULT]'
          })
        )
        localStorage.setItem('cart', JSON.stringify([cartLine]))

        /**
         * Clear the promotion keys on the FIRST document of the test only.
         *
         * An init script runs on every navigation, so an unguarded
         * `removeItem('cart_coupons')` here deletes the cart-to-checkout
         * handoff at the start of the checkout document — which is precisely
         * the thing under test. Unguarded, this harness fails the spec whether
         * or not the product works, and "fixing" the product cannot make it
         * pass. The sentinel is per-test because each test gets a fresh
         * context, and therefore fresh storage.
         */
        if (!localStorage.getItem('__qa_promotions_reset')) {
          localStorage.setItem('__qa_promotions_reset', '1')
          localStorage.removeItem('cart_coupons')
          localStorage.removeItem('cart_points')
        }
      } catch {
        // Private mode — let it surface as an empty cart rather than a
        // confusing assertion failure.
      }
    },
    { apiKey: FIREBASE_API_KEY, uid: FAKE_UID, cartLine: CART_LINE }
  )

  await page.route('**/identitytoolkit.googleapis.com/**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        users: [
          {
            localId: FAKE_UID,
            email: 'qa-coupon@example.com',
            emailVerified: true,
            displayName: 'QA Coupon',
            providerUserInfo: [],
            validSince: '0',
            lastLoginAt: String(Date.now()),
            createdAt: String(Date.now())
          }
        ]
      })
    })
  )
  await page.route('**/securetoken.googleapis.com/**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: 'qa-access-token',
        expires_in: '3600',
        token_type: 'Bearer',
        refresh_token: 'qa-refresh-token',
        id_token: 'qa-access-token',
        user_id: FAKE_UID,
        project_id: 'sako-or'
      })
    })
  )

  // Zero balance: this spec is about the coupon line, and a redemption would
  // move the total these assertions pin.
  await page.route('**/api/me/points**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ pointsBalance: 0, points: [], totalCount: 0 })
    })
  )

  // Stock. Without this every line hydrates as 'checking' and the summary holds
  // at ₪0.00 — which is also the window the restore has to survive.
  await page.route('**/api/cart/validate', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [CART_LINE] })
    })
  )

  // Coupons never stack with the automatic deal, and an auto-applied coupon
  // would apply a discount this spec did not ask for.
  await page.route('**/api/cart/bogo', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, bogoDiscountAmount: 0, hasLeftover: false })
    })
  )
  await page.route('**/api/coupons/auto-apply', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: false }) })
  )
  await page.route('**/api/users/sync**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  )
}

const couponField = (page: Page) => page.locator('#summary-coupon')
/** The coupon block's own Apply. The points block below carries an identically
 * named button, so an unanchored getByRole is a strict-mode violation. */
const applyCoupon = (page: Page) => couponField(page).locator('xpath=following-sibling::button[1]')

/**
 * The applied-coupon chip, located by its Remove button rather than by text.
 * The code itself is a bare text node inside the <li> (the <li>'s own text is
 * "ELEC10×"), so there is no element an exact text match can land on — and a
 * substring match would also hit the promo ribbon, which currently advertises
 * this very code.
 */
const couponChip = (page: Page) => page.getByRole('button', { name: `הסר ${COUPON_CODE}` })
/** The summary's discount row, which names the code: "הנחה (ELEC10)". */
const discountRow = (page: Page) => page.getByText(`הנחה (${COUPON_CODE})`, { exact: true })
const discountAmount = (page: Page) =>
  page.getByText(`-₪${DISCOUNT.toFixed(2)}`, { exact: true })

async function readOrderTotal(page: Page): Promise<string> {
  const label = page.getByText('סך כל ההזמנה', { exact: true })
  return ((await label.locator('xpath=..').textContent()) || '').trim()
}

const ils = (n: number) => n.toLocaleString('he-IL', { minimumFractionDigits: 2 })

test.describe('coupon handoff', () => {
  test('a coupon applied on the cart survives checkout, a refresh and a round trip', async ({
    page
  }) => {
    await seedCartAndStubBackend(page)

    // ── Cart: apply ─────────────────────────────────────────────────────────
    await page.goto('/he/cart')

    await expect(couponField(page)).toBeVisible()
    // Checked after the first web-first wait, not before it: `goto` resolves on
    // load, and React has not attached by then even on a production build.
    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              Array.from(document.querySelectorAll('button')).filter(b =>
                Object.keys(b).some(k => k.startsWith('__react'))
              ).length
          ),
        { message: 'page is inert — run against `next start`, not `next dev`' }
      )
      .toBeGreaterThan(0)

    // Applying before stock settles is rejected by the validator (it needs a
    // non-empty cart), which is the customer's experience too.
    await expect(page.getByText('סך כל ההזמנה', { exact: true })).toBeVisible()
    await expect.poll(() => readOrderTotal(page)).toContain(ils(SUBTOTAL))

    await couponField(page).fill(COUPON_CODE)
    await applyCoupon(page).click()

    await expect(couponChip(page)).toBeVisible()
    await expect(discountRow(page)).toBeVisible()
    await expect(discountAmount(page)).toBeVisible()
    expect(await readOrderTotal(page)).toContain(ils(DISCOUNTED_TOTAL))

    const persisted = await page.evaluate(() => localStorage.getItem('cart_coupons'))
    expect(JSON.parse(persisted ?? '[]')).toContain(COUPON_CODE)

    // ── Checkout: the coupon is already there ───────────────────────────────
    await page.goto('/he/checkout')

    await expect(couponChip(page), 'coupon did not carry over to checkout').toBeVisible()
    await expect(discountRow(page)).toBeVisible()
    await expect(discountAmount(page)).toBeVisible()
    expect(
      await readOrderTotal(page),
      'checkout total disagrees with the cart about the discount'
    ).toContain(ils(DISCOUNTED_TOTAL))

    // ── And it survives a checkout refresh ──────────────────────────────────
    await page.reload()

    await expect(couponChip(page), 'coupon lost on checkout refresh').toBeVisible()
    expect(await readOrderTotal(page)).toContain(ils(DISCOUNTED_TOTAL))

    // ── And a round trip back to the cart and forward again ─────────────────
    await page.goto('/he/cart')
    await expect(couponChip(page), 'coupon lost on the way back to the cart').toBeVisible()
    expect(await readOrderTotal(page)).toContain(ils(DISCOUNTED_TOTAL))

    await page.goto('/he/checkout')
    await expect(couponChip(page)).toBeVisible()
    expect(await readOrderTotal(page)).toContain(ils(DISCOUNTED_TOTAL))
  })

  /**
   * The negative control. Without it a green checkout assertion would not
   * distinguish "the handoff works" from "checkout applied this coupon for some
   * other reason" — auto-apply, say. The discriminating signal is the
   * `cart_coupons` key itself.
   */
  test('with the stored handoff gone, checkout shows no discount', async ({ page }) => {
    await seedCartAndStubBackend(page)

    await page.goto('/he/cart')
    await expect(couponField(page)).toBeVisible()
    await expect.poll(() => readOrderTotal(page)).toContain(ils(SUBTOTAL))

    await couponField(page).fill(COUPON_CODE)
    await applyCoupon(page).click()
    await expect(couponChip(page)).toBeVisible()

    await page.evaluate(() => localStorage.removeItem('cart_coupons'))

    await page.goto('/he/checkout')
    await expect(couponField(page)).toBeVisible()
    await expect(discountRow(page)).toBeHidden()
    await expect(discountAmount(page)).toBeHidden()
    expect(await readOrderTotal(page)).toContain(ils(SUBTOTAL))
  })

  /**
   * The figure the gateway is asked to charge, which is the part of this defect
   * that costs money rather than trust. The request is intercepted and aborted,
   * so no payment session is ever created.
   */
  test('the amount sent to the payment provider matches the discounted total', async ({
    page
  }) => {
    await seedCartAndStubBackend(page)

    let gatewayPayload: Record<string, unknown> | null = null
    await page.route('**/api/payments/create-low-profile', async route => {
      try {
        gatewayPayload = JSON.parse(route.request().postData() || '{}')
      } catch {
        gatewayPayload = null
      }
      // Never reach the real gateway.
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'intercepted by test' })
      })
    })
    await page.route('**/api/orders/**', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
    )
    await page.route('**/api/checkout/**', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
    )

    await page.goto('/he/cart')
    await expect(couponField(page)).toBeVisible()
    await expect.poll(() => readOrderTotal(page)).toContain(ils(SUBTOTAL))
    await couponField(page).fill(COUPON_CODE)
    await applyCoupon(page).click()
    await expect(couponChip(page)).toBeVisible()

    await page.goto('/he/checkout')
    await expect(couponChip(page)).toBeVisible()

    await fillCheckoutForm(page)

    await page.getByRole('button', { name: /לתשלום|ממתין|מעבד/ }).last().click()

    await expect.poll(() => gatewayPayload, { timeout: 30_000 }).not.toBeNull()
    expect(gatewayPayload!.amount, 'gateway was asked for a different number than the customer saw').toBe(
      DISCOUNTED_TOTAL
    )
    expect(gatewayPayload!.discountTotal).toBe(DISCOUNT)
    expect(gatewayPayload!.coupons).toEqual([
      expect.objectContaining({ code: COUPON_CODE, discountAmount: DISCOUNT })
    ])
  })
})

/** Minimum viable delivery details, plus the terms checkbox the CTA gates on. */
async function fillCheckoutForm(page: Page) {
  const fields: Array<[RegExp, string]> = [
    [/שם פרטי/, 'בדיקה'],
    [/שם משפחה/, 'קופון'],
    [/טלפון/, '0501234567'],
    [/אימייל|דוא/, 'qa-coupon@example.com'],
    [/^עיר/, 'תל אביב'],
    [/רחוב/, 'דיזנגוף'],
    [/מספר בית|מספר/, '1']
  ]
  for (const [name, value] of fields) {
    const field = page.getByRole('textbox', { name }).first()
    if (await field.count()) await field.fill(value).catch(() => {})
  }
  const terms = page.getByRole('checkbox').first()
  if (await terms.count()) await terms.check().catch(() => {})
}
