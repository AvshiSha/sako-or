/**
 * The storefront's two-column shell: a fluid content column beside a fixed 502px
 * standing panel, divided by a black hairline. Checkout Details (438:2725) is the
 * frame it comes from; the cart, both checkout steps and the auth pages are all the
 * same construction with a different column and a different panel.
 *
 * It lives here because the hairline is easy to draw wrongly, and it was drawn
 * wrongly in all four places.
 *
 * ## Why the rule is not a border
 *
 * The obvious spelling is `lg:border-e` on the content <section>. That makes the
 * line's length the *section's* height — and because the grid is `lg:items-start`,
 * the section is only as tall as its own content. Whenever the panel is the taller
 * of the two, the rule stops partway down and the panel's outer edge is left open
 * from there to the bottom. On an empty cart that was a 338px gap; with one product,
 * 380px.
 *
 * `lg:items-start` cannot simply be dropped for the default `stretch`: the cart and
 * checkout summaries are `lg:sticky`, and a stretched grid item fills the row, so
 * the sticky element has no room to travel and stops sticking.
 *
 * So the rule is drawn on the grid *container* instead, as a pseudo-element:
 *
 *   - `inset-y-0` spans the grid row, which is as tall as whichever column is
 *     taller. The rule therefore always reaches the bottom edge, and follows the
 *     content as either side grows or shrinks.
 *   - `inset-inline-end: 502px` pins it to the track boundary from the inline end,
 *     so it lands on the seam in both directions — 502px from the left in Hebrew,
 *     502px from the right in English — with no mirrored copy.
 *   - 1px of sako-black, the same rule the cart's line items are divided by.
 *
 * The 502px here and the 502px in the grid template are one number: change them
 * together or the rule leaves the seam.
 *
 * Consumers must NOT also put `lg:border-e` on their <section>, or the seam draws
 * twice.
 */
export const SPLIT_SHELL_GRID =
  'relative lg:grid lg:grid-cols-[minmax(0,1fr)_502px] lg:items-start ' +
  "lg:before:absolute lg:before:inset-y-0 lg:before:end-[502px] lg:before:w-px lg:before:bg-sako-black lg:before:content-['']"
