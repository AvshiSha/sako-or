import CollectionProductCardSkeleton from "@/app/components/CollectionProductCardSkeleton";
import {
  COLLECTION_INSET,
  COLLECTION_LISTING_PAGE_SIZE,
  COLLECTION_PRODUCT_GRID,
} from "@/app/components/collection/collectionChrome";

/**
 * Reserves the same vertical space as the loaded campaign grid, the way
 * [[...slug]]/loading.tsx does for the collection grid. It used to render a bare
 * centred spinner, which reserved nothing - the footer painted high and then the
 * grid shoved it down.
 *
 * No hero placeholder: the banner's aspect ratio depends on whether the campaign
 * has a desktop image, a mobile image or a video, and reserving the wrong one
 * causes a bigger shift than reserving nothing.
 *
 * This route already had a loading.tsx, so its streaming boundary is nothing new.
 * Worth knowing all the same: the fallback sends headers immediately, which locks
 * the status at 200, so page.tsx's `redirect()` for an unknown campaign slug
 * degrades to a meta refresh rather than a 307. See the note in the collection's
 * own loading.tsx before adding one of these to another route.
 */
export default function Loading() {
  return (
    <div className="min-h-screen bg-white" aria-busy="true" aria-label="Loading campaign">
      <div className="w-full pt-8 pb-6 md:pb-16">
        <div className={`mb-4 min-h-[20px] ${COLLECTION_INSET}`} aria-hidden />
        <div className={COLLECTION_PRODUCT_GRID}>
          {Array.from({ length: COLLECTION_LISTING_PAGE_SIZE }).map((_, index) => (
            <div key={`route-skeleton-${index}`}>
              <CollectionProductCardSkeleton />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
