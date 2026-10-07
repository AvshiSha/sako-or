'use client'

import Link, { useLinkStatus } from 'next/link'
import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

/**
 * The link component for every href pointing at /[lng]/product/... - the sibling
 * of ListingLink. It does two things, and both of them are load-bearing.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 *  1. DO NOT REPLACE THIS WITH next/link, AND DO NOT REMOVE prefetch={false}.
 *
 *  `prefetch={false}` is a BUG FIX, not a performance setting.
 * ──────────────────────────────────────────────────────────────────────────────
 *
 * The product page has a loading.tsx, which makes it a dynamic route *with* a
 * loading boundary - the exact shape that produced the intermittent "header,
 * nothing, footer" bug on the listings. The router renders a segment's
 * `prefetchRsc` in preference to suspending
 * (`useDeferredValue(cacheNode.rsc, resolvedPrefetchRsc)` in InnerLayoutRouter),
 * and for a dynamic route whose prefetch was fetched under a router state tree
 * that has since moved on, that payload carries neither the page nor the loading
 * boundary. The segment renders nothing and the skeleton never gets its turn.
 * Measured on the listings: 4 empty transitions in 66 before, 0 after.
 *
 * `prefetch={false}` gates the viewport, hover and touchstart paths in Next 16
 * (the `prefetchEnabled` guards in next/dist/client/app-dir/link.js), so the cache
 * node is never populated and there is nothing for the router to prefer. It costs
 * nothing: the PDP is dynamic, so a prefetch only ever fetched the shell.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 *  2. The pending state is why this is a component and not a one-line wrapper.
 * ──────────────────────────────────────────────────────────────────────────────
 *
 * loading.tsx cannot acknowledge a tap here. A route fallback only gets a frame
 * when the page is meaningfully slower than its own layout, because the boundary
 * lives inside the layout - and on this route both are gated on the same cached
 * product read, so the content wins the race every time. Measured on client-side
 * navigation at 4x CPU / 400ms latency:
 *
 *   Collection -> Collection   skeleton at  708ms   (page far slower than layout)
 *   Home       -> Campaign     skeleton at 1269ms   (same)
 *   Collection -> PDP          skeleton NEVER       (~110ms apart; content wins)
 *
 * So the acknowledgement moves to the link. `useLinkStatus()` is per-Link-instance
 * - it reads a context that each Link provides for itself - so only the card that
 * was actually tapped responds, even when several cards point at the same product.
 * It is backed by `useOptimistic`, so the state unwinds on its own when the
 * navigation commits, is interrupted by a second tap, or is abandoned via
 * back/forward. There is nothing to reset and no way to strand a card mid-state.
 *
 * The treatment is a scrim plus a 2px sheened rule, both absolutely positioned,
 * so the collection stays exactly where it is - no blanking, no spinner, no
 * layout shift. See the .sako-link-pending-* rules in globals.css.
 *
 * loading.tsx stays regardless: it is still what covers a cold or direct load of a
 * PDP, where there is no card to put a pending state on.
 *
 * See ListingLink for the listing-route equivalent, LOADING_ARCHITECTURE.md for
 * the whole picture, and eslint.config.mjs for the rule that keeps both honest.
 */

/** he for /he/..., otherwise en. The hrefs are always locale-prefixed. */
function localeFromHref(href: ComponentProps<typeof Link>['href']): 'en' | 'he' {
  const value = typeof href === 'string' ? href : (href?.pathname ?? '')
  return value.startsWith('/he/') || value === '/he' ? 'he' : 'en'
}

const PENDING_LABEL = {
  he: 'פותח את עמוד המוצר',
  en: 'Opening product page',
} as const

/**
 * Lives inside the Link because useLinkStatus() reads the context that Link
 * provides. Rendering null while idle keeps a card that was never tapped exactly
 * as it was - no extra boxes, no extra paint.
 */
function ProductLinkPendingState({ locale }: { locale: 'en' | 'he' }) {
  const { pending } = useLinkStatus()

  if (!pending) return null

  return (
    <>
      {/* The wash. inset-0 over the link's own box, pointer-events-none so the
          tap that started this still belongs to the anchor. */}
      <span
        className="sako-link-pending-scrim pointer-events-none absolute inset-0 z-20"
        aria-hidden="true"
      />
      {/* The rule. 2px on the inline-start edge upward is wrong in RTL, so it
          runs the full width along the bottom, which reads the same either way. */}
      <span
        className="sako-link-pending-bar pointer-events-none absolute inset-x-0 bottom-0 z-20 h-[2px]"
        aria-hidden="true"
      />
      {/* The spoken half. role="status" announces politely once; the visual half
          is aria-hidden so a screen reader hears this and not two empty spans. */}
      <span className="sr-only" role="status">
        {PENDING_LABEL[locale]}
      </span>
    </>
  )
}

export default function ProductLink({
  children,
  className,
  href,
  ...props
}: ComponentProps<typeof Link>) {
  const locale = localeFromHref(href)

  return (
    <Link
      {...props}
      href={href}
      prefetch={false}
      // The pending pieces are absolutely positioned against this box. Every
      // current call site that contains absolutely positioned children is already
      // relative, so this re-anchors nothing; cn() collapses the duplicate.
      className={cn('relative', className)}
    >
      <ProductLinkPendingState locale={locale} />
      {children}
    </Link>
  )
}
