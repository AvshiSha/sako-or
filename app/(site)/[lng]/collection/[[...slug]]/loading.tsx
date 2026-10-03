import CollectionListingSkeleton from "@/app/components/collection/CollectionListingSkeleton";

/**
 * Reserves the same vertical space as the loaded collection page - title, filter
 * bar, counter row and grid - so the footer does not travel while the page
 * streams.
 *
 * It used to reserve the grid only. That left the <h1> (32px, 48 at desktop,
 * plus its 16px margin) and the filter bar (58px, 74 at desktop) unaccounted
 * for, so the whole listing stepped down roughly 110px on mobile and 140 on
 * desktop the moment the real page arrived - a shift of the entire viewport's
 * worth of cards, at the one moment CLS is watching hardest.
 *
 * Safe on this route, and deliberately not on others. A loading.tsx streams its
 * fallback immediately, which sends the response headers and locks the HTTP
 * status at 200 for everything inside the boundary - so `notFound()` degrades to
 * a soft 404 and `redirect()` degrades to a meta refresh, with no build error and
 * no runtime warning. Collection pages need neither: an unknown category renders
 * an empty grid rather than a 404.
 *
 * Do not add a loading.tsx at [lng]/ or anywhere under product/. Those routes
 * depend on real 404s and 307s, and one there breaks them silently.
 */
export default function Loading() {
  return <CollectionListingSkeleton label="Loading collection" />;
}
