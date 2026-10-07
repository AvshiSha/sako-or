import ProductPageSkeleton from '@/app/components/product/ProductPageSkeleton'

/**
 * The product page's route fallback - what a shopper sees the instant they tap a
 * product card, instead of the collection they just left sitting there.
 *
 * Measured before this existed: 6 out of 6 taps from a collection held the old
 * page for 722-1068ms with no feedback at all, on a throttled phone profile. The
 * page is fully server-rendered in one flush, so the wait happened before the
 * first byte and was invisible to everything except the person tapping.
 *
 * Safe here only because layout.tsx owns the notFound() calls now. A loading.tsx
 * flushes its fallback immediately, which sends the headers and pins the status
 * at 200 for everything inside the boundary - so a notFound() under it degrades
 * to a soft 404. Nothing inside this boundary throws one any more; the product and
 * colour are validated in the layout, above it. If a check ever moves back down
 * into page.tsx, this file has to go with it.
 *
 * The hero of the collection equivalent is the grid; here it is the gallery, and
 * the skeleton is built from the PDP's own structure rather than borrowed.
 */
export default function Loading() {
  return <ProductPageSkeleton label="Loading product" />
}
