/**
 * The ruled product rows the cart and the favourites list are both built from.
 *
 * The two pages had a byte-identical copy of this markup each - same
 * `min-h-[150px] lg:min-h-[178px]`, same `w-[120px] lg:w-[185px]` image column,
 * same three text bars - which is the drift the chrome modules exist to prevent.
 * One row shape, one definition.
 *
 * Upgraded from `animate-pulse bg-sako-gray-300` to `sako-skeleton` on the way
 * through: the pulse treatment predates the design system's loading texture and
 * was the last place on the storefront still using it, so the cart and
 * favourites were the only screens whose placeholders did not sheen like
 * everywhere else.
 *
 * Measured against the real rows: 150 reserved against 153 rendered on mobile,
 * 178 against 178 on desktop.
 */
export default function SavedLineRowsSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={`saved-line-${index}`}
          className="flex min-h-[150px] border-b border-sako-black lg:min-h-[178px]"
          aria-hidden
        >
          <div className="sako-skeleton w-[120px] shrink-0 self-stretch lg:w-[185px]" />
          <div className="flex flex-1 flex-col gap-[10px] px-[14px] pt-[17px]">
            <div className="sako-skeleton sako-skeleton-muted h-[20px] w-[200px] max-w-[70%]" />
            <div className="sako-skeleton sako-skeleton-muted h-[12px] w-[90px]" />
            <div className="sako-skeleton sako-skeleton-muted h-[16px] w-[70px]" />
          </div>
        </div>
      ))}
    </>
  )
}
