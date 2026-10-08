# Storefront loading architecture

How a route should behave while it waits, what is already done, and what is left.
Written after the Collection/Campaign work and the PDP pass; the remaining items
in [§5](#5-remaining-audit-findings) are an open to-do list, not a wish list.

The principle, in order:

> immediate route feedback → layout-accurate skeleton → stable dimensions →
> streamed/SSR content → smooth replacement → **no blank intermediate state**

---

## 1. The reference pattern

`app/(site)/[lng]/collection/[[...slug]]` and `.../collection/campaign/[slug]`.

Four parts, and all four matter:

1. **`loading.tsx`** at the route segment, rendering a skeleton built for *that*
   page. Never a generic one — a PDP must not show collection cards.
2. **A chrome module** holding the layout's load-bearing dimensions
   (`collectionChrome.tsx`, `product-card-layout.ts`, `productPageChrome.tsx`).
   The real page **and** its skeleton both import it. This is the mechanism, not
   a tidiness preference: the collection skeleton is accurate to 0.5px only
   because neither side owns its own copy of the numbers.
3. **Measured, under-reserved heights.** Reservations come from measuring the
   rendered page, not from the design file. Short of the real height costs a
   little CLS; past it leaves blank ground inside the component, which is worse
   and scales with the viewport.
4. **A redirect/notFound decision hoisted into a `layout.tsx`** — see §2.

---

## 2. Why `notFound()`/`redirect()` has to live in a layout

`loading.tsx` wraps a folder's **children**, so a `layout.tsx` in the same folder
renders *outside* the boundary. That placement is what lets a route have both a
loading state and a real status code.

A `loading.tsx` flushes its fallback immediately, which sends the headers and
pins the status at 200 for everything inside the boundary. A `notFound()` under
it degrades to a soft 404; a `redirect()` degrades to a meta refresh. Putting the
decision in the layout means it throws before anything flushes.

Done this way on:

- `collection/campaign/[slug]/layout.tsx` — campaign lookup + redirect
- `product/[baseSku]/[colorSlug]/layout.tsx` — product + colour lookup + 404

**Consequence to know about:** a slug that must be validated in a layout has to be
a *path segment*, because layouts receive `params` and never `searchParams`. That
is why `?slug=` moved into the path on the campaign route, with a middleware 308
preserving the old URLs.

---

## 3. Prefetching is not safe on these routes

A dynamic route **with** a loading boundary can render an empty content area.
Next's `InnerLayoutRouter` does
`useDeferredValue(cacheNode.rsc, resolvedPrefetchRsc)`, so it renders a segment's
prefetched payload in preference to suspending — and for a dynamic route whose
prefetch was fetched under a router state tree that has since moved on, that
payload carries neither the page nor the loading boundary. The segment renders
nothing, the skeleton never gets its turn, and the footer ends up under the
header for two to three seconds.

Reproduced on Collection → Collection: **4 empty transitions in 66**, zero after
disabling prefetch on those links.

So every link into such a route goes through a wrapper:

| wrapper | for hrefs pointing at |
| --- | --- |
| `app/components/ListingLink.tsx` | `/[lng]/collection/...` |
| `app/components/ProductLink.tsx` | `/[lng]/product/...` |

Both are enforced by `eslint.config.mjs`: `no-restricted-imports` bans
`next/link` in the files where every link is one of these, and a
`no-restricted-syntax` selector catches any `<Link href="…/collection/…">` or
`<Link href="…/product/…">` added later anywhere under `app/` or `lib/`. The
selector keys on the element being named `Link`, which is why these wrappers are
imported under their own names rather than aliased to `Link`.

**Rule: a new loading boundary and its link wrapper ship in the same change.**
Adding the boundary alone trades a slow route for an intermittently blank one.

---

## 4. The limit of `loading.tsx`, and what covers it

A route fallback can only appear once the client has the **layout's** payload,
because the boundary lives inside the layout. So the fallback is only visible when
the page is meaningfully slower than its own layout.

Measured on client-side navigation, 4× CPU / 400ms latency:

| navigation | skeleton appears | why |
| --- | --- | --- |
| Collection → Collection | 708ms ✓ | parent layout has no awaits; the page is slow |
| Home → Campaign | 1269ms ✓ | layout awaits one document; the product query is far slower |
| Collection → **PDP** | **never** | the layout and the page finish within ~110ms of each other |

The PDP's skeleton is real and does show on a cold/hard load, but on client-side
navigation the page arrives at ~817ms and the fallback never gets a frame — so a
tap still shows the old page for that long with no acknowledgement.

**A route fallback is the wrong tool for that case.** The acknowledgement moves to
the link instead, via `useLinkStatus()` (exported from `next/link` in Next 16),
which `ProductLink` implements: a scrim and a 2px sheened rule on the tapped card,
both absolutely positioned so the grid cannot shift. Measured tap → visible
feedback: **median 85ms, worst 97ms**, against 722–1068ms of nothing before.

`useLinkStatus()` reads a context each `Link` provides for itself, so only the
card actually tapped responds, and it is backed by `useOptimistic`, so the state
unwinds on its own when the navigation commits, is interrupted by another tap, or
is abandoned via back/forward. Verified: 1 of 12 cards pending, 0 stranded after
navigation, 0 after back, a double tap still yields 1.

`loading.tsx` stays regardless — it is what covers a cold or direct load, where
there is no card to put a pending state on.

---

## 4b. Never import shared constants from a `'use client'` module

A chrome module (`collectionChrome`, `productPageChrome`, `checkoutChrome`,
`carouselChrome`) must be a **plain module with no `'use client'`**, even when its
only consumers are client components.

Export a constant from a client module and import it into a server component and
it arrives as a *client reference*, not a string. Interpolating it into a
`className` renders the source of a throwing stub straight into the markup:

```
class="function(){throw Error(&quot;Attempted to call CAROUSEL_HEADER_BAND() from
       the server but CAROUSEL_HEADER_BAND is on the client...&quot;)}"
```

It does not fail to build. It does not fail to type-check. The page renders, just
unstyled in that one spot — the home fallback measured 280px against the
carousel's real 487.8px before this was caught by measuring the two against each
other. Which is the argument for measuring fallback and real geometry on every one
of these, rather than trusting that the classes went where they were sent.

---

## 4c. The auth provider must never be an ancestor of the page

`ClientAuthProvider` used to render two different components at the same position:
`GuestAuthProvider` until the Firebase chunk arrived, then `AuthenticatedAppShell`.
React reconciles by position **and type**, so that swap unmounted and remounted
everything below it — every page, roughly 1–3s after every document load.

Measured consequences: the favourites skeleton visibly reappeared at **+1324ms**,
all page client state was discarded, and a guest part-way through the checkout
form would have lost it. The A/B that identified it suppressed the idle upgrade:
1 skeleton re-appearance normally, 0 with the upgrade suppressed.

The fix ("Option C") keeps **one stable provider chain** mounted for the life of
the document and mounts Firebase **beside** the page as a null-rendering sibling
that publishes its value upward:

```tsx
const value = firebaseValue ?? guestValue
<AuthContext.Provider value={value}>
  {bridge}              {/* sibling — may mount/unmount freely */}
  <FacebookPixelInit />
  <AuthTransitionListener>      {/* fixed chain, never replaced */}
    <ProfileCompletionGate>
      <FavoritesProvider>{children}</FavoritesProvider>
```

React only unmounts a subtree when the chain of *ancestors* above it changes type.
Siblings are free to come and go. So `AuthProvider` does not need to be an ancestor
of `children` at all — it only needs to produce a value.

**What is deliberately unchanged:** `AuthContext.tsx`, and *when* Firebase loads.
All three triggers (auth routes, auth-intent clicks, the idle upgrade) are exactly
as they were, so a returning customer's session is restored by the same code on the
same schedule — no cold-start window, no migration, and no auth "hint" to get
wrong. `onAuthStateChanged` remains the only authority on who is signed in.

### The render loop this shape can create — read before editing either file

`AuthContext.tsx` builds its context value as a plain object literal (no
`useMemo`), so **every** render of `AuthProvider` yields a new identity. Relaying
that object straight up deadlocks the app:

```
relay effect sees a new `value` -> onValue -> setFirebaseValue ->
ClientAuthProvider re-renders -> recreates the <Bridge> element ->
AuthProvider re-renders -> new `value` identity -> relay effect again
```

It never throws and never warns. React simply never goes idle, so nothing else can
commit. The symptom was **every client-side navigation in the storefront stalling**:
the router issued the RSC request for the new route and then never applied it, so
links looked dead while the URL stayed put. Product, cart and `/about` links were
all confirmed STALLED with the RSC request on the wire, while the same routes
returned 200 to `curl` — which is what separated "client router wedged" from
"server broken". A real mouse event reported `defaultPrevented: true`, proving
`next/link`'s handler ran and it was the commit, not the click, that was lost.

Two independent guards, kept together so a later edit to one cannot silently
reintroduce the loop:

1. **`FirebaseAuthBridge`** — the published object is memoised on the fields that
   actually describe the session (`user`, `loading`, `isAdmin`,
   `adminCheckPending`, `profileSyncedUid`). `signIn`/`signUp`/`logout` are stable
   `useCallback` delegates that read a ref, so they contribute no identity churn
   and cannot go stale.
2. **`ClientAuthProvider`** — the `<Bridge>` element is memoised, so a
   `setFirebaseValue` cannot re-render that subtree at all.

Wrapping `AuthContext.tsx`'s value in `useMemo` would also break the loop, but
that file owns session restoration for existing customers and this bug does not
require touching it.

### Verified after the fix

```
nav             product / cart / about links       all OK (were all STALLED)
favourites      remounts=0  skeletonReappearances=0  counter="3 פריטים"
after refresh   remounts=0  skeletonReappearances=0  guest favourites intact
cart            remounts=0  totals=["1,190.00","1,190.00"]
checkout        remounts=0  form values survive the chunk landing
collection→PDP  landed=/he/product/5104-0021/black  back=collection  remounts=0
tap feedback    median 92ms, worst 101ms, exactly 1 card, 0 stranded states
CLS desktop     /he 0.0046 · collection 0.0005 · 404 0.0004 · about/news 0.0000
CLS mobile      0.0000 across all five routes
build + tsc     clean · eslint link rules 0 findings
```

**Not verifiable locally** — needs a real test account on a Preview deployment:
sign-in, sign-out, refresh while signed in, favourites synchronisation between
guest and account, and profile completion. The guest paths above are covered; the
authenticated ones are not.

---

## 5. Remaining audit findings

Priority order agreed with the product owner. Each line records the measurement
that justifies it.

### Next up

- [ ] **`ClientAuthProvider` remounts the entire app subtree ~1–3s after every
      page load.** The highest-value item on this list, and an architectural
      change rather than a loading one — flagged rather than fixed.

      `ClientAuthProvider` renders two different trees at the same position:

      ```
      !AuthShell → <GuestAuthProvider><FavoritesProvider>{children}</FavoritesProvider></GuestAuthProvider>
       AuthShell → <AuthShell>{children}</AuthShell>      // mounts its OWN FavoritesProvider
      ```

      When the deferred `import('AuthenticatedAppShell')` resolves — on
      `requestIdleCallback`, or its 3s timeout — the component type at that
      position changes, so React unmounts the whole subtree and mounts a fresh
      one. Every page's client state is discarded and every effect re-runs.

      Proved by A/B on the favourites page, `requestIdleCallback` stubbed vs not:
      1 skeleton re-appearance (at +1324ms, ~145ms long) against 0. That flash is
      `FavoritesProvider` remounting and resetting `loading` to true — it is not
      fixable from inside Favorites, which is why the flicker survived the
      dependency fixes above.

      Two consequences worth chasing together:
      - It is the most plausible cause of the open document-level CLS below. A
        full subtree remount changes the document height for a frame, is
        attributed to the root, and fires on `requestIdleCallback` timing — which
        matches the run-to-run variance exactly.
      - It is almost certainly also why the collection grid's server-rendered
        markup is discarded (§4 notes the SSR grid being thrown away at
        hydration).

      The fix is to stop changing the component type: hoist a single
      `FavoritesProvider` so both branches share one instance, or render one auth
      shell whose internals swap rather than the shell itself. Both touch the
      provider tree above every page including checkout, so this wants its own
      change with its own verification.

- [ ] **Cardcom end-to-end, in a safe environment.** Everything up to the gateway
      is verified (see §7); what is not is listed there. Run it against sandbox
      credentials before a production release.


### Done

- [x] **Collection / Campaign** — the reference implementation; see §1–§3.
- [x] **The document-level CLS, solved: it was the scrollbar.** `html {
      scrollbar-gutter: stable }`. Every page starts one viewport tall, content
      streams in, the document outgrows the viewport, the vertical scrollbar
      appears and narrows the root element. Captured from the shift entry itself
      on /he/about: `HTML prev:[0,0,1425,99] -> cur:[0,0,1425,900]`, with
      `clientWidth 1440 -> 1425` and `scrollHeight 900 -> 2883` in the same frame.
      Desktop only, because mobile uses overlay scrollbars - the asymmetry that
      identified it.

      It was **not** the `ClientAuthProvider` remount, which had been the leading
      suspect. A/B with `requestIdleCallback` stubbed to suppress the swap left
      the numbers unchanged (0.0105 / 0.0961 / 0.1102 either way), so the
      hypothesis was tested and rejected before any auth code was touched.

      Desktop CLS, 3 runs per route, before -> after:

      | route | before | after |
      | --- | --- | --- |
      | `/he` | 0.0046 / 0.0105 / 0.0000 | 0.0046 / 0.0000 / 0.0000 |
      | `/he/about` | 0.0105 / 0.0000 / 0.0653 | 0.0000 / 0.0000 / 0.0000 |
      | `/he/news` | 0.0105 / 0.0000 / 0.0000 | 0.0000 / 0.0000 / 0.0000 |
      | `/he/collection/women/shoes` | 0.0000 / 0.1102 / 0.0000 | 0.0000 / 0.0000 / 0.0000 |
      | soft 404 | 0.0000 / 0.0961 / 0.0961 | 0.0000 / 0.0003 / 0.0004 |

      Mobile unchanged at 0.0000 throughout. No horizontal overflow at 390, 768,
      1024, 1440 or 1920, and the header and hero still measure full-bleed at
      every one. The residual 0.0046 on `/he` is a different, much smaller shift
      in the footer area at ~7s, not this one.
- [x] **Favorites** — guest persistence verified (survives refresh, navigation
      *and* a removal: 6 saved → remove one → refresh → 5, storage agreeing at
      every step; the `loading` guard in `FavoritesProvider` that fixes the old
      "favorites vanish on refresh" bug is doing its job). Product lookups
      parallelised: the loader awaited `getProductByBaseSku` once per saved
      product in sequence, so ten saved pairs cost ten serial round trips from
      the browser; they are one `Promise.all` now. `toggleFavorite` moved into a
      ref and the effect keyed on a joined string instead of the array identity,
      so an auth-driven callback identity change cannot restart the loader. Row
      skeleton extracted to `SavedLineRowsSkeleton`, shared with the cart, which
      had a byte-identical copy. Both upgraded from `animate-pulse
      bg-sako-gray-300` to `sako-skeleton` — the last two places on the storefront
      still using the pre-design-system treatment — and both gained
      `role="status"` / `aria-busy` / `aria-label`. Row reservation 150 against a
      real 153 on mobile, 178 against 178 on desktop; CLS 0.0000.
- [x] **Blog article** `/news/[slug]` — `fetchRelatedProductsForArticle` moved
      behind an in-page `<Suspense>`; the article still renders in the shell, so
      the indexable content and the LCP image are untouched. TTFB **0.837s →
      0.285s**. Fallback vs real carousel 0.5px at both breakpoints, CLS 0.0001
      mobile / 0.0000 desktop, unknown slug still a real 404.
- [x] **Soft 404** `/[lng]/[...notFound]` — same split: the apology renders in the
      first flush, the best-sellers rail streams behind it. TTFB **0.366s →
      0.198s**, first paint of the message 865–1118ms → **644–679ms** warm.
      Status stays 200 with `noindex` (documented, deliberate) and real
      `notFound()` routes still return 404.
- [x] **Profile** — seven of nine hand-rolled spinners replaced by
      `ProfilePaneSkeleton` (built from `profileTheme`) and in-card row
      placeholders. Two kept on purpose: `ConfirmDialog`'s is a button affordance,
      and `ProfileLayoutClient`'s is an **auth boundary**, not a content loader —
      changing it would render the profile chrome to a visitor who is about to be
      redirected. All five profile routes still redirect to `/signin` when signed
      out. *The skeletons themselves are not visually verified: they only render
      for an authenticated session, which cannot be created locally.*
- [x] **Shared `ProductCarouselSkeleton`** — one stand-in for every suspended
      carousel (home best sellers, article related products, 404 suggestions),
      reading `carouselChrome` and reusing `CollectionProductCardSkeleton`.
- [x] **Homepage** — the About band and Shop by Collection moved *outside* the
      Suspense boundary (neither waits on anything: the banners are a module
      constant and both components are presentational), so 73% of the below-hero
      content now ships in the first flush. The boundary reserves only the
      best-sellers carousel, via `carouselChrome.ts` and the existing
      `CollectionProductCardSkeleton` — the carousel's cards *are* ProductCards.
      Fallback vs real: 487.3 against 487.8 on mobile, 670.6 against 671.1 on
      desktop. Page height across the swap: 2475 → 2475 (mobile), 2588 → 2589
      (desktop).
- [x] **Cart → Checkout CTA** — `router.push` wrapped in `useTransition`, so the
      pending state spans the stock revalidation *and* the navigation. It used to
      clear in a `finally` immediately before `router.push`, which is exactly when
      the ~1.5s wait began. Feedback now at a median of 70ms: a sheen across the
      filled CTA (`.sako-cta-pending-sheen`), `aria-busy`, and an sr-only status.
      Re-entry is refused by a ref guard — five clicks in one frame produce one
      overlay and one `/api/cart/validate` call.
- [x] **Checkout** — `CheckoutSkeleton` built on the real `CheckoutShell`, so the
      grid, seam, heading band and eyebrow are the same elements the loaded page
      uses; form measurements shared via `checkoutChrome.ts`. Desktop CLS
      0.0107 → 0.0002. Note for anyone working here: `useCartPricing` calls
      `useSearchParams()`, which bails the whole boundary out of SSR
      (`BAILOUT_TO_CLIENT_SIDE_RENDERING` is in the served HTML), so the fallback
      is what every visitor sees until hydration — it is not an edge case.
- [x] **PDP** — `loading.tsx` + `ProductPageSkeleton` for cold loads (skeleton in
      the first flush, CLS 0.0000, mobile reservation within 45px / gallery exact),
      `notFound()` hoisted into the layout so both 404s survive, and `ProductLink`
      for prefetch safety and the tap acknowledgement in §4.

### Looked at, deliberately left alone

- **Blog index `/news` — tried, measured, reverted.** An in-page `<Suspense>`
  around the article list made the page *worse*, not better. The list is the whole
  of the page's content, so splitting the response bought a skeleton at
  1120–1237ms while pushing the articles themselves from 1030–1270ms out to
  1611–2815ms. On a page already delivering in one flush at ~0.2s TTFB the
  streaming overhead exceeds the gain. Reverted; the measurement is the reason,
  and it is worth re-checking only if the article query gets materially slower.


- **Cart / Favorites** — `CartSkeleton` / `FavoritesSkeleton` already serve as
  both the route fallback and the client loading state, and match the real
  layout. Note that both SSR the skeleton rather than content (`!isClient`),
  which is correct for personalised, non-indexable pages.
- **Static pages** (about, faq, terms, privacy, policies, shipping-and-returns,
  accessibility, bags/guide) — 13–37ms, one flush, nothing to wait for. A loading
  state here would be noise.
- **`(unlocalized)/loading.tsx`** — covers Success/Failed/Cancel/preview/review.
  Checked: none of them call `notFound()` or `redirect()`, so the boundary does
  not degrade any status code. Safe as-is.
- **Search** — `/collection?search=` *is* the collection route and inherits its
  skeleton.
- **PDP `resolveCategoryTrail`** — cannot run in parallel with the product fetch
  (it reads `product.categories_path_id`), and its own category lookups are
  already parallel and request-cached via `getCachedCategoryById`. Moving it
  behind the loading boundary would let the layout flush a round trip earlier,
  but it feeds the breadcrumbs and the `<h1>` display name, so it would move
  visible above-the-fold chrome inside the fallback. Not worth it on its own;
  revisit only if the PDP's TTFB becomes a problem.

---

## 6. Checklist for a new route

1. Does it await data before the first byte? If yes, it wants a boundary.
2. Does it call `notFound()`/`redirect()`? Then hoist that into a `layout.tsx`
   above the boundary, and make the validated slug a path segment.
3. Build the skeleton from the page's own chrome module; measure the rendered
   page and under-reserve.
4. Add the link wrapper for every href into it, in the same change.
5. Verify: TTFB, that the fallback is in the first flush, real status codes, CLS,
   and that repeated client navigation never produces header-then-footer.

---

## 7. Cardcom: what is verified, and what is not

The checkout fallback cannot touch the payment flow — `PaymentIframe` renders
*inside* the Suspense boundary (`CheckoutClient.tsx`), so it only exists once the
fallback is gone. That is structural, not incidental.

**Verified locally**, with a seeded cart:

- 0 skeleton nodes in the DOM once hydrated; no `PaymentIframe` before pay.
- `CheckoutSkeleton` and `CheckoutShell` have no global side effects — no
  `useScrollLock`, no portal, no `document`/`window` access.
- Filling the form and submitting reaches
  `POST /api/payments/create-low-profile` with a well-formed payload (`orderId`,
  `amount`, `currencyIso`, `language`, `productName`, `productSku`, `items[]`).
- Server-side validation failures surface via `role="alert"` and the page stays put.

**NOT verified, and deliberately so.** `.env.local` carries live
`CARDCOM_API_NAME` / `CARDCOM_API_PASSWORD` / `CARDCOM_TERMINAL_NUMBER`, so
driving the flow past validation would open a real low-profile session with a
third party. These remain untested:

1. Cardcom low-profile session creation (a 200 from `create-low-profile`).
2. `PaymentIframe` rendering with a live `paymentUrl`.
3. `useScrollLock(!!redirectUrl)` while the gateway overlay is open.
4. The gateway redirect and the Success / Failed / Cancel returns.
5. The `/api/webhook/cardcom` callback.

None of these sit downstream of anything changed in the loading work — they are
all past a boundary that has already resolved — but that is reasoning, not a test.
**Run them against sandbox credentials before a production release.**

---

## 8. Final storefront-wide audit

Run against a production build (`next build` + `next start`) on 2026-10-08, after
the §4c render-loop fix. Two viewports: desktop 1440 (1x CPU) and mobile 390
(4x CPU, Slow 4G 1.6Mbps/150ms unless stated).

### What passed

| Area | Result |
|---|---|
| Direct visit + refresh, 13 routes x 2 viewports | 0 page-subtree remounts, 0 user-visible blank states |
| CLS, desktop | 0.0000 on every route |
| CLS, mobile | 0.0000 on every route |
| Cumulative CLS over a whole multi-page session | 0.0000 |
| Journeys J1-J8 (home/collection/campaign/PDP/news/cart/checkout/favorites/profile/search) | every hop navigated; 0 remounts, 0 EMPTY frames, 0 skeleton re-appearances |
| Collection to Collection, 40 consecutive transitions | **0 abnormal frames** (the original bug) |
| Back / forward | correct on a clean profile: home to collection to PDP, back to collection, back to home |
| Tap to visible PDP feedback | median **92ms**, worst 94ms, exactly 1 card, 0 stranded states |
| Cart to Checkout | CTA navigates; form values survive the auth chunk landing (11 inputs) |
| Guest favourites | persist across navigation and refresh; counter stable at 3 items |
| Guest `/he/profile` | correctly redirects to `/he/signin`, 0 remounts |
| Search | 21 product results for a Hebrew query, 0 remounts |
| Structured data | PDP `Product`+`BreadcrumbList`, article `Article`, FAQ `FAQPage`, `Organization` sitewide; no malformed JSON-LD |
| Playwright `tracking-regression.spec.ts` | **18/18** (desktop + mobile) |
| Build / TypeScript / ESLint link rules | clean / clean / **0 findings** |

### Measurement artifacts, not defects

Recorded here because each one looks like a bug in a raw log:

- **`EMPTY` frames on PDP / news-article direct loads.** Both occur *before* FCP
  (PDP: EMPTY at +1262ms, FCP 1284ms; home: +698ms vs FCP 720ms). Nothing was on
  screen yet, so there was no blank state to see.
- **`CONTENT>SKELETON>CONTENT`.** Progressive streaming, not a flicker: the
  below-fold rail is still a skeleton while the top of the page is already
  readable, and `main`'s height never shrinks (news-article 1906 to 9223 to
  9224px). A probe that asks "is there a skeleton anywhere in `main`" cannot tell
  this apart from a regression; make it path-aware and height-aware.
- **"skeleton reappeared" on a client-side navigation.** A skeleton for a *new*
  route is the intended behaviour. Only a skeleton returning on the *same* path
  after content counts.
- **`optionc.js` reporting `skeletonReappearances=1` on favourites.** Its `skel()`
  sets `sawContent = true` on any frame with no skeleton, including the frames
  before the skeleton first mounts, so the first appearance is counted as a
  return. `fav-ab.js` traces the node count directly and reports
  `12 to 0 at +341ms, never again` = **0**.
- **"back did nothing".** The shared Chrome profile had `history.length` capped at
  50 from earlier runs, so back walked into leftover entries. On a fresh profile
  `history.length` is 4 and back/forward are correct. Always use a clean
  `--user-data-dir` for history assertions.

### Open findings

Ordered by what I would fix first. None is a regression from the loading work.

**1. Middleware locale-prefixes `/_vercel/*`, so Analytics and Speed Insights
never load.** `PUBLIC_FILE` in `middleware.ts` does not list `js`, and the skip
list covers `/_next`, `/static`, `/assets`, `/api` but not `/_vercel`. So:

```
/_vercel/insights/script.js  ->  308  ->  /he/_vercel/insights/script.js  ->  200 text/html
```

The catch-all answers with HTML, the browser parses it as JS, and every page logs
`Uncaught SyntaxError: Unexpected token '<'`. `RootShell.tsx:248-249` mounts
`<Analytics mode="production" />` and `<SpeedInsights />`, so locally both are
dead. Whether production is affected depends on whether Vercel's edge serves
`/_vercel/*` before middleware - **unverified**, because the preview share token
has expired. The fix is correct either way:

```ts
pathname.startsWith('/_next') ||
pathname.startsWith('/_vercel') ||   // add
pathname.startsWith('/static') ||
```

**2. The homepage has no `<h1>`** - 0 in SSR and 0 after hydration, against 3
`<h2>`. Every other route has exactly 1. The storefront's single most important
page is the one with no top-level heading.

**3. Campaign pages emit no canonical.** Campaign is the one listing route whose
`generateMetadata` is hand-rolled instead of going through `buildMetadata`
(`lib/seo.ts`), which self-canonicalises. Campaign is `force-dynamic` and reads
filter/sort out of `searchParams`, so every filter permutation is an indexable
duplicate. Route it through `buildMetadata` like collection does.

**4. CMS category copy links to the production domain.** The SEO text block at the
bottom of a collection page (`DIV.cms-content`) contains editor-authored
`<a href="https://www.sako-or.com/he/collection/...">`. Absolute same-site URLs
are full page loads rather than client-side navigations, and on preview or local
they send the visitor to production. Fix in the CMS content, or rewrite same-host
absolute hrefs to relative paths when rendering `cms-content`.

**5. Collection LCP is CPU-bound.** Bandwidth barely moves it; CPU does:

| CPU throttle | FCP | LCP | full content |
|---|---|---|---|
| 1x | 1400ms | 3216ms | 3203ms |
| 2x | 1364ms | 3064ms | 3025ms |
| 4x | 1476ms | 4908ms | 3634ms |
| 6x | 1912ms | 6064ms | 5976ms |

LCP tracks "all 24 cards hydrated" almost exactly, so the cost is hydrating 24
`ProductCard`s, not the 230KB gzipped document (TTFB is 182ms). On a mid-tier
phone that is 5-6s against a 2.5s target. Reducing the initial SSR card count is
now a legitimate lever: it was declined earlier only because it would have masked
the prefetch race, and that race is fixed deterministically by `ListingLink`.

**6. Homepage LCP is the hero video.** The LCP element is
`VIDEO.h-full w-full object-cover` (253KB mp4): 3156ms on Fast 4G, 9772ms on
Slow 4G, 22508ms on Slow 3G - while *full content* is ready at 967ms / 1605ms /
2683ms. The page is usable long before LCP fires. A poster image would decouple
the two.

**7. `ProductCard.tsx` violates rules-of-hooks in 8 places** - see §9.

### Pre-existing, unrelated to this work

- **9 ESLint errors**: 8 rules-of-hooks in `ProductCard.tsx` (§9) and 1
  `prefer-const` in `CheckoutModal.tsx:404`.
- **1 failing unit test**: `faq-ssr-markup.test.tsx:179` asserts
  `/<a[^>]+class="faq-cta"/`, but the CTA renders
  `class="faq-cta font-ploni text-[12px] font-bold"`. The anchor is crawlable and
  locale-prefixed (`href="/he/collection/women"`), so the regex is stale, not the
  markup. Both the assertion and those classes predate this branch's work
  (present at `74e62d9f`). Loosen the regex to `class="[^"]*faq-cta`.
- **Soft 404 on the catch-all** (`/he/<unknown>` returns 200). Deliberate and
  documented in `[...notFound]/page.tsx`: with two root layouts, a real
  `notFound()` boundary renders without `<html lang>`, header, footer or
  `globals.css`. Held out of the index with `robots: index:false`, which the audit
  confirmed is present. The real fix is consolidating the root layouts.
- **Unknown campaign slug returns 307, not 404.** By design - the campaign
  redirect behaviour the product owner asked to preserve.

### Still unverified - needs a Preview deployment with a real test account

Everything below is a guest path or a code path that cannot be driven locally.

1. Sign in, sign out, and refresh while signed in.
2. Favourites synchronisation between a guest session and an account on sign-in.
3. Profile completion (`ProfileCompletionGate`) for a real incomplete profile.
4. Admin detection (`isAdmin`, `adminCheckPending`) and `profileSyncedUid`.
5. Whether `/_vercel/*` survives middleware on Vercel's edge (finding 1).
6. The five Cardcom scenarios in §7.

### The two render-loop guards: are they both needed?

A/B on production builds, measured with `probe-nav.js` (clicks a product link, a
cart link and an `/about` link, asserting the URL changes):

| Guard 1 (memoised `published`) | Guard 2 (memoised element) | Navigation |
|---|---|---|
| off | off | **all three STALLED** |
| on | off | all three OK |
| off | on | all three OK |
| on | on (shipped) | all three OK |

So each guard is *individually sufficient*; neither is strictly necessary while
the other is in place. They are deliberate redundancy, not two halves of one fix -
and the "off/off" row is the proof that the diagnosis in §4c is correct.

**No unnecessary updates.** An instrumented build counted publishes against
`AuthProvider` renders:

```
guest home, 20s idle      : 3 AuthProvider renders -> 2 publishes
guest collection, 20s     : 4 AuthProvider renders -> 2 publishes
/he/signin (auth route)   : 4 AuthProvider renders -> 2 publishes
```

Both publishes are real transitions - `loading: true` then `loading: false` - which
is the same sequence consumers saw when the shell was swapped. The extra renders
are absorbed by the memo.

**No stale values.** `signInStable=true` on the second publish confirms the method
identities hold across publishes, and the delegates read `latest.current`, which is
reassigned on every render, so a call always reaches the current implementation.
Skipping a publish can therefore never strand a consumer on an old `signIn`,
`signUp` or `logout`.

---

## 9. `ProductCard.tsx` and the conditional hooks

ESLint is right; this is not a configuration artifact. `ProductCard.tsx:132` is an
early `return` for `!activeVariant`, and **eight hooks sit below it**: `useMemo`
at 194, 206, 215 and 221, `useProductCouponBadge` at 219, and `useCallback` at
297, 309 and 346.

If one mounted instance ever renders once with `activeVariant` null and once
without, React throws *"Rendered more hooks than during the previous render"* and
the error boundary takes out the grid - a blank content area, the exact failure
class the rest of this document exists to prevent.

**Why it does not fire today.** `activeVariant = selectedVariant || defaultVariant`:

- `selectedVariant` starts null and is only set by `handleVariantSelect`, which is
  unreachable from the placeholder branch (it renders no swatches). It can
  therefore only go null to set while `activeVariant` was already non-null.
- `defaultVariant` falls back to `activeVariants[0]`, so a `selectedColors` or
  `preselectedColorSlug` change cannot make it null.
- That leaves one path: the *same* mounted instance receiving a different
  `product` across the null boundary. Every call site keys by product identity -
  `variantKey` (CollectionClient, CampaignClient), `product.id ?? sku`
  (CollectionClient, ProductCarousel), `product.id` (SearchBar), `favoriteKey`
  (profile favourites) - so a different product gets a different key, a fresh
  instance, and a fresh hook list.

So it is latent, not live. It becomes live the moment someone keys a product list
by array index - the usual reflex when React warns about duplicate keys - or live
product data flips a variant's `isActive` mid-session.

**The safe correction, and why the obvious one is wrong.** Do *not* simply move
the early return below the hooks: lines 172-191 (`currentPrice`, `originalPrice`,
`salePercent`, `favoriteKey`, `primaryImage`) dereference `activeVariant`
unconditionally, and `statusBadge` at 221 closes over `hasSalePrice()` and
`salePercent`, so hoisting the return past them turns a latent crash into a
guaranteed null dereference.

Split the component instead:

- `ProductCard` - resolves `activeVariant`, then returns either the placeholder or
  `<ProductCardInner variant={activeVariant} ... />`. It calls no hooks that depend
  on a variant.
- `ProductCardInner` - takes a non-null variant as a prop and holds every hook and
  derived value. Hooks are then unconditional by construction, and the placeholder
  stops being a sibling branch of a hook list.

This is a refactor of a component on the storefront's hottest path, so it wants
its own change and its own verification pass, not a drive-by edit.

---

## 10. Final cleanup (2026-10-08)

The four §8 findings that were agreed as pre-production work. The larger LCP
items (collection hydration, homepage video poster) are deliberately deferred to
a separate performance task.

### 10.1 Middleware no longer locale-prefixes `/_vercel/*`

`middleware.ts` now has a dedicated guard above the locale rule. It is two
branches, not one, and both matter:

```ts
if (pathname.startsWith('/_vercel')) {
  return process.env.VERCEL
    ? NextResponse.next()                        // platform owns these paths
    : new NextResponse(null, { status: 404 })    // nothing serves them locally
}
```

Passing through is the right answer **on** Vercel, where the platform serves the
Analytics and Speed Insights scripts. It is the wrong answer off Vercel, and this
was only caught by measuring after the first attempt: with the 308 removed,
`[lng]` happily matched `_vercel` as a locale, the request fell into
`[lng]/[...notFound]`, and the browser got a **200 text/html** page for a `.js`
URL - the same `Unexpected token '<'`, reached by a different route. A real 404
is the honest answer and keeps the console clean. Same shape as the `/socket.io`
guard directly below it.

Verified:

```
/_vercel/insights/script.js        404, 0 bytes   (was 308 -> 200 text/html)
/_vercel/speed-insights/script.js  404, 0 bytes
/_vercel/insights/view             404, 0 bytes
script requests answered with text/html:  0   (clean profile, cache cleared)
console exceptions on /he:                0   (desktop and mobile)
```

Locale routing is unchanged - this was the explicit regression risk:

| path | status | location |
|---|---|---|
| `/` | 308 | `/he` |
| `/collection/women/shoes` | 308 | `/he/collection/women/shoes` |
| `/he`, `/he/collection/women/shoes`, `/he/news` | 200 | - |
| `/Success`, `/admin` (unlocalized routes) | 200 | - |
| `/sitemap.xml`, `/robots.txt`, `/api/products/search`, `/_next/...` | 200 | - |

**Carry this to production:** the old redirect was a **308 Permanent**, which
Chrome caches. A browser that has already loaded a storefront page will keep
resolving `/_vercel/insights/script.js` to `/he/_vercel/insights/script.js` from
its own HTTP cache after the fix ships, until that entry is evicted. This is
exactly what produced the two residual mobile errors mid-verification, and they
vanished on a cache-cleared profile. Nothing in the app can clear a third party's
cache, so expect a tail of affected returning visitors rather than an instant
fix, and do not read early post-deploy console noise as the fix having failed.

### 10.2 The homepage has an `<h1>`

The design opens on a full-bleed video whose campaign copy is baked into the MP4,
so there is no text node to promote - the page shipped with no `<h1>` and opened
its heading outline on an h2. `homeHeadings` in `[lng]/page.tsx` supplies an
`sr-only` h1, first in document order, naming the page rather than the campaign
(the hero's own `aria-label` names one season and would go stale). Same trade-off
the blog index already makes.

```
/he  h1 count=1  "סכו עור – נעלי נשים, תיקים ואקססוריז מעור"       sr-only
/en  h1 count=1  "SAKO OR – women’s leather shoes, bags and accessories"  sr-only
```

Every audited route now reports exactly one `<h1>`, in SSR and after hydration,
on both viewports. The visible layout is untouched.

### 10.3 Campaign pages canonicalise

Campaign was the one listing route that hand-rolled its `Metadata` and therefore
had no canonical at all, while being `force-dynamic` over filter/sort/page
`searchParams` - an unbounded space of indexable duplicates. It now goes through
`buildMetadata`, keeping only `?page=` exactly as the collection route does:

| URL | canonical |
|---|---|
| `…/new-collection` | `…/new-collection` |
| `?page=2` | `…/new-collection?page=2` |
| `?page=abc`, `?page=0` | `…/new-collection` |
| `?sort=price-asc` | `…/new-collection` |
| `?colors=black&sizes=38` | `…/new-collection` |
| `?sort=newest&colors=black&page=3` | `…/new-collection?page=3` |
| `?utm_source=fb` | `…/new-collection` |

hreflang (`en`, `he`, `x-default`) is now emitted too, the `en` page
self-canonicalises, and an unknown slug still answers **307** by design. The
collection route's own canonical is unchanged (`?sort=price-asc` still
canonicalises to the clean path).

**One intentional title change.** `buildMetadata` appends `| SAKO-OR` unless the
title already contains that exact string. The old hand-rolled metadata wrote
`| SAKO OR` - space, no hyphen - which does not match that test, so passing it
through produced a doubled `קולקציה חדשה | SAKO OR – עמוד 2 | SAKO-OR`. The brand
suffix is now left to `buildMetadata`, which also settles campaign onto the
hyphenated brand every other route already uses:

```
before:  קולקציה חדשה | SAKO OR
after:   קולקציה חדשה | SAKO-OR
page 2:  קולקציה חדשה – עמוד 2 | SAKO-OR
```

### 10.4 `ProductCard` / `ProductCardInner` split

The eight rules-of-hooks errors are gone (§9 has the full reasoning). `ProductCard`
now resolves the variant, calls exactly one hook, and returns either the
placeholder or `<ProductCardInner>`; `ProductCardInner` takes a non-null variant
and owns every other hook, unconditionally.

Two details worth keeping:

- **`selectedVariant` stays in the outer component**, above the gate, so the
  condition remains byte-identical to the original `selectedVariant ||
  defaultVariant`. Moving it inward would have changed behaviour in one edge
  case: a product whose variants all go inactive while the shopper has a swatch
  selected used to keep rendering their choice, and would instead have dropped to
  the placeholder.
- **`ProductCardVariant`** spells out the union the component always actually
  held: the inline shape on `Product.colorVariants`, or the standalone
  `ColorVariant`. Narrowing it to `ColorVariant` does not compile, because that is
  not what product documents contain - the mismatch had been hidden by
  `handleVariantSelect(variant: any)`, which was writing the inline shape into
  state declared as `ColorVariant`. The state is now typed as what it holds.

Behaviour verified on both viewports, 12/12 each:

```
cards render                    24 desktop / 12 mobile, all with text
no placeholder cards leaked     0
prices render                   24 / 12
status badges render            ["NEW","Last Call","NEW",…]
swatch changes aria-pressed     2 -> 0
swatch changes product href     /he/product/5129-6188/black -> …/beige
favourites toggle persists      ["5104-0021::black"]
favourites aria-label flips     "הוסף לרשימת המשאלות" -> "הסר מרשימת המשאלות"
quick buy opens a drawer        1 dialog
card navigates to the PDP       collection -> /he/product/5104-0021/black
homepage carousel renders       13 product links
no unexpected console errors    0
tap -> pending feedback         median 96ms, 1 card, 0 stranded
```

### 10.5 Full regression after all four

| Suite | Result |
|---|---|
| Journeys J1-J8, desktop 1440 | **no findings**; 0 remounts, 0 EMPTY, 0 skeleton returns, err=0 |
| Journeys J1-J8, mobile 390 | **no findings**; same |
| Session-cumulative CLS, both viewports | **0.0000** |
| Collection to Collection x30 | **0 abnormal frames** |
| Direct + refresh, 13 routes x 2 viewports | 0 remounts; h1=1 everywhere; CLS 0.0000 except cart (see below) |
| Option C regression | remounts=0 everywhere; favourites/cart/checkout state intact |
| Favourites dedicated probe | 0 skeleton re-appearances |
| Navigation sanity (product/cart/about) | all OK |
| SSR/SEO/status/structured data | campaign canonical present; all status codes as designed |
| Playwright | **18/18** |
| Unit tests | 531/532 (the pre-existing stale FAQ regex, §8) |
| Build / TypeScript | clean / clean |
| ESLint | **0** link-rule findings; errors **9 -> 1** |

The one remaining ESLint error is the pre-existing `prefer-const` at
`CheckoutModal.tsx:404`, left alone to keep this change set isolated.

### 10.6 Cart CLS: measured, pre-existing, not from this work

The cart page carries a single deterministic layout shift - **0.0063 desktop,
0.0355 mobile** - in the order-summary column (`ASIDE.bg-sako-gray-400` on
mobile; the summary `SECTION` plus the checkout CTA on desktop). A `<p>` moves
down ~24-30px and the CTA rises ~38px as the panel settles.

It is **not** a regression from this cleanup. A/B against a build of HEAD with all
four fixes stashed, identical methodology and seeded cart:

| | with fixes | baseline (no fixes) |
|---|---|---|
| desktop | 0.00626, 1 shift, same sources | 0.00626, 1 shift, same sources |
| mobile | 0.03546, 1 shift, same geometry | 0.03546, 1 shift, same geometry |

Worth noting that an earlier §8 run recorded cart CLS as 0.0000 - that reading
came from a different cart state, not from a build without the shift. Both values
are still inside the "good" CWV band, and the mobile one is the largest shift
left anywhere on the storefront, so it is the natural first candidate for the
deferred performance task.

### What still requires manual Preview testing

Nothing below can be exercised locally. Each needs a Preview deployment and, where
noted, a real test account.

**Authentication (real test account required)**

1. Sign in, sign out, and refresh while signed in.
2. Favourites synchronisation between a guest session and an account at sign-in.
3. Profile completion (`ProfileCompletionGate`) for a genuinely incomplete profile.
4. Admin detection (`isAdmin`, `adminCheckPending`) and `profileSyncedUid`.
5. That the page subtree still does not remount once a *real* user is signed in -
   the local runs only ever exercise the guest value.

**Vercel platform behaviour**

6. That `/_vercel/insights/script.js` and `/_vercel/speed-insights/script.js`
   return JavaScript on the deployment, i.e. that the platform serves them ahead
   of middleware and §10.1's `next()` branch is reached. Check the Network panel
   for a `200 application/javascript`, and confirm pageviews arrive in the Vercel
   Analytics dashboard. This is the one §10 fix whose production half is
   unverified, because the preview share token has expired.
7. Whether returning visitors still hit the cached 308 (§10.1). Compare a normal
   profile against a hard-reload / cleared-cache profile.

**SEO, once a Preview URL exists**

8. That campaign canonicals render with the production origin rather than
   `localhost:3000` - locally `metadataBase` has no site URL to resolve against,
   so only the path portion is meaningful in the §10.3 table.
9. Rich Results / URL Inspection on a campaign page, a PDP and an article.

**Payments**

10. The five Cardcom scenarios in §7, against sandbox credentials.
