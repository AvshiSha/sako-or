import CollectionProductCardSkeleton from "@/app/components/CollectionProductCardSkeleton";

const LISTING_PAGE_SIZE = 24;

type CampaignSkeletonProps = {
  /** Whether the campaign has any banner, so the hero box is only reserved when one will render. */
  hasBanner: boolean;
  /** The real description text - rendered with CampaignClient's own classes so the height matches exactly. */
  description?: string;
  lng: "en" | "he";
};

/**
 * Streaming fallback for the campaign route, dimension-matched to CampaignClient.
 *
 * This deliberately does NOT live in a loading.tsx. A loading.tsx streams its
 * fallback before the page function runs, which commits the response at 200 -
 * and campaign/page.tsx redirect()s to /collection when no campaign resolves,
 * so a loading.tsx would silently degrade that 307 into a meta refresh. Driving
 * the fallback from a Suspense boundary *below* the redirect keeps the real 307
 * while still reserving the layout.
 *
 * Every wrapper class here mirrors CampaignClient - keep them in sync.
 */
export default function CampaignSkeleton({
  hasBanner,
  description,
  lng,
}: CampaignSkeletonProps) {
  return (
    <div
      className="min-h-screen bg-white"
      aria-busy="true"
      aria-label={lng === "he" ? "טוען מבצע" : "Loading campaign"}
    >
      {/* Mirrors CampaignClient's hero box (aspect-[4/5] md:aspect-[21/9]). */}
      {hasBanner && (
        <div
          className="relative w-full overflow-hidden bg-[#B2A28E] aspect-[4/5] md:aspect-[21/9]"
          aria-hidden
        />
      )}

      {/* Real copy, real classes - a placeholder bar cannot match variable-length text. */}
      {description && (
        <div
          className={`max-w-4xl mx-auto px-4 md:px-8 py-8 ${
            lng === "he" ? "text-right" : "text-left"
          }`}
          aria-hidden
        >
          <div className="prose prose-lg max-w-none">
            <p className="text-gray-700 leading-relaxed whitespace-pre-line">
              {description}
            </p>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 md:px-8 pt-8 pb-8 md:pb-8">
        {/* Filter/sort toolbar row: flex items-center gap-3 mb-4 over h-10 controls. */}
        <div className="flex items-center gap-3 mb-4 h-10" aria-hidden />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 md:gap-x-2">
          {Array.from({ length: LISTING_PAGE_SIZE }).map((_, index) => (
            <div key={`campaign-skeleton-${index}`}>
              <CollectionProductCardSkeleton />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
