/**
 * The listing's loading chrome, shared by the collection page (438:2962) and the
 * campaign page.
 *
 * Every loading state on both listings is built from these three pieces, so a
 * change to the real layout has one place to follow rather than six. Before this
 * file there were four hand-copied skeleton grids - two route fallbacks and two
 * filter-pending branches - and the two route fallbacks had drifted furthest:
 * they reserved the grid but not the <h1> or the filter bar above it, so the
 * whole listing stepped down ~110px (mobile) / ~140px (desktop) the moment the
 * real page streamed in.
 *
 * Deliberately not a client component. loading.tsx is a server boundary, and the
 * two clients import it as well - a plain component works in both.
 */

import CollectionProductCardSkeleton from '@/app/components/CollectionProductCardSkeleton'
import { cn } from '@/lib/utils'

import {
  COLLECTION_BAR,
  COLLECTION_INSET,
  COLLECTION_LISTING_PAGE_SIZE,
  COLLECTION_PRODUCT_GRID,
} from './collectionChrome'

/**
 * A block of placeholder cards in the real grid.
 *
 * The wrapper <div> around each card is load-bearing and not a stray: the grid's
 * critical CSS reserves row height with `.collection-product-grid > *`, and the
 * real cards are wrapped the same way (`[data-collection-anchor]`). Dropping it
 * would make the skeleton's own root the grid child and reserve a different box
 * than the thing it is standing in for.
 */
export function CollectionGridSkeleton({
  count = COLLECTION_LISTING_PAGE_SIZE,
  keyPrefix = 'skeleton',
  className,
}: {
  count?: number
  keyPrefix?: string
  className?: string
}) {
  if (count <= 0) return null

  return (
    <div className={cn(COLLECTION_PRODUCT_GRID, className)} aria-hidden>
      {Array.from({ length: count }).map((_, index) => (
        <div key={`${keyPrefix}-${index}`}>
          <CollectionProductCardSkeleton />
        </div>
      ))}
    </div>
  )
}

/**
 * Title + filter/sort bar + the "showing X of Y" line, at the exact heights the
 * loaded page gives them.
 *
 * The bar needs no placeholder content to hold its ground - COLLECTION_BAR is
 * h-[58px] lg:h-[74px] - but it gets two faint label blocks anyway so the
 * skeleton reads as the same furniture rather than an empty rule. The title block
 * is h-[32px] lg:h-[48px] because the real <h1> sets leading-[32px]
 * lg:leading-[48px] and is one line at every width we ship.
 */
function CollectionListingHeaderSkeleton() {
  return (
    <div className="mb-4">
      <div className={cn('mb-4', COLLECTION_INSET)}>
        <div
          className="sako-skeleton mx-auto h-[32px] w-[min(280px,70%)] lg:h-[48px] lg:w-[min(460px,55%)]"
          aria-hidden
        />
      </div>

      <div className={COLLECTION_BAR}>
        <div className="sako-skeleton h-[12px] w-[72px]" aria-hidden />
        <div className="sako-skeleton h-[12px] w-[56px]" aria-hidden />
      </div>
    </div>
  )
}

/**
 * The listing fallback: everything from the title down.
 *
 * Deliberately no hero. The campaign banner is not in here and must not be - a
 * fallback cannot know whether a given campaign has one (the two in the database
 * disagree), so reserving it would be a coin flip between dropping the listing
 * 713px and lifting it by the same amount. The hero is rendered outside the
 * boundary instead, by page.tsx, from data it already holds. See CampaignHero.
 */
export default function CollectionListingSkeleton({
  label,
  count = COLLECTION_LISTING_PAGE_SIZE,
  fullHeight = true,
}: {
  label: string
  count?: number
  /**
   * False when the fallback is nested inside a page that already carries the
   * full-height ground - the campaign's inner <Suspense>, which sits under a
   * hero inside page.tsx's own min-h-screen wrapper. Keeping min-h-screen there
   * would reserve a viewport's worth below the hero that a short campaign never
   * fills, and give the swap a shrink to shift on.
   */
  fullHeight?: boolean
}) {
  return (
    // role="status" so the label is actually announced. aria-busy and aria-label
    // on a bare <div> give a screen reader nothing to read - the element has no
    // role, so there is no object for the name to belong to.
    <div
      className={cn('bg-white', fullHeight && 'min-h-screen')}
      role="status"
      aria-busy="true"
      aria-label={label}
    >
      {/* Mirrors the clients' shell exactly - full-bleed, with the inset carried
          by the blocks that are not the grid. If this container keeps a max-width
          the grid paints narrow and then jumps wide when the page streams in,
          which is the shift this file exists to prevent. */}
      <div className="w-full pt-8 pb-6 md:pb-16">
        <CollectionListingHeaderSkeleton />

        {/* The loaded page keeps this row at min-h-[20px] even when it has nothing
            to say, so the skeleton has to hold it too. */}
        <div className={cn('mb-4 min-h-[20px]', COLLECTION_INSET)} aria-hidden />

        <div className="w-full">
          <CollectionGridSkeleton count={count} keyPrefix="route-skeleton" />
        </div>
      </div>
    </div>
  )
}
