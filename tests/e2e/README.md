# Browser regression tests

`tracking-regression.spec.ts`, covering two tracking defects fixed on
2026-10-08:

- **`ViewContent` fired twice per PDP view.** The analytics effect in
  `ProductColorClient` keys off the `product` / `currentVariant` objects, and
  the realtime Firestore listener replaces both with freshly built values on
  every snapshot — including the initial one, whose data is identical to the
  server-rendered props. Guarded by `lastReportedViewKeyRef`.
- **`/[lng]/product/[baseSku]` dropped the query string** when redirecting to
  the primary colour, so `fbclid` never reached the browser and `_fbc` was never
  set.

`order-summary-regression.spec.ts`, covering two order-summary defects fixed on
2026-10-09:

- **A points redemption applied on the cart did not reach checkout.**
  `useCartPricing` persisted coupon codes but held `pointsToUse` in plain
  `useState`, and the cart and checkout are separate route mounts — so pressing
  "Checkout" dropped the redemption, its discount and the order total, and a
  checkout refresh dropped it again. Now persisted under `cart_points`, keyed by
  uid. The spec carries a **negative control**: with the key removed by hand,
  checkout must show no redemption. Without it, a green checkout assertion would
  not distinguish a working handoff from one that never mattered.
- **Both summary fields sat exactly on the iOS 16px zoom floor.** `FIELD_BOX_TEXT`
  in `app/components/ui/input.tsx` now adds a pixel on coarse pointers; that file
  explains why 16px was not enough (`font-display: swap` plus the generated
  `ploni Fallback`'s `size-adjust: 97.13%` uses a declared 16px as 15.54px).
  The spec asserts the computed size, which is the cause — Chromium cannot
  reproduce Safari's zoom itself, so the behaviour still wants a real device.

## Signing in without a real account

The points block renders only for a signed-in user and the balance comes from
`/api/me/points`, which verifies a real Firebase token against the production
database. `order-summary-regression.spec.ts` fakes the session instead, and two
details are load-bearing:

1. **Firebase prefers IndexedDB persistence, which cannot be seeded from an init
   script** — the write is asynchronous and loses the race against the SDK's own
   read. The spec makes `indexedDB` unavailable, which drops the SDK onto
   `browserLocalPersistence`: one synchronous `localStorage` key.
2. **The persistence key is named after the API key, and the `firebase.js` at the
   repo root is a stale leftover carrying a different one.** The real key comes
   from `NEXT_PUBLIC_FIREBASE_API_KEY`, which is what the spec reads. Seeding
   under the wrong key fails silently: the record simply sits there unread, the
   page renders as a signed-out cart, and nothing in the console says why.

Also note the auth chunk is **lazy on storefront routes** — `ClientAuthProvider`
loads it on idle with a 3s timeout — so the points block arrives a beat after the
rest of the summary. Wait for it with a web-first assertion, not a fixed delay.

`/api/me/points` is never reached, no order is created and no points are spent.

## Running

```bash
npm run build
npx next start -p 3002
QA_BASE_URL=http://127.0.0.1:3002 npm run test:e2e
```

Projects: `desktop` (1440×900) and `mobile` (iPhone 13 metrics, Chromium
engine). Both are kept because the PDP renders a separate buy box per
breakpoint. First run needs the browser: `npx playwright install chromium`.

## Do not run these against `next dev`

**React does not hydrate on the Turbopack dev server under headless Chromium.**
Measured 2026-10-08, same page and browser:

| | React-keyed buttons | `window.fbq` | `dataLayer` |
|---|---|---|---|
| `next dev` | **0 of 60** | `undefined` | absent |
| `next start` | **61 of 61** | `function` | 7 entries |

The dev server's HMR socket fails (`ws://…/_next/webpack-hmr` →
`net::ERR_INVALID_HTTP_RESPONSE`) and the client runtime never takes over the
markup, so nothing behind an effect or a click runs: no pixel init, no
`ViewContent`, no size selection. Every failure looks like a product bug.
Diagnose it in one call before believing any interaction failure:

```js
Array.from(document.querySelectorAll('button'))
  .filter(b => Object.keys(b).some(k => k.startsWith('__react'))).length
```

Zero means the page is inert and the result says nothing about the product. The
query-string tests use Playwright's `request` fixture and are server-side, so
those alone are valid on dev.

## The pixel is stubbed on purpose

`connect.facebook.net/**` is answered with an empty 200 and `facebook.com/tr**`
with an empty GIF, so a test run never fires `PageView` / `ViewContent` /
`AddToCart` at the **production pixel** and pollutes live ad reporting. Events
are captured at the `fbq` boundary by a property trap installed before page
scripts run.

It is answered 200 rather than aborted because aborting sends the app into its
`scheduleFbqLoadRetry` path, and the point is to measure dispatch.

This proves the app dispatches the right event with the right payload. It cannot
prove Meta accepted it — confirm that in Events Manager → Test Events.

Nothing here writes to production data and no order is created: the cart is
localStorage plus `POST /api/cart/validate`, which only reads stock.

## Two selector traps the spec works around

1. **The buy box exists twice in the DOM** (mobile `lg:hidden`, desktop
   `hidden lg:block`, only CSS hides one), so bare role queries are strict-mode
   violations. Filter to the visible copy.
2. **A sold-out size cell's accessible name is `"42 — אזל מהמלאי"`** — the CTA's
   own out-of-stock label. An unanchored Add-to-Cart pattern therefore matches a
   *disabled size button*, and since the size grid precedes the CTA, `.first()`
   picks it and `click()` waits out the full timeout with nothing useful in the
   error. Anchor the pattern.
