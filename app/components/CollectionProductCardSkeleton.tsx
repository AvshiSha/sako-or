import {
  PRODUCT_CARD_IMAGE_ASPECT,
  PRODUCT_CARD_INFO_MIN_H,
} from "@/lib/product-card-layout";

/**
 * Dimension-matched placeholder for collection grid loading states (CLS).
 *
 * The card's own structure - borders, aspect, info-bar height - is read from the
 * same tokens ProductCard uses, so the two cannot drift. The placeholder fills
 * (`sako-skeleton` in app/globals.css) are the listing's shared loading
 * treatment; they replaced `animate-pulse`, which flickered the whole card's
 * opacity including its borders.
 */
export default function CollectionProductCardSkeleton() {
  return (
    <div
      className="group relative flex h-full flex-col border-b border-l border-sako-black bg-surface-secondary"
      aria-hidden
    >
      <div
        className={`relative ${PRODUCT_CARD_IMAGE_ASPECT} sako-skeleton overflow-hidden block`}
      />
      {/* Mirrors ProductCard's bar: name, SKU, price, swatches, stacked. The shape
          has to match or the grid resettles when the real cards arrive. */}
      <div
        className={`mt-0 flex flex-1 flex-col gap-[6px] border-t border-sako-black bg-surface-secondary px-[10px] pt-[15px] pb-[14px] lg:px-[16px] ${PRODUCT_CARD_INFO_MIN_H}`}
      >
        <div className="min-w-0">
          <div className="sako-skeleton sako-skeleton-muted mb-1 h-3 w-3/4" />
          <div className="sako-skeleton sako-skeleton-muted h-2 w-1/2" />
        </div>
        <div className="sako-skeleton sako-skeleton-muted h-3 w-1/3" />
        <div className="flex gap-[6px] overflow-hidden lg:gap-[8px]">
          <div className="sako-skeleton sako-skeleton-muted h-[36px] w-[36px] rounded-full lg:h-[45px] lg:w-[45px]" />
          <div className="sako-skeleton sako-skeleton-muted h-[36px] w-[36px] rounded-full lg:h-[45px] lg:w-[45px]" />
        </div>
      </div>
    </div>
  );
}
