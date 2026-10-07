'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import * as Sentry from '@sentry/nextjs'

/**
 * Reports the one state the listings must never be in: the route committed, the
 * footer is laid out, and the content area holds neither the previous listing, nor
 * the skeleton, nor the new one.
 *
 * It exists because the min-height floor in collection/layout.tsx would otherwise
 * hide exactly that. The floor keeps the footer off the header's heel; it does not
 * make the segment render, and a silent floor is worse than a visible collapse.
 *
 * Known cause, fixed in ListingLink: a <Link> into a listing whose prefetch landed
 * mid-navigation made the router render the segment's prefetchRsc - which for a
 * dynamic route under a stale state tree carries no page and no loading boundary -
 * instead of suspending to loading.tsx. This stays armed because that was found by
 * reproducing it locally, and a report from a real device is the only thing that
 * can tell us whether some other path still reaches the same state.
 *
 * Mounted in the locale layout rather than in collection/layout.tsx on purpose: a
 * probe inside the listing segment cannot observe the segment failing to render.
 * It is inert on every other route.
 */

/** Below this, with a footer already on screen, the listing has nothing in it. */
const COLLAPSE_THRESHOLD_PX = 120

/**
 * Two samples per route change. The reproduced window opened ~420ms after the
 * click and stayed for ~2.5s, so these bracket it; a healthy transition shows the
 * skeleton within ~60ms and never trips either one.
 */
const SAMPLE_DELAYS_MS = [700, 2000]

/** One report per URL per document, and a hard ceiling per document. */
const MAX_REPORTS_PER_DOCUMENT = 3

function isListingPath(pathname: string): boolean {
  return /\/collection(\/|$)/.test(pathname) && !/\/product\//.test(pathname)
}

export default function CollectionCollapseProbe() {
  const pathname = usePathname()
  const reportedRef = useRef<Set<string>>(new Set())
  const transitionsRef = useRef(0)
  const previousPathRef = useRef<string | null>(null)
  const enteredAtRef = useRef(0)

  useEffect(() => {
    if (!pathname || !isListingPath(pathname)) {
      previousPathRef.current = pathname ?? null
      return
    }

    transitionsRef.current += 1
    enteredAtRef.current = Date.now()
    const cameFrom = previousPathRef.current
    previousPathRef.current = pathname

    const sample = (afterMs: number) => {
      // A backgrounded tab throttles timers and can report stale geometry.
      if (document.visibilityState !== 'visible') return
      if (reportedRef.current.size >= MAX_REPORTS_PER_DOCUMENT) return

      const shell = document.querySelector<HTMLElement>('[data-collection-shell]')
      const main = document.querySelector('main')
      const footer = document.querySelector('footer')
      // No footer yet means the document is still streaming, which is not a collapse.
      if (!main || !footer) return

      // Measure what the floor CONTAINS, never the floor itself.
      const target = shell ?? main
      const contentHeight = Array.from(target.children).reduce(
        (tallest, child) =>
          Math.max(tallest, (child as HTMLElement).getBoundingClientRect().height),
        0
      )
      const hasContent =
        target.childElementCount > 0 && contentHeight >= COLLAPSE_THRESHOLD_PX
      if (hasContent) return

      const key = `${window.location.pathname}${window.location.search}`
      if (reportedRef.current.has(key)) return
      reportedRef.current.add(key)

      const nav = performance.getEntriesByType('navigation')[0] as
        | PerformanceNavigationTiming
        | undefined

      Sentry.captureMessage('Collection listing rendered an empty content area', {
        level: 'error',
        tags: {
          area: 'collection-listing',
          collapse: 'empty-content-area',
          sampled_after_ms: String(afterMs),
        },
        extra: {
          pathname: window.location.pathname,
          search: window.location.search,
          cameFrom,
          // "once every few transitions" - this is the number that tests it.
          transitionsInDocument: transitionsRef.current,
          msSinceRouteChange: Date.now() - enteredAtRef.current,
          documentNavigationType: nav?.type ?? 'unknown',
          readyState: document.readyState,
          // What is actually in the box.
          shellPresent: Boolean(shell),
          shellChildCount: target.childElementCount,
          contentHeight: Math.round(contentHeight),
          mainHeight: Math.round(main.getBoundingClientRect().height),
          mainChildCount: main.children.length,
          footerTop: Math.round(footer.getBoundingClientRect().top),
          // Which of the three expected renderings is missing.
          hasHeading: Boolean(main.querySelector('h1')),
          hasRouteSkeleton: Boolean(main.querySelector('[aria-label^="Loading"]')),
          skeletonCardCount: main.querySelectorAll('.sako-skeleton').length,
          productCardCount: main.querySelectorAll('[data-collection-anchor]').length,
          // Our own markup, truncated - no user content reaches this.
          mainHtmlHead: main.innerHTML.slice(0, 300),
          viewport: `${window.innerWidth}x${window.innerHeight}`,
          scrollY: Math.round(window.scrollY),
          effectiveType:
            (navigator as Navigator & { connection?: { effectiveType?: string } })
              .connection?.effectiveType ?? 'unknown',
        },
      })
    }

    const timers = SAMPLE_DELAYS_MS.map((delay) =>
      window.setTimeout(() => sample(delay), delay)
    )
    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [pathname])

  return null
}
