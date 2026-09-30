/**
 * Chrome shared by the collection listing (438:2962) and the campaign listing.
 *
 * These constants and the caret used to live inside CollectionClient, which made
 * the collection page the only page that could have the design. The campaign page
 * is the same listing with a different product source, so it draws its shell from
 * here rather than from a second copy that drifts.
 */

import type { ColumnBreakpoint } from '@/lib/useResponsiveColumnCount'

/**
 * Horizontal inset for the listing blocks that are not full-bleed. 36px at
 * desktop is the frame's own gutter (438:2975 sets px-36.288); the filter bar and
 * the product grid deliberately do not use it, because 438:2962 runs both to the
 * viewport edge.
 */
export const COLLECTION_INSET = 'px-4 sm:px-6 lg:px-[36px]'

/**
 * Shared chrome for the two controls in the 438:2977 filter/sort bar.
 *
 * The caret trails the label, so in Hebrew it sits to the label's left exactly as
 * 438:2978 draws it. This is one place where the frame's coordinates are meant
 * literally rather than mirrored - see the bar itself, which keeps the frame's
 * sides too.
 *
 * 10px gap: the frame positions caret and label absolutely, 9.6px apart on the
 * sort control and ~12px on the filter one.
 */
export const COLLECTION_BAR_CONTROL =
  'inline-flex items-center gap-[10px] font-ploni text-[12px] text-text-primary transition-opacity hover:opacity-70'

/**
 * The ruled filter/sort band the grid sits under (438:2975 + 438:2977). Runs
 * edge to edge like the grid, so it carries its own padding rather than the
 * page inset.
 */
export const COLLECTION_BAR =
  'flex h-[58px] items-center justify-between border-y border-border-default bg-surface-secondary px-[16px] lg:h-[74px] lg:px-[36px]'

/**
 * The product grid itself. gap-0 is load-bearing: the cards draw their own
 * divisions (border-l on the card root, border-t on the info block), so any
 * gutter here reappears as a white hairline between them. The class name is
 * also the hook for the critical CSS in lib/collection-grid-critical-css.ts,
 * which reserves row height before Tailwind paints.
 */
export const COLLECTION_PRODUCT_GRID =
  'collection-product-grid grid grid-cols-2 items-start gap-0 lg:grid-cols-4'

/**
 * Mirrors COLLECTION_PRODUCT_GRID's grid-cols-2 lg:grid-cols-4 breakpoint
 * (lib/collection-grid-critical-css.ts uses the same 1024px cutoff). 438:2984
 * lays the desktop grid four across; this drives row-height estimation, so it has
 * to move with the CSS or the virtualiser reserves the wrong height.
 */
export const COLLECTION_GRID_BREAKPOINTS: ColumnBreakpoint[] = [
  { minWidthPx: 0, columns: 2 },
  { minWidthPx: 1024, columns: 4 },
]

/**
 * Same 8.75rem (140px) reserved below the aspect-square image as the critical
 * CSS in lib/collection-grid-critical-css.ts, so the initial size estimate
 * lines up with what's already reserved before Tailwind/measureElement settle.
 */
export const COLLECTION_GRID_ROW_EXTRA_HEIGHT_PX = 140

/**
 * Rows are absolutely positioned, so the space between them is each row's own
 * bottom padding rather than the grid's row-gap. Zero: the cards butt together
 * and their own borders do the dividing, so any value here reappears as a white
 * hairline between rows.
 */
export const COLLECTION_GRID_ROW_GAP_PX = 0

/** Page size the listing APIs return, and therefore the skeleton count. */
export const COLLECTION_LISTING_PAGE_SIZE = 24

/**
 * The bar's caret (438:2979) is a small square rotated 45 degrees with two of its
 * edges drawn - a chevron built from a rectangle, which is exactly how the frame
 * vectors it. Borders are physical rather than logical on purpose: a caret points
 * down in both directions, and border-inline-end would swing it in RTL.
 */
export function CollectionBarCaret() {
  // Deliberately an <i>, not a <span>. SelectTrigger styles every direct child
  // span with [&>span]:flex-1 / text-ellipsis to make the value fill the row; a
  // span caret got caught by that, stretched across the trigger - rendering as a
  // long diagonal stroke once rotated - and squeezed the label into an ellipsis.
  // Desktop only. 438:3523 draws the mobile bar as two bare labels - no caret
  // vectors at all - where 438:2978 gives the desktop controls one each.
  return (
    <i
      aria-hidden="true"
      className="mb-[3px] hidden size-[6.6px] shrink-0 rotate-45 border-b border-r border-text-primary lg:block"
    />
  )
}
