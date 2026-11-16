import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { test, expect, type Page } from '@playwright/test'

/**
 * The delivery address a customer types must reach the gateway handoff intact —
 * including when it has no house number.
 *
 * ORDER-1794778738486 was charged and confirmed with an empty shipping address. The
 * customer, in אעבלין, had typed her town as both city and street and left the house
 * number blank, because her address has none. The payment route accepted it; the
 * route that writes the record the confirmation email reads still demanded a house
 * number, rejected it, and — being best-effort — said nothing.
 *
 * These tests assert on the payload the browser actually sends, so they fail if the
 * form stops collecting a field, if validation starts rejecting a legitimate address,
 * or if the submit path drops one on the way out.
 *
 * ## Nothing here touches production
 *
 * Same harness as coupon-handoff.spec.ts: a faked Firebase session, cart in
 * localStorage, every network edge answered locally. `create-low-profile` and
 * `/api/checkout` are both intercepted, so no order is created, no checkout row is
 * written and the gateway is never reached. The *server-side* acceptance of an
 * address with no house number is covered by lib/__tests__/delivery-address.test.ts,
 * which exercises the validator both routes now share.
 */

const CART_SKU = 'QA-ADDRESS-1'
const UNIT_PRICE = 699
const FAKE_UID = 'qa-address-uid'

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
  size: '40',
  color: 'black',
  quantity: 1,
  stock: 10,
  finalQuantity: 1,
  outOfStock: false
}

interface Captured {
  gateway: Record<string, any> | null
  checkout: Record<string, any> | null
}

async function seedCartAndStubBackend(page: Page): Promise<Captured> {
  const captured: Captured = { gateway: null, checkout: null }

  await page.addInitScript(
    ({ apiKey, uid, cartLine }) => {
      try {
        Object.defineProperty(window, 'indexedDB', { get: () => undefined })
      } catch {
        // Already shadowed; the seed below still stands.
      }
      try {
        localStorage.setItem(
          `firebase:authUser:${apiKey}:[DEFAULT]`,
          JSON.stringify({
            uid,
            email: 'qa-address@example.com',
            emailVerified: true,
            displayName: 'QA Address',
            isAnonymous: false,
            phoneNumber: null,
            photoURL: null,
            providerData: [
              {
                providerId: 'password',
                uid: 'qa-address@example.com',
                displayName: 'QA Address',
                email: 'qa-address@example.com',
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
        localStorage.removeItem('cart_coupons')
        localStorage.removeItem('cart_points')
      } catch {
        // Private mode — surfaces as an empty cart rather than a confusing failure.
      }
    },
    { apiKey: FIREBASE_API_KEY, uid: FAKE_UID, cartLine: CART_LINE }
  )

  await page.route('**/identitytoolkit.googleapis.com/**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        users: [{ localId: FAKE_UID, email: 'qa-address@example.com', emailVerified: true }]
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
  await page.route('**/api/me/points**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ pointsBalance: 0, points: [], totalCount: 0 })
    })
  )
  // Without this every line hydrates as 'checking' and the summary holds at ₪0.00.
  await page.route('**/api/cart/validate', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [CART_LINE] })
    })
  )

  // Capture, never forward: no checkout row is written.
  await page.route('**/api/checkout', async route => {
    try {
      captured.checkout = JSON.parse(route.request().postData() || '{}')
    } catch {
      captured.checkout = null
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, checkoutId: 'qa-checkout-id' })
    })
  })

  // Capture, never forward: no order is created and the gateway is never reached.
  await page.route('**/api/payments/create-low-profile', async route => {
    try {
      captured.gateway = JSON.parse(route.request().postData() || '{}')
    } catch {
      captured.gateway = null
    }
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ success: false, error: 'intercepted by test' })
    })
  })

  return captured
}

/**
 * Fills the form. `houseNumber: null` leaves the (optional) field empty.
 *
 * Two things here are load-bearing, both learned the hard way on this spec:
 *
 * 1. **Wait for the summary CTA to be enabled before typing.** The cart hydrates
 *    after the route mounts — until `/api/cart/validate` answers, the CTA is
 *    disabled and the form is still being re-rendered. Fills issued into that
 *    window land on elements React then replaces, and the value is lost.
 * 2. **Never swallow a failed fill.** The first version did (`.catch(() => {})`),
 *    so an empty first-name field looked exactly like a product bug: the CTA did
 *    nothing and the gateway was never called. Assert each value took.
 */
async function fillCheckoutForm(
  page: Page,
  address: { city: string; street: string; houseNumber: string | null }
) {
  await expect(payButton(page)).toBeEnabled({ timeout: 30_000 })

  const fields: Array<[RegExp, string]> = [
    [/שם פרטי/, 'חנין'],
    [/שם משפחה/, 'בדיקה'],
    [/טלפון/, '0529572163'],
    [/מייל/, 'qa-address@example.com'],
    [/^עיר/, address.city],
    [/^רחוב/, address.street]
  ]
  if (address.houseNumber !== null) fields.push([/מספר בית/, address.houseNumber])

  for (const [name, value] of fields) {
    const field = page.getByRole('textbox', { name }).first()
    await field.fill(value)
    // Proves the value survived hydration rather than being silently dropped.
    await expect(field).toHaveValue(value)
  }

  const terms = page.getByRole('checkbox').first()
  await terms.check()
  await expect(terms).toBeChecked()
}

const payButton = (page: Page) =>
  page.getByRole('button', { name: /לתשלום|ממתין|מעבד|פותח/ }).last()

test.describe('checkout delivery address', () => {
  /**
   * The exact shape of the order that failed: a real address with no house number.
   * It must reach the gateway handoff with city and street intact.
   */
  test('an address with no house number reaches the gateway handoff intact', async ({ page }) => {
    const captured = await seedCartAndStubBackend(page)

    await page.goto('/he/checkout')
    await fillCheckoutForm(page, { city: 'אעבלין', street: 'אעבלין', houseNumber: null })
    await payButton(page).click()

    await expect.poll(() => captured.gateway, { timeout: 30_000 }).not.toBeNull()

    const address = captured.gateway!.deliveryAddress
    expect(address.city).toBe('אעבלין')
    expect(address.streetName).toBe('אעבלין')
    // Empty, not absent, and emphatically not a reason to reject the order.
    expect(address.streetNumber ?? '').toBe('')
    expect(captured.gateway!.shippingMethod).toBe('delivery')

    // The same address must reach the record the confirmation email is built from.
    expect(captured.checkout?.deliveryAddress?.city).toBe('אעבלין')
    expect(captured.checkout?.deliveryAddress?.streetName).toBe('אעבלין')
  })

  test('a block/parcel street with no house number is accepted', async ({ page }) => {
    const captured = await seedCartAndStubBackend(page)

    await page.goto('/he/checkout')
    await fillCheckoutForm(page, { city: 'נצרת', street: '5026/2', houseNumber: null })
    await payButton(page).click()

    await expect.poll(() => captured.gateway, { timeout: 30_000 }).not.toBeNull()
    expect(captured.gateway!.deliveryAddress.city).toBe('נצרת')
    expect(captured.gateway!.deliveryAddress.streetName).toBe('5026/2')
  })

  test('a full address carries its optional fields through', async ({ page }) => {
    const captured = await seedCartAndStubBackend(page)

    await page.goto('/he/checkout')
    await fillCheckoutForm(page, { city: 'תל אביב', street: 'רוטשילד', houseNumber: '51' })
    for (const [label, value] of [[/קומה/, '3'], [/דירה/, '25'], [/מיקוד/, '1645102']] as const) {
      const field = page.getByRole('textbox', { name: label }).first()
      if (await field.count()) await field.fill(value).catch(() => {})
    }
    await payButton(page).click()

    await expect.poll(() => captured.gateway, { timeout: 30_000 }).not.toBeNull()
    const address = captured.gateway!.deliveryAddress
    expect(address.city).toBe('תל אביב')
    expect(address.streetName).toBe('רוטשילד')
    expect(address.streetNumber).toBe('51')
    expect(address.floor).toBe('3')
    expect(address.apartmentNumber).toBe('25')
    expect(address.zipCode).toBe('1645102')
  })

  /**
   * The negative control. Without it, a green suite would not distinguish "city is
   * required" from "nothing is required" — and loosening the house-number rule is
   * exactly the kind of change that could take city and street with it.
   */
  test('a missing city does not reach the gateway, and says so in Hebrew', async ({ page }) => {
    const captured = await seedCartAndStubBackend(page)

    await page.goto('/he/checkout')
    await fillCheckoutForm(page, { city: '', street: 'אעבלין', houseNumber: null })
    await payButton(page).click()

    // Asserting the message, not just the absence of a call: an inert page would
    // also produce no call, and that is how this spec first passed for the wrong
    // reason. The message proves the form ran and specifically refused.
    await expect(page.getByText('יש להשלים את שדות החובה שלמעלה.')).toBeVisible()
    expect(captured.gateway).toBeNull()
  })

  test('a whitespace-only street does not reach the gateway', async ({ page }) => {
    const captured = await seedCartAndStubBackend(page)

    await page.goto('/he/checkout')
    await fillCheckoutForm(page, { city: 'אעבלין', street: '   ', houseNumber: null })
    await payButton(page).click()

    await expect(page.getByText('יש להשלים את שדות החובה שלמעלה.')).toBeVisible()
    expect(captured.gateway).toBeNull()
  })
})
