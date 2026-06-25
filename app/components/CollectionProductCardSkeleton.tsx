import {
  PRODUCT_CARD_IMAGE_ASPECT,
  PRODUCT_CARD_IMAGE_STYLE,
  PRODUCT_CARD_INFO_MIN_H,
  PRODUCT_CARD_SWATCH_MIN_H,
} from "@/lib/product-card-layout";

/** Dimension-matched placeholder for collection grid loading states (CLS). */
export default function CollectionProductCardSkeleton() {
  return (
    <div className="group relative bg-gray-100 animate-pulse" aria-hidden>
      <div
        className={`relative ${PRODUCT_CARD_IMAGE_ASPECT} overflow-hidden bg-gray-200 block`}
        style={PRODUCT_CARD_IMAGE_STYLE}
      />
      <div className={`mt-0 bg-[#E1DBD7] p-3 pb-1 ${PRODUCT_CARD_INFO_MIN_H}`}>
        <div className="mb-1 h-4 w-3/4 rounded bg-gray-300/80" />
        <div className="mb-1 h-4 w-1/2 rounded bg-gray-300/70" />
        <div className="h-4 w-1/3 rounded bg-gray-300/70" />
      </div>
      <div className={`mt-0 bg-[#E1DBD7] p-3 pt-1 ${PRODUCT_CARD_SWATCH_MIN_H}`}>
        <div className="flex h-8 gap-2">
          <div className="h-8 w-8 shrink-0 rounded-full bg-gray-300/80" />
          <div className="h-8 w-8 shrink-0 rounded-full bg-gray-300/70" />
          <div className="h-8 w-8 shrink-0 rounded-full bg-gray-300/60" />
        </div>
      </div>
    </div>
  );
}
