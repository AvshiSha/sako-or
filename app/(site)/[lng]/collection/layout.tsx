/**
 * A floor under the listing routes - the collection listing and the campaign
 * listing, and nothing else.
 *
 * This is a safety net, not a fix. Every state these two routes are *supposed*
 * to be in already stands taller than this on its own: CollectionClient's root,
 * CollectionListingSkeleton's root and the campaign layout's wrapper all carry
 * min-h-screen, and both routes now have a loading.tsx, so a suspended segment
 * always has a fallback to show. The floor exists for the state none of those
 * cover - a segment that renders nothing at all - where the footer would
 * otherwise come to rest directly under the header with no content between them.
 * One such report (v5 preview, 2026-10-07, mobile) is still unexplained after
 * ~115 instrumented loads across cold, reload, client-nav, back/forward and
 * prefetch-warmed paths at four throttling profiles, none of which reproduced
 * it. Rather than leave the invariant resting on a cause I could not find, it is
 * enforced here structurally.
 *
 * Deliberately NOT on <main> in the locale layout. The rule the listings need -
 * the content area never collapses - is wrong for a short policy page or a
 * confirmation screen, which would gain a screenful of blank ground above the
 * footer for no reason.
 *
 * 60svh, not vh: iOS Safari's vh is the *large* viewport, measured with the
 * toolbars retracted, so a vh floor overshoots by the toolbar's height on exactly
 * the device the report came from.
 *
 * A bare block wrapper on purpose - no padding, no background, no positioning.
 * Both listings run full-bleed and draw their own ground; anything else here
 * would show through.
 *
 * It must never be load-bearing. If this floor is ever what is holding a listing
 * open, something above it has stopped rendering and that is the bug to fix.
 *
 * `data-collection-shell` is how CollectionCollapseProbe finds this element. It has
 * to measure what this wrapper CONTAINS rather than the wrapper itself, because the
 * floor would otherwise report a healthy height over an empty segment and hide the
 * very thing the probe exists to catch.
 */
export default function CollectionSegmentLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-[60svh]" data-collection-shell>
      {children}
    </div>
  )
}
