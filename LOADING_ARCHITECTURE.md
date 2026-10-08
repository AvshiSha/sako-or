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
