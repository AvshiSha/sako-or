import CollectionProductCardSkeleton from "@/app/components/CollectionProductCardSkeleton";

const LISTING_PAGE_SIZE = 24;

/** Reserves the same vertical space as the loaded collection grid (prevents footer CLS during streaming). */
export default function Loading() {
  return (
    <div
      className="min-h-screen bg-white"
      style={{
        minHeight: `max(100vh, calc(12 * (50vw + 8.75rem) + 10rem))`,
      }}
      aria-busy="true"
      aria-label="Loading collection"
    >
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
