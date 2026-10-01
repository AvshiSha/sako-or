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
 * Raised from 76/100 when the bar became a stack: name, SKU, price, swatches. That
 * comes to roughly 120px on mobile and 138 on desktop with a single-line name.
 *
 * Under-reserve rather than over-reserve. Short of the real height costs a little
 * CLS; past it leaves blank ground inside the card, which is the white band this
 * grid has already been chased over twice.
 */
export const PRODUCT_CARD_INFO_MIN_H = "min-h-[118px] lg:min-h-[136px]";
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
