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
  'collection-product-grid grid grid-cols-2 items-stretch gap-0 lg:grid-cols-4'

/**
 * The rule closing the top of the listing, above the first row of cards.
 *
 * The cards draw three of their four sides (border-b and border-l on the root,
 * border-t on the info block) and deliberately no top border, so the grid's first
 * row had an open edge while every row below it was closed by the row above. This
 * supplies that one missing line.
 *
 * It belongs to the block *wrapping* the rows, never to COLLECTION_PRODUCT_GRID
 * itself: once the listing virtualizes, each row is its own grid, so a rule on the
 * grid would repeat under every row and double up against the cards' own border-b.
 *
 * border-sako-black, not the border-border-default the filter bar above uses -
 * #000 is what the cards divide themselves with, and this line has to read as one
 * of theirs rather than as the bar's #11110F.
 */
export const COLLECTION_GRID_TOP_RULE = 'border-t border-sako-black'

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
 * Height one grid row is expected to take, given the measured card width and the
 * live column count. The virtualiser uses this for every row it has not rendered
 * yet, so an inaccurate answer here is a scroll jump: total page height is the sum
 * of the measured rows plus this estimate for all the others.
 *
 * The flat `cardWidth + 136` this replaced (COLLECTION_GRID_ROW_EXTRA_HEIGHT_PX,
 * now gone) was only ever right at desktop. It assumed a square image and a 136px
 * info bar,
 * which is 438:3939/438:3943 exactly - but the mobile card is neither. 438:3976
 * draws the image 195x235 (4:5, so 1.205x the card width, not 1.0) and
 * PRODUCT_CARD_INFO_MIN_H reserves 118px under it rather than 136. At a 390px
 * viewport that came out 331px against a real 353 - 22px short on every row, or
 * a quarter of a screen over a dozen rows.
 *
 * Keep in step with PRODUCT_CARD_IMAGE_ASPECT and PRODUCT_CARD_INFO_MIN_H in
 * lib/product-card-layout.ts, and with the two min-height rules in
 * lib/collection-grid-critical-css.ts. Those four places encode one contract.
 */
export function estimateCollectionRowHeight(
  cardWidth: number,
  columns: number
): number {
  // The lg: breakpoint is the only thing that changes the card's proportions, and
  // it is the same 1024px cutoff that moves the grid to four columns - so the live
  // column count is a safe proxy for "are we on the desktop card?".
  const isDesktopCard = columns >= 4
  const imageHeight = isDesktopCard ? cardWidth : cardWidth * (235 / 195)
  const infoHeight = isDesktopCard ? 136 : 118
  return imageHeight + infoHeight
}

/**
 * The campaign hero's frame, 438:2962. One constant because three places have to
 * reserve the same box or the page jumps when the banner lands: the image hero,
 * the video hero, and the route-level skeleton - which runs before the server has
 * said whether this campaign even has a video.
 *
 * The video hero used to be h-[70vh] md:h-[80vh] while the image hero was this
 * ratio, which is why campaign/loading.tsx reserved no hero at all: with two
 * possible heights, guessing wrong cost more than guessing nothing. On a 390x844
 * phone the gap was 591px against 487 - so "nothing" meant the whole listing slid
 * 125vw down the moment the banner painted. One ratio for both makes the box
 * knowable in advance, which is the only way the skeleton can reserve it.
 */
export const CAMPAIGN_HERO_FRAME =
  'relative w-full overflow-hidden aspect-[4/5] md:aspect-[21/9]'

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
