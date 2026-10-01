import {
  PRODUCT_CARD_IMAGE_ASPECT,
  PRODUCT_CARD_INFO_MIN_H,
} from "@/lib/product-card-layout";

/** Dimension-matched placeholder for collection grid loading states (CLS). */
export default function CollectionProductCardSkeleton() {
  return (
    <div
      className="group relative flex h-full animate-pulse flex-col border-b border-l border-sako-black bg-surface-secondary"
      aria-hidden
    >
      <div
        className={`relative ${PRODUCT_CARD_IMAGE_ASPECT} overflow-hidden bg-sako-gray-300 block`}
      />
      {/* Mirrors ProductCard's bar: name, SKU, price, swatches, stacked. The shape
          has to match or the grid resettles when the real cards arrive. */}
      <div
        className={`mt-0 flex flex-1 flex-col gap-[6px] border-t border-sako-black bg-surface-secondary px-[10px] pt-[15px] pb-[14px] lg:px-[16px] ${PRODUCT_CARD_INFO_MIN_H}`}
      >
        <div className="min-w-0">
          <div className="mb-1 h-3 w-3/4 bg-sako-gray-200" />
          <div className="h-2 w-1/2 bg-sako-gray-200/70" />
        </div>
        <div className="h-3 w-1/3 bg-sako-gray-200/70" />
        <div className="flex gap-[6px] overflow-hidden lg:gap-[8px]">
          <div className="h-[36px] w-[36px] rounded-full bg-sako-gray-200 lg:h-[45px] lg:w-[45px]" />
          <div className="h-[36px] w-[36px] rounded-full bg-sako-gray-200/70 lg:h-[45px] lg:w-[45px]" />
        </div>
      </div>
    </div>
  );
}
