# Browser regression tests

One spec, `tracking-regression.spec.ts`, covering two tracking defects fixed on
2026-10-08:

- **`ViewContent` fired twice per PDP view.** The analytics effect in
  `ProductColorClient` keys off the `product` / `currentVariant` objects, and
  the realtime Firestore listener replaces both with freshly built values on
  every snapshot — including the initial one, whose data is identical to the
  server-rendered props. Guarded by `lastReportedViewKeyRef`.
- **`/[lng]/product/[baseSku]` dropped the query string** when redirecting to
  the primary colour, so `fbclid` never reached the browser and `_fbc` was never
  set.

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
