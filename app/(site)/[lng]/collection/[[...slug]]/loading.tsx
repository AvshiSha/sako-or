import CollectionProductCardSkeleton from "@/app/components/CollectionProductCardSkeleton";

const LISTING_PAGE_SIZE = 24;

/**
 * Reserves the same vertical space as the loaded collection grid (prevents
 * footer CLS during streaming).
 *
 * Safe on this route, and deliberately not on others. A loading.tsx streams
 * its fallback immediately, which sends the response headers and locks the
 * HTTP status at 200 for everything inside the boundary - so `notFound()`
 * degrades to a soft 404 and `redirect()` degrades to a meta refresh, with no
 * build error and no runtime warning. Collection pages need neither: an
 * unknown category renders an empty grid rather than a 404.
 *
 * Do not add a loading.tsx at [lng]/ or anywhere under product/. Those routes
 * depend on real 404s and 307s, and one there breaks them silently.
 */
export default function Loading() {
  return (
    <div className="min-h-screen bg-white" aria-busy="true" aria-label="Loading collection">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-6 pt-8 pb-6 md:pb-16">
        <div className="mb-4 min-h-[20px]" aria-hidden />
        <div className="collection-product-grid grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-x-2 gap-y-2 sm:gap-6 -mx-3 items-start">
          {Array.from({ length: LISTING_PAGE_SIZE }).map((_, index) => (
            <div key={`route-skeleton-${index}`}>
              <CollectionProductCardSkeleton />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
