/**
 * The checkout form column's load-bearing dimensions, shared by CheckoutClient
 * and CheckoutSkeleton.
 *
 * Same contract as collectionChrome.tsx and productPageChrome.tsx: the skeleton
 * and the real thing read one module, so a tweak to the form cannot silently put
 * the fallback out of register. The outer shell (the two-column grid, the heading
 * band, the seam) is not repeated here because the skeleton renders the real
 * CheckoutShell rather than a copy of it.
 *
 * Measured on the rendered page at 390 and 1440 with a seeded cart line, because
 * what costs CLS is the height the browser produces, not the height the design
 * specifies.
 */

/** The form's two-up field grid. 681px capped in the frame, one column below sm. */
export const CHECKOUT_ROW_GRID = 'grid grid-cols-1 gap-x-[18px] gap-y-0 sm:grid-cols-2'

/** Bottom padding on each field cell, which is what spaces the rows. */
export const CHECKOUT_CELL = 'pb-[15px]'

/**
 * Measured heights the skeleton stands in for.
 *
 *   input   33px  — the Field control at both breakpoints
 *   label   12px  — the caption above it
 *   CTA     54px  — matches the summary panel's coupon control
 *   h1      40px mobile / 50px desktop (text-[40px] leading-[40px] / lg:leading-[50px])
 */
export const CHECKOUT_INPUT_H = 'h-[33px]'
export const CHECKOUT_LABEL_H = 'h-[12px]'
export const CHECKOUT_CTA_H = 'h-[54px]'
export const CHECKOUT_TITLE_H = 'h-[40px] lg:h-[50px]'

/**
 * How many field placeholders the skeleton draws.
 *
 * The form has two shapes and the fallback cannot know which is coming: delivery
 * renders ten fields (name, surname, email, phone, street, city, zip, floor,
 * apartment, notes) and is the default for anyone without a stored preference;
 * pickup renders the first four and hides the address block.
 *
 * Six sits between them deliberately. Reserving ten would be exact for the common
 * case but leave roughly 240px of blank ground for a returning pickup customer -
 * an over-reservation, and the one failure mode this codebase keeps choosing
 * against, because content arriving into a too-tall box makes the page *shrink*.
 * Reserving four would under-shoot every delivery visitor by six rows.
 *
 * The choice costs nothing either way in practice: the difference falls below the
 * fold at both breakpoints, and measured CLS is 0.0000 on mobile and 0.0002 on
 * desktop with six.
 */
export const CHECKOUT_SKELETON_FIELDS = 6
