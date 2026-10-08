/**
 * The product carousel's load-bearing dimensions, shared by ProductCarousel and
 * by any fallback standing in for it.
 *
 * Deliberately a plain module with no 'use client' — and that is the whole reason
 * this file exists rather than the constants living in ProductCarousel.tsx.
 * Exporting them from a client module and importing them into a server component
 * does not fail to build and does not fail to type-check: the values arrive as
 * client *references*, and interpolating one into a className string renders the
 * source of a throwing stub into the markup:
 *
 *   class="function(){throw Error(&quot;Attempted to call CAROUSEL_HEADER_BAND()
 *          from the server but CAROUSEL_HEADER_BAND is on the client...&quot;)}"
 *
 * The page still renders, just unstyled in that spot — the home fallback measured
 * 280px against the carousel's real 487.8px before this was caught. Same contract
 * as collectionChrome.tsx and productPageChrome.tsx, which are plain modules for
 * the same reason.
 */

/**
 * What decides the card width, and therefore the card height, and therefore the
 * height of the whole band: 55% of the viewport on a phone, a fixed 418px from lg.
 */
export const CAROUSEL_ITEM_BASIS = 'basis-[55%] sm:basis-[40%] lg:basis-[418px]'

/**
 * The same measurement as a width rather than a flex-basis. A fallback that lays
 * its cards out in a plain flex row cannot rely on `basis-*` alone — without the
 * carousel's own item classes the children resolve to an even split (4 cards came
 * out 99px wide against a real 213.5px). Change the two together.
 */
export const CAROUSEL_ITEM_WIDTH = 'w-[55%] sm:w-[40%] lg:w-[418px]'

/** The ruled header band. 33px either side of a single-line title: 100px measured. */
export const CAROUSEL_HEADER_BAND =
  'flex items-end border-y border-sako-black px-[30px] py-[33px]'

/** The title inside it. One line at every width we ship. */
export const CAROUSEL_TITLE =
  'font-ploni text-[32px] font-black leading-[32px] text-text-primary lg:text-[48px] lg:leading-[34.56px]'
