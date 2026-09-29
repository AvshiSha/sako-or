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
      {/* Mirrors CollectionClient's shell exactly - full-bleed, with the inset
          carried by the blocks that are not the grid. If this container keeps a
          max-width the grid paints narrow and then jumps wide when the page
          streams in, which is the shift this file exists to prevent. */}
      <div className="w-full pt-8 pb-6 md:pb-16">
        <div className="mb-4 min-h-[20px] px-4 sm:px-6 lg:px-[36px]" aria-hidden />
        <div className="collection-product-grid grid grid-cols-2 items-start gap-0 lg:grid-cols-4">
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
