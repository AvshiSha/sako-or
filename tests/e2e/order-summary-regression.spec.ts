import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { test, expect, type Page } from '@playwright/test'

/**
 * Order summary regressions fixed on 2026-10-09:
 *
 * - **A points redemption applied on the cart did not reach checkout.**
 *   `useCartPricing` persisted applied coupon codes to `localStorage` but held
 *   `pointsToUse` in plain `useState`, and the cart and checkout are separate
 *   route mounts. Pressing "Checkout" therefore dropped the redemption, the
 *   discount and the order total silently — and a checkout refresh dropped it
 *   again. Now persisted under `cart_points`, keyed by uid.
 * - **Both summary fields sat exactly on the iOS 16px zoom floor.** `font-ploni`
 *   loads with `font-display: swap` and its generated fallback carries
 *   `size-adjust: 97.13%`, so during the swap window a declared 16px is used as
 *   15.54px and iPhone Safari zooms the page in on focus. `FIELD_BOX_TEXT` adds
 *   a pixel on coarse pointers.
 *
 * ## Why everything is stubbed
 *
 * The points block only renders for a signed-in user, and the balance comes from
 * `/api/me/points`, which verifies a real Firebase token against the production
 * database. So the Firebase SDK is seeded with a fake session (its own IndexedDB
 * record, which is where it looks on init) and every network edge is answered
 * locally. Nothing here touches production data, no order is created and no
 * points are spent — `/api/me/points` is never reached.
 */

const CART_SKU = 'QA-SUMMARY-1'
const UNIT_PRICE = 500
const QUANTITY = 2
const SUBTOTAL = UNIT_PRICE * QUANTITY // 1000
/** 15% of the cart is the redemption ceiling, so 150 here. */
const POINTS_BALANCE = 400
const POINTS_TO_REDEEM = 100
const FAKE_UID = 'qa-points-uid'

/**
 * Firebase names its persistence key after the API key, so the seeded session is
 * invisible to the SDK unless this matches the key the running server was built
 * with. Read from the env files in Next's own precedence rather than hardcoded —
 * the copy in the repo-root `firebase.js` is a stale leftover and is *not* the
 * one the app uses, which is exactly the trap this comment exists to prevent.
 */
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

/**
 * Seed the Firebase session and answer every call the summary makes.
 *
 * Firebase prefers IndexedDB persistence, which cannot be seeded from an init
 * script — the write is asynchronous and loses the race against the SDK's own
 * read. So IndexedDB is made unavailable, which drops the SDK onto its
 * `browserLocalPersistence` fallback: one synchronous `localStorage` key, in
 * place before any page script runs. `expirationTime` is an hour out so the SDK
 * trusts the stored token instead of refreshing it.
 *
 * Note the auth chunk is lazy on storefront routes (ClientAuthProvider loads it
 * on idle, with a 3s timeout), so the points block appears a beat after the rest
 * of the summary. Every wait below is a web-first assertion for that reason.
 */
async function signInAndStubBackend(page: Page) {
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
            email: 'qa-points@example.com',
            emailVerified: true,
            displayName: 'QA Points',
            isAnonymous: false,
            phoneNumber: null,
            photoURL: null,
            providerData: [
              {
                providerId: 'password',
                uid: 'qa-points@example.com',
                displayName: 'QA Points',
                email: 'qa-points@example.com',
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
      } catch {
        // Private mode — let it surface as a signed-out cart rather than a
        // confusing assertion failure.
      }
    },
    { apiKey: FIREBASE_API_KEY, uid: FAKE_UID, cartLine: CART_LINE }
  )

  // Firebase's own endpoints: the SDK may still verify or refresh on init.
  await page.route('**/identitytoolkit.googleapis.com/**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        users: [
          {
            localId: FAKE_UID,
            email: 'qa-points@example.com',
            emailVerified: true,
            displayName: 'QA Points',
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

  // The points balance. Never let this reach the real route — it would read the
  // production user table with a token that cannot verify.
  await page.route('**/api/me/points**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ pointsBalance: POINTS_BALANCE, points: [], totalCount: 0 })
    })
  )

  // Stock: without this every line hydrates as 'checking' and the summary holds
  // at ₪0.00, which is also the state the restore deliberately waits out.
  await page.route('**/api/cart/validate', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [CART_LINE] })
    })
  )

  // No automatic deal and no auto-applied coupon: both would move the 15% cap
  // and the assertions below are about the points line, not the cap.
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

  // Profile sync / admin probes fire on sign-in and are irrelevant here.
  await page.route('**/api/users/sync**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  )
}

const pointsField = (page: Page) => page.getByRole('spinbutton', { name: 'מימוש נקודות' })

/**
 * The points block's own Apply, reached from the field rather than by role name:
 * the coupon field above it has an identically labelled button, and an
 * unanchored `getByRole('button', { name: 'החל' })` is a strict-mode violation.
 */
const applyPoints = (page: Page) => pointsField(page).locator('xpath=following-sibling::button[1]')

/**
 * The summary's own points line. Both of these need `exact`: the points block
 * restates the figure as "הנחת נקודות: -₪100.00" next to its Remove button, so a
 * substring match is a strict-mode violation against the summary row.
 */
const pointsRowLabel = (page: Page) => page.getByText('הנחת נקודות', { exact: true })
const pointsRowAmount = (page: Page) =>
  page.getByText(`-₪${POINTS_TO_REDEEM}.00`, { exact: true })

/** The summary's total row — the label's parent carries label and figure. */
async function readOrderTotal(page: Page): Promise<string> {
  const label = page.getByText('סך כל ההזמנה', { exact: true })
  return ((await label.locator('xpath=..').textContent()) || '').trim()
}

test.describe('order summary', () => {
  test('a points redemption applied on the cart survives checkout and a refresh', async ({
    page
  }) => {
    await signInAndStubBackend(page)

    // ── Cart: redeem ────────────────────────────────────────────────────────
    await page.goto('/he/cart')

    // The dev server serves inert markup; anything below depends on effects.
    const hydrated = await page.evaluate(() =>
      Array.from(document.querySelectorAll('button')).filter(b =>
        Object.keys(b).some(k => k.startsWith('__react'))
      ).length
    )
    expect(hydrated, 'page is inert — run against `next start`, not `next dev`').toBeGreaterThan(0)

    const cartField = pointsField(page)
    await expect(cartField, 'points block renders only for a signed-in user').toBeVisible()

    await cartField.fill(String(POINTS_TO_REDEEM))
    await applyPoints(page).click()

    await expect(pointsRowLabel(page)).toBeVisible()
    await expect(pointsRowAmount(page)).toBeVisible()
    expect(await readOrderTotal(page)).toContain(
      (SUBTOTAL - POINTS_TO_REDEEM).toLocaleString('he-IL', { minimumFractionDigits: 2 })
    )

    // The persisted handoff — the bug was that nothing was written here.
    const persisted = await page.evaluate(() => localStorage.getItem('cart_points'))
    expect(persisted, 'redemption was never persisted for the next route').not.toBeNull()
    expect(JSON.parse(persisted!)).toMatchObject({ uid: FAKE_UID, points: POINTS_TO_REDEEM })

    // ── Checkout: the redemption is already there ───────────────────────────
    await page.goto('/he/checkout')

    await expect(pointsField(page)).toHaveValue(String(POINTS_TO_REDEEM))
    await expect(pointsRowAmount(page)).toBeVisible()
    expect(
      await readOrderTotal(page),
      'checkout total disagrees with the cart about the redemption'
    ).toContain((SUBTOTAL - POINTS_TO_REDEEM).toLocaleString('he-IL', { minimumFractionDigits: 2 }))

    // ── And it survives a checkout refresh ──────────────────────────────────
    await page.reload()

    await expect(pointsField(page)).toHaveValue(String(POINTS_TO_REDEEM))
    await expect(pointsRowAmount(page)).toBeVisible()

    // ── Removing it on checkout clears the handoff too ──────────────────────
    // Exact: a coupon's remove button is named "הסר <CODE>", not "הסר".
    await page.getByRole('button', { name: 'הסר', exact: true }).click()
    await expect(pointsField(page)).toHaveValue('')
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('cart_points')))
      .toBeNull()
  })

  /**
   * The negative control for the test above. Without it, a green checkout
   * assertion would not distinguish "the handoff works" from "checkout happens
   * to show a redemption for some other reason" — and the original defect was
   * precisely that nothing was handed off, so the discriminating signal has to
   * be the `cart_points` key itself.
   */
  test('with the stored handoff gone, checkout shows no redemption', async ({ page }) => {
    await signInAndStubBackend(page)

    await page.goto('/he/cart')
    const cartField = pointsField(page)
    await expect(cartField).toBeVisible()
    await cartField.fill(String(POINTS_TO_REDEEM))
    await applyPoints(page).click()
    await expect(pointsRowLabel(page)).toBeVisible()

    await page.evaluate(() => localStorage.removeItem('cart_points'))

    await page.goto('/he/checkout')
    await expect(pointsField(page)).toBeVisible()
    await expect(pointsField(page)).toHaveValue('')
    await expect(pointsRowLabel(page)).toBeHidden()
    expect(await readOrderTotal(page)).toContain(
      SUBTOTAL.toLocaleString('he-IL', { minimumFractionDigits: 2 })
    )
  })

  test('both summary fields clear the iOS zoom floor on a touch device', async ({
    page
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'the floor only applies to coarse pointers')

    await signInAndStubBackend(page)
    await page.goto('/he/cart')

    expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)

    /**
     * 17px, not 16px. iOS Safari zooms below 16px, and `ploni Fallback` carries
     * `size-adjust: 97.13%`, so a declared 16px is *used* as 15.54px for the
     * whole `font-display: swap` window — which on a phone is exactly when the
     * field is tapped. 17 × 0.9713 = 16.51px, clear of the floor either way.
     */
    for (const field of [page.locator('#summary-coupon'), pointsField(page)]) {
      await expect(field).toBeVisible()
      const size = await field.evaluate(el => parseFloat(getComputedStyle(el).fontSize))
      expect(size).toBeGreaterThan(16)
    }
  })
})
