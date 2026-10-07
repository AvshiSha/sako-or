/** Shared layout tokens so ProductCard and skeletons reserve identical space (CLS). */

/**
 * The SAKO OR — Update design system collapses what used to be two stacked blocks
 * (an 88px info block plus a 52px swatch row) into a single 100px bar with the
 * colour swatches sitting inline beside the product text. Figma node 438:3943:
 * the card is 531px tall, the image 431.25px, leaving ~100px for the bar.
 *
 * Four places encode this contract and must move together, or the collection grid
 * shifts on load: this file, ProductCard, CollectionProductCardSkeleton, and
 * COLLECTION_GRID_CRITICAL_CSS — which repeats the same numbers in rem because it
 * is inlined before Tailwind paints.
 */
/**
 * Raised from 76/100 when the bar became a stack: name, SKU, price, swatches, and
 * again from 118/136 once the rendered bar was actually measured rather than
 * estimated. A single-line name comes to 129.5px on mobile and 150.5 on desktop.
 *
 * Measured on the production build at 390 and 1280: every card in a 12-card mobile
 * grid rendered its bar at exactly 129.5px, and the desktop floor was 150.5 with
 * two-line names reaching 165. The image area was already exact at both widths
 * (233.8 and 315.3), so the whole of the grid's residual CLS - 352.8px reserved
 * against a 364.3px card, ~138px over twelve mobile rows - sat in this one number.
 *
 * Still under-reserved, by half a pixel, and deliberately: short of the real height
 * costs a little CLS; past it leaves blank ground inside the card, which is the
 * white band this grid has already been chased over twice. These are minimums the
 * real bar clears on its own content, so raising them to here changes nothing about
 * a loaded card - only what the skeleton and the pre-paint reservation claim.
 */
export const PRODUCT_CARD_INFO_MIN_H = "min-h-[129px] lg:min-h-[150px]";
/** One line; the sale case lays the original and reduced price out side by side. */
export const PRODUCT_CARD_PRICE_MIN_H = "min-h-[24px]";
/**
 * The image area is not square. Mobile is 195x235 (438:3976, ~4:5) and desktop is
 * 417.25x431.25 (438:3939, ~1:1.03). Desktop is within 3% of square so it keeps
 * aspect-square, but forcing that on mobile cropped roughly 17% more off every
 * product photo than the design intends.
 *
 * There is deliberately no inline aspectRatio style any more: an inline style beats
 * a class, so it would silently defeat the lg: variant here. Pre-paint reservation
 * for the collection grid lives in COLLECTION_GRID_CRITICAL_CSS, whose 60.25vw term
 * is 50vw x 235/195.
 */
export const PRODUCT_CARD_IMAGE_ASPECT = "aspect-[195/235] lg:aspect-square";

/** Mobile shows the whole product (438:3976 is object-contain), desktop fills it. */
export const PRODUCT_CARD_IMAGE_FIT = "object-contain lg:object-cover";
