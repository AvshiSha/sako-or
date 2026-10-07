import { cn } from '@/lib/utils'

import {
  PDP_ACTION_ROW,
  PDP_CTA_H,
  PDP_DESKTOP_GALLERY_GRID,
  PDP_GALLERY_ASPECT,
  PDP_GALLERY_COL,
  PDP_GRID,
  PDP_INFO_COL,
  PDP_INFO_HEAD,
  PDP_PRICE_H,
  PDP_SIZE_TILE_H,
  PDP_SKELETON_DESKTOP_TILES,
  PDP_SUBLINE_H,
  PDP_SWATCH,
  PDP_SWATCH_ROW,
  PDP_TITLE_H,
} from './productPageChrome'

/**
 * The product page's route fallback.
 *
 * Built from the PDP's own structure rather than from the collection skeleton:
 * gallery, then title, sub-line, price, colour swatches, size grid, the two
 * disclosure rows, the add-to-cart CTA and the share/favourite row - in that
 * order, at the real measured heights. A shopper who taps a product card should
 * see the product page arriving, not a grid of cards they just left.
 *
 * It takes its classes from productPageChrome, which ProductColorClient also
 * uses, so the two cannot drift apart. That sharing is the whole mechanism - it
 * is what got the collection grid to half a pixel.
 *
 * Deliberately not a client component: loading.tsx is a server boundary, and
 * nothing here needs state.
 */

/** One square tile, for the desktop gallery grid. */
function GalleryTile({ index }: { index: number }) {
  return (
    <div
      key={`pdp-tile-${index}`}
      className={cn('sako-skeleton', PDP_GALLERY_ASPECT)}
      aria-hidden
    />
  )
}

export default function ProductPageSkeleton({
  label = 'Loading product',
}: {
  label?: string
}) {
  return (
    // role="status" so the label is announced. aria-busy on a bare <div> gives a
    // screen reader nothing to attach the name to - the same fix the collection
    // skeleton carries.
    <div
      className="min-h-screen bg-surface-secondary"
      role="status"
      aria-busy="true"
      aria-label={label}
    >
      <div className={PDP_GRID}>
        <div className={PDP_GALLERY_COL}>
          {/* Mobile: one square, which is exactly what the carousel measures. */}
          <div
            className={cn('sako-skeleton w-full lg:hidden', PDP_GALLERY_ASPECT)}
            aria-hidden
          />
          {/* Desktop: two rows of two. Short on purpose - see the constant. */}
          <div className={PDP_DESKTOP_GALLERY_GRID}>
            {Array.from({ length: PDP_SKELETON_DESKTOP_TILES }).map((_, index) => (
              <GalleryTile key={`pdp-tile-${index}`} index={index} />
            ))}
          </div>
        </div>

        <div className={PDP_INFO_COL}>
          <div className={PDP_INFO_HEAD}>
            {/* Title, two lines - every product name sampled wrapped to two. */}
            <div className={cn('sako-skeleton w-[85%]', PDP_TITLE_H)} aria-hidden />
            {/* The keyword-led sub-line under the heading. */}
            <div
              className={cn('sako-skeleton sako-skeleton-muted w-[62%]', PDP_SUBLINE_H)}
              aria-hidden
            />
            {/* Price row. */}
            <div
              className={cn('sako-skeleton sako-skeleton-muted w-[38%]', PDP_PRICE_H)}
              aria-hidden
            />

            {/* Colour swatches. */}
            <div className={PDP_SWATCH_ROW}>
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={`pdp-swatch-${index}`}
                  className={cn(
                    'sako-skeleton sako-skeleton-muted shrink-0 rounded-full',
                    PDP_SWATCH
                  )}
                  aria-hidden
                />
              ))}
            </div>

            {/* Size grid. Four across is what the shoe grid runs at both widths. */}
            <div className="mt-[13px] grid grid-cols-4 gap-[6px]">
              {Array.from({ length: 8 }).map((_, index) => (
                <div
                  key={`pdp-size-${index}`}
                  className={cn('sako-skeleton sako-skeleton-muted', PDP_SIZE_TILE_H)}
                  aria-hidden
                />
              ))}
            </div>

            {/* The two disclosure rows (size guide, delivery), each a ruled line. */}
            {Array.from({ length: 2 }).map((_, index) => (
              <div
                key={`pdp-disclosure-${index}`}
                className="mt-[13px] flex items-center justify-between border-b border-border-default pb-[13px]"
              >
                <div
                  className="sako-skeleton sako-skeleton-muted h-[12px] w-[112px]"
                  aria-hidden
                />
                <div
                  className="sako-skeleton sako-skeleton-muted h-[12px] w-[12px]"
                  aria-hidden
                />
              </div>
            ))}
          </div>

          {/* Add to cart. */}
          <div className={cn('sako-skeleton w-full', PDP_CTA_H)} aria-hidden />

          {/* Share / favourite. */}
          <div className={PDP_ACTION_ROW}>
            <div
              className="sako-skeleton sako-skeleton-muted h-[38px] w-[38px]"
              aria-hidden
            />
            <div
              className="sako-skeleton sako-skeleton-muted h-[38px] w-[38px]"
              aria-hidden
            />
          </div>

          {/* The two ruled detail sections under the fold - product details and
              shipping. Measured at a constant 220px and 190px across every product
              sampled, unlike the blocks above them, so they are reserved outright
              rather than estimated. One pixel under each, keeping to the
              under-reserve rule. */}
          <div className="border-t border-border-subtle pt-[30px]">
            <div className="sako-skeleton sako-skeleton-muted h-[189px] w-full" aria-hidden />
          </div>
          <div className="border-t border-border-subtle">
            <div className="sako-skeleton sako-skeleton-muted h-[189px] w-full" aria-hidden />
          </div>
        </div>
      </div>
    </div>
  )
}
