/**
 * The product page's load-bearing dimensions, shared by ProductColorClient and
 * ProductPageSkeleton.
 *
 * Same contract as collectionChrome.tsx, and for the same reason: the collection
 * skeleton is accurate to half a pixel because it and the real grid read their
 * sizes from one module rather than from two copies that drift. A skeleton that
 * hard-codes its own numbers is a shift waiting for the next layout tweak.
 *
 * Every value below was measured on the rendered page at 390 and 1440 rather than
 * read off the design, because what costs CLS is the height the browser actually
 * produces. Where the two disagree, the measurement wins.
 */

/**
 * Gallery and info laid side by side from lg up, info pinned to a 502px column.
 * Single column below that, gallery first.
 */
export const PDP_GRID =
  'grid grid-cols-1 gap-0 lg:grid-cols-[502px_minmax(0,1fr)] lg:items-start'

/** Gallery column. `lg:order-2` puts it after the info column from lg up. */
export const PDP_GALLERY_COL = 'relative w-full lg:order-2'

/**
 * Desktop gallery: two across, hairline gutter, square tiles. Hidden on mobile,
 * where the same images run as a carousel instead.
 */
export const PDP_DESKTOP_GALLERY_GRID = 'hidden grid-cols-2 gap-px lg:grid'

/**
 * The mobile carousel is square - measured 390x390 at a 390 viewport on three
 * different products, so this one is exact rather than an estimate, and the
 * skeleton can reserve it to the pixel.
 */
export const PDP_GALLERY_ASPECT = 'aspect-square'

/**
 * How many desktop tiles the skeleton draws.
 *
 * Deliberately short. The real grid runs as many squares as the variant has
 * images, which the fallback cannot know - the same problem the campaign hero
 * had, and the same resolution: under-reserve. Two rows is the floor across the
 * catalogue; a product with more images grows downward, below the fold, which
 * costs far less than reserving five rows for a product that has two and leaving
 * a blank column behind.
 */
export const PDP_SKELETON_DESKTOP_TILES = 4

/**
 * Info column. Sticky from lg up, which is why the skeleton must carry the same
 * classes - a non-sticky placeholder swapped for a sticky column re-anchors the
 * whole right-hand side on the first scroll after hydration.
 */
export const PDP_INFO_COL =
  'space-y-[30px] px-4 py-4 sm:px-6 lg:sticky lg:top-28 lg:order-1 lg:self-start lg:px-[36px] lg:pb-8'

/** The title/price/swatch stack at the top of the info column. */
export const PDP_INFO_HEAD = 'flex flex-col gap-[10px] pt-[12px]'

/**
 * Measured heights for the blocks the skeleton stands in for. All three products
 * sampled produced identical numbers, so these are the real rendered heights and
 * not a guess:
 *
 *   h1          60px   (text-[40px] leading-[30px], two lines - every Hebrew
 *                       product name sampled wrapped, and a one-line reservation
 *                       would shift the entire column by 30px on each of them)
 *   seo subline 16px   (text-[13px] leading-[16px])
 *   price row   20.8px (text-[14px], bold leading-[20.8px])
 *   CTA         46px   (mobile; lg:h-[54px] on desktop)
 *   swatch      47px   circles, 6px apart
 */
export const PDP_TITLE_H = 'h-[60px]'
export const PDP_SUBLINE_H = 'h-[16px]'
export const PDP_PRICE_H = 'h-[21px]'
export const PDP_CTA_H = 'h-[46px] lg:h-[54px]'
export const PDP_SWATCH = 'size-[47px]'
export const PDP_SWATCH_ROW = 'mt-[10px] flex gap-[6px]'

/** Size tiles in the size grid, and the row of secondary actions under the CTA. */
export const PDP_SIZE_TILE_H = 'h-[46px]'
export const PDP_ACTION_ROW = 'mt-[30px] flex gap-[8px]'
