'use client'

import Link from 'next/link'
import type { ComponentProps } from 'react'

/**
 * The link component for every href pointing at /[lng]/collection/... - the
 * collection listing and the campaign listing.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 *  DO NOT REPLACE THIS WITH next/link, AND DO NOT REMOVE prefetch={false}.
 *
 *  `prefetch={false}` is a BUG FIX, not a performance setting. It looks like an
 *  obvious thing to "optimise" away. It is not. Removing it brings back a visual
 *  defect that took a long investigation to find, and that is invisible in local
 *  development because it needs a slow network and several navigations in a row.
 * ──────────────────────────────────────────────────────────────────────────────
 *
 * WHAT BREAKS WITHOUT IT
 *
 * Navigating between two Collection pages, intermittently, the listing area
 * renders *nothing at all* - no previous listing, no loading skeleton, no new
 * listing - for two to three seconds, so the footer comes to rest directly under
 * the header. Reported from production on a phone; reproduced locally on the
 * production build 4 times in 66 menu-driven Collection -> Collection
 * navigations:
 *
 *     +   0ms  click
 *     + 422ms  <main> is EMPTY - just the collection layout's wrapper div
 *     +2923ms  the new listing finally appears
 *
 * WHY
 *
 * The 422ms mark lands 24ms after that link's own prefetch response arrives, and
 * every clean transition is one whose prefetch had already landed before the
 * click. Next's InnerLayoutRouter does:
 *
 *     const rsc = useDeferredValue(cacheNode.rsc, resolvedPrefetchRsc)
 *
 * so it renders the segment's `prefetchRsc` in preference to suspending. For a
 * dynamic route whose prefetch was fetched under a router state tree that has
 * since moved on, that payload carries neither page content nor the loading
 * boundary - so the segment renders nothing, and loading.tsx never gets its turn.
 * It only goes wrong when a previous client navigation has already populated the
 * router cache in the same document (a prefetch landing mid-navigation on a cold
 * cache suspends correctly), which is why it takes a few transitions to show up.
 *
 * With prefetching off there is no prefetchRsc for the router to prefer, so the
 * segment suspends and the loading boundary always wins. This is deterministic,
 * not a reduced probability: `prefetch={false}` gates the viewport, hover AND
 * touchstart paths in Next 16 - see the `prefetchEnabled` guards in
 * next/dist/client/app-dir/link.js - so the cache node is never populated at all.
 *
 * Measured on two harnesses, same build, same timings:
 *   before  4 / 66 transitions rendered an empty listing area
 *   after   0 / 66
 *
 * WHY IT COSTS NOTHING (the "but prefetching is faster" objection)
 *
 * Both listings are dynamic - `force-dynamic` on the campaign route, searchParams
 * on the collection route - so a prefetch never fetched any products. It fetched
 * the loading shell and nothing else. Navigation was never going to be instant,
 * and the only thing prefetching pre-warmed was a skeleton that we now render
 * reliably instead of occasionally. There is no measurable win to recover here.
 *
 * IF YOU WANT TO RE-VERIFY BEFORE CHANGING IT
 *
 * Build for production and serve it (the dev server will not show this). On a
 * throttled connection - ~700ms latency is enough - open the mobile menu, expand a
 * category, and click through eight or more different Collection pages in a single
 * page load, clicking ~150ms after the menu opens so each link is clicked while its
 * own prefetch is still in flight. Watch <main> every animation frame for a state
 * with no <h1>, no [aria-label^="Loading"], no .sako-skeleton and no
 * [data-collection-anchor]. If that state appears, prefetching is back on.
 *
 * RELATED
 *
 * app/(site)/[lng]/collection/layout.tsx  - the min-height floor, a safety net for
 *   this state, deliberately not the fix.
 * app/components/collection/CollectionCollapseProbe.tsx - reports the state to
 *   Sentry if it ever reaches a real device again.
 *
 * Any NEW link into a listing route must use this component. A plain next/link
 * there reintroduces the defect for that entry point only, which makes it even
 * harder to spot than it was the first time.
 */
export default function ListingLink(props: ComponentProps<typeof Link>) {
  return <Link {...props} prefetch={false} />
}
