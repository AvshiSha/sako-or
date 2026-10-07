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

## 5. Remaining audit findings

Priority order agreed with the product owner. Each line records the measurement
that justifies it.

### Next up

- [ ] **Checkout** — its Suspense fallback is a blank `min-h-screen` box
      (`checkout/page.tsx`). Reserves height, communicates nothing, on the
      highest-intent page we have. Wants a checkout-shaped skeleton like
      `CartSkeleton`. *Low risk.*
- [ ] **Homepage** — `HomeProductsFallback` reserves **420px** against **1833px**
      of real below-hero content. Measured CLS stays near zero only because the
      shift is below the fold; the footer still travels 1413px. Also `aria-hidden`
      with no `role="status"`, so it is not announced. *Low risk.*
- [ ] **Blog article** `/news/[slug]` — blocks the first byte (0.84s local /
      1.04s deployed warm) with no loading state, and
      `fetchRelatedProductsForArticle` (a below-the-fold carousel) sits on the
      critical path after the article fetch. Article above the boundary, related
      products behind it. *Low risk.*
- [ ] **Profile** — nine hand-rolled `animate-spin` divs across `profile/page`,
      `/orders`, `/personal`, `/points`, `/favorites`, `ProfileLayoutClient`,
      `OrderHistory`, `ProfilePointsBlock`. No dimension reservation; 6.4s to
      content measured. Wants one `ProfilePaneSkeleton`. *Low-medium risk, many
      files.*
- [ ] **Blog index** `/news` and **soft 404** `/[lng]/[...notFound]` — both block
      the first byte with no loading state (0.27s and ~1.8s to content). *Very
      low risk.*

### Done

- [x] **Collection / Campaign** — the reference implementation; see §1–§3.
- [x] **PDP** — `loading.tsx` + `ProductPageSkeleton` for cold loads (skeleton in
      the first flush, CLS 0.0000, mobile reservation within 45px / gallery exact),
      `notFound()` hoisted into the layout so both 404s survive, and `ProductLink`
      for prefetch safety and the tap acknowledgement in §4.

### Looked at, deliberately left alone

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
