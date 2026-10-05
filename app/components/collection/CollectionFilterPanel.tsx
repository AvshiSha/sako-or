'use client'

import type { Category } from '@/lib/firebase'
import { Slider } from '@/app/components/ui/slider'
import { getSizeAccessibleLabel, getSizeDisplayLabel } from '@/lib/product-size-options'

/**
 * Collection filter panel, design system 438:3094.
 *
 * One body for both surfaces. The desktop sidebar and the mobile sheet previously
 * carried two hand-maintained copies of these four sections that differed only in
 * which accordion-state variable they held - and the frame has no accordions at
 * all, so that difference disappeared with the redesign.
 *
 * Sections are flat: a Bold 16 label on the inline start, the control under it,
 * and a full-bleed rule closing each one (438:3102 puts border-b on the section
 * while insetting its content by 30px, so the rule runs edge to edge).
 *
 * The size and colour grids are sized by container query rather than by viewport.
 * The shell is `w-[78%] max-w-[501px]`, so the content measure behind the 30px
 * inset runs 244px on a 390px phone and 441px on the desktop board - a spread
 * that no `sm:` breakpoint tracks, because the panel is a fraction of the
 * viewport rather than a step function of it. Each grid therefore opens its own
 * `@container` on the measure it actually has to fill.
 */

const SECTION = 'border-b border-sako-black px-[30px] py-[20px]'
const SECTION_LABEL = 'font-ploni text-[16px] font-bold text-text-primary'

export interface CollectionFilterPanelProps {
  lng: string
  labels: {
    title: string
    price: string
    colors: string
    sizes: string
    subCategories: string
    apply: string
    clearAll: string
    reset: string
    close: string
  }
  /** Price */
  uiRange: [number, number]
  priceBounds: { min: number; max: number }
  onSliderChange: (value: number[]) => void
  onSliderCommit: (value: number[]) => void
  onPriceReset: () => void
  formatPrice: (value: number) => string
  /** Colours */
  allColors: string[]
  selectedColors: string[]
  onColorToggle: (color: string) => void
  getColorHex: (color: string) => string
  getColorLabel: (color: string) => string
  /** Sizes */
  numericSizes: string[]
  alphaSizes: string[]
  selectedSizes: string[]
  onSizeToggle: (size: string) => void
  /** Sub-categories */
  showSubSubCategoryFilter: boolean
  subSubCategoriesByParent: Record<string, Category[]>
  selectedSubSubCategories: string[]
  onSubSubCategoryToggle: (id: string) => void
  getParentCategoryName: (parentId: string) => string
  getSubSubCategoryName: (category: Category) => string
  /** Actions */
  onApply: () => void
  onClear: () => void
  onClose: () => void
  isBusy?: boolean
}

export default function CollectionFilterPanel({
  lng,
  labels,
  uiRange,
  priceBounds,
  onSliderChange,
  onSliderCommit,
  onPriceReset,
  formatPrice,
  allColors,
  selectedColors,
  onColorToggle,
  getColorHex,
  getColorLabel,
  numericSizes,
  alphaSizes,
  selectedSizes,
  onSizeToggle,
  showSubSubCategoryFilter,
  subSubCategoriesByParent,
  selectedSubSubCategories,
  onSubSubCategoryToggle,
  getParentCategoryName,
  getSubSubCategoryName,
  onApply,
  onClear,
  onClose,
  isBusy = false,
}: CollectionFilterPanelProps) {
  const isRTL = lng === 'he'
  const hasPriceFilter = uiRange[0] > priceBounds.min || uiRange[1] < priceBounds.max
  const hasAnyFilter =
    hasPriceFilter ||
    selectedColors.length > 0 ||
    selectedSizes.length > 0 ||
    selectedSubSubCategories.length > 0

  // One run, numbers then words. They were drawn as two grids, which put a lone
  // "One size" in a second seven-column box of its own - one cell of content and
  // six of nothing. Nothing in 438:3116 separates them: the frame is a single
  // wrapping run of cells.
  const sizes = [...numericSizes, ...alphaSizes]

  return (
    <div className="flex h-full flex-col bg-surface-primary">
      {/* Heading, 438:3097. The close control is not in the frame - the panel is
          drawn as a standalone 501px board - but a sheet needs a way out. */}
      <div className="flex shrink-0 items-start justify-between border-b border-sako-black px-[30px] pt-[30px] pb-[31px]">
        <h2 className="font-ploni text-[40px] font-black leading-[40px] text-text-primary">
          {labels.title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={labels.close}
          className="mt-[8px] font-ploni text-[20px] leading-none text-text-primary transition-opacity hover:opacity-70"
        >
          &#10005;
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Price, 438:3102 */}
        <div className={SECTION}>
          <h3 className={SECTION_LABEL}>{labels.price}</h3>
          <div className="pt-[16px]">
            <Slider
              value={uiRange}
              onValueChange={onSliderChange}
              onValueCommit={onSliderCommit}
              min={Math.max(0, Math.floor((priceBounds.min - 200) / 10) * 10)}
              max={Math.ceil((priceBounds.max + 200) / 10) * 10}
              step={10}
              className="w-full"
              dir={isRTL ? 'rtl' : 'ltr'}
            />
            {/* Minimum first. Under RTL that lands it on the right, which is the
                end the slider counts up from - and where 438:3115 puts the 0. */}
            <div className="flex items-end justify-between pt-[10px] font-ploni text-[13px] leading-[16px] tabular-nums text-text-primary">
              <span>₪{formatPrice(uiRange[0])}</span>
              <span>₪{formatPrice(uiRange[1])}</span>
            </div>
            {hasPriceFilter && (
              <button
                type="button"
                onClick={onPriceReset}
                className="mt-[10px] font-ploni text-[13px] text-text-secondary underline transition-opacity hover:opacity-70"
              >
                {labels.reset}
              </button>
            )}
          </div>
        </div>

        {/* Sizes, 438:3116. Seven 44px cells to the row, each ruled 1px ink with
            its neighbours' edges collapsed - and 438:3135 lets the short second
            row simply end, with nothing drawn under the cells it does not reach.

            This was built with the PDP's technique instead (438:4240: an ink
            ground showing through 1px gaps), which cannot express that. A gap
            with no cell over it paints as solid ink, so a short row had to be
            padded with spacers, and the panel grew a half-row of empty boxes.
            Collapsing real borders with a -1px pull has no ground to hide, so the
            run stops where the sizes stop. The 1px the pull takes off the leading
            edge is given back as the wrapper's ps/pt, which keeps the grid's
            outer rule flush with the track it is measured against. */}
        {sizes.length > 0 && (
          <div className={SECTION}>
            <h3 className={SECTION_LABEL}>{labels.sizes}</h3>
            <div className="@container mt-[16px]">
              <div className="grid grid-cols-5 ps-px pt-px @sm:grid-cols-7">
                {sizes.map((size) => {
                  const isSelected = selectedSizes.includes(size)
                  const label = getSizeDisplayLabel(size)
                  const spoken = getSizeAccessibleLabel(size, lng)
                  return (
                    <button
                      key={size}
                      type="button"
                      onClick={() => onSizeToggle(size)}
                      aria-pressed={isSelected}
                      // Only one-size is abbreviated, so only it needs the long
                      // form spoken; a number reads correctly as itself.
                      aria-label={label === size ? undefined : spoken}
                      className={`relative -ms-px -mt-px flex h-[44px] items-center justify-center whitespace-nowrap border border-border-default px-[6px] font-ploni text-[16px] tabular-nums transition-colors focus-visible:z-10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-sako-ink-900 ${
                        isSelected
                          ? 'bg-sako-ink-900 text-text-inverse'
                          : 'bg-surface-secondary text-text-primary hover:bg-sako-gray-200'
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Colours, 438:3142. A 32px dot inside a 36px ring with its caption
            beside it, laid on a grid so the swatches line up in columns - the
            frame's own construction (438:3144 is a five-track grid on an 11px row
            gap, each pair pinned to its column's inline start). This was a
            `flex-wrap` run, which gives the same swatches in roughly the same
            places but lets every row break where its own labels happen to land,
            so nothing aligns down the panel.

            Two departures from the frame, both for legibility at the measures the
            panel actually gets:

            - The caption is Body 12, not the frame's Caption 9/0.72px tracking.
              Nine pixels is the size the system reserves for a one-word eyebrow;
              these are colour names, several of them two words ("חום בהיר",
              "Black Nail Polish"), and at 9px with tracking they read as grey
              texture rather than as words. 12 is the system's own metadata size -
              the cart line's "colour / size" row, 438:4594 - and the tracking
              comes off, which is what holds a Hebrew word together.
            - Five tracks only fit the 441px desktop measure. On the 244px phone
              measure a 36px swatch plus a readable name needs ~104px, so the
              count steps 2 → 3 → 4 with the container and the pair never has to
              choose between a clipped name and a shrunken swatch.

            The frame documents no selected state. Selection draws an ink ring
            clear of the swatch and sets the caption bold - the system's own two
            ways of saying "this one", borrowed from the PDP size cell and from
            the sub-category list below, rather than a third invented here. It is
            an outline at a 2px offset rather than a thicker border on the 36px
            ring, because the ring is `size-[36px]` over a 32px dot: thickening
            its border eats the 1px the dot was floating in, and the ring then
            touches the swatch. On a black swatch that makes the whole mark
            disappear - the one colour in the list where the shopper most needs
            to see it - and on white it loses the only edge the dot had. An
            outline sits outside the 36px circle, so it reads on every colour and
            moves nothing. */}
        {allColors.length > 0 && (
          <div className={SECTION}>
            <h3 className={SECTION_LABEL}>{labels.colors}</h3>
            <div className="@container pt-[16px]">
              <div className="grid grid-cols-2 items-center gap-x-[12px] gap-y-[14px] @2xs:grid-cols-3 @sm:grid-cols-4">
                {allColors.map((color) => {
                  const isSelected = selectedColors.includes(color)
                  return (
                    <button
                      key={color}
                      type="button"
                      onClick={() => onColorToggle(color)}
                      aria-pressed={isSelected}
                      className="flex items-center gap-[10px] text-start transition-opacity hover:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sako-ink-900"
                    >
                      <span
                        className={`flex size-[36px] shrink-0 items-center justify-center rounded-full border border-border-subtle ${
                          isSelected ? 'outline-2 outline-offset-2 outline-sako-ink-900' : ''
                        }`}
                      >
                        <span
                          className="block size-[32px] rounded-full border border-border-subtle"
                          style={{ backgroundColor: getColorHex(color) }}
                        />
                      </span>
                      {/* min-w-0 so a long name wraps inside its track instead of
                          widening it and pushing the column out of line. */}
                      <span
                        className={`min-w-0 font-ploni text-[12px] leading-[1.25] text-text-primary ${
                          isSelected ? 'font-bold' : ''
                        }`}
                      >
                        {getColorLabel(color)}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Sub-categories, 438:3205 — two columns of plain labels.
            Rows carry a minimum of the frame's 28px rather than exactly 28px: the
            frame fills every cell with the placeholder "תת קטגוריה", so nothing in
            it is longer than one line, and a fixed height was fine until a real
            name was not. "לואפרים פלטפורמה" on the 244px phone measure takes two,
            and at a locked 28px it spilled over the item underneath and pushed the
            two columns out of step with each other. Grid rows size to their tallest
            cell, so letting the button grow keeps the columns aligned by row. */}
        {showSubSubCategoryFilter && Object.keys(subSubCategoriesByParent).length > 0 && (
          <div className={SECTION}>
            <h3 className={SECTION_LABEL}>{labels.subCategories}</h3>
            {Object.entries(subSubCategoriesByParent).map(([parentId, subSubCats]) => (
              <div key={parentId} className="pt-[16px]">
                <h4 className="font-ploni text-[13px] text-text-secondary">
                  {getParentCategoryName(parentId)}
                </h4>
                <div className="mt-[8px] grid grid-cols-2 gap-x-[16px] gap-y-[4px]">
                  {subSubCats.map((category) => {
                    const isSelected = selectedSubSubCategories.includes(category.id!)
                    return (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => onSubSubCategoryToggle(category.id!)}
                        aria-pressed={isSelected}
                        className={`flex min-h-[28px] items-center py-[2px] text-start font-ploni text-[16px] leading-[1.25] transition-opacity hover:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sako-ink-900 ${
                          isSelected ? 'font-bold text-text-primary' : 'text-text-primary'
                        }`}
                      >
                        {getSubSubCategoryName(category)}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {hasAnyFilter && (
          <div className="px-[30px] py-[20px]">
            <button
              type="button"
              onClick={onClear}
              className="font-ploni text-[13px] text-text-secondary underline transition-opacity hover:opacity-70"
            >
              {labels.clearAll}
            </button>
          </div>
        )}
      </div>

      {/* Apply bar, 438:3220. Label on the inline start, arrow opposite, same
          construction as the PDP's sticky add-to-bag. The frame's copy reads
          "המשך לתשלום", which belongs to checkout rather than a filter panel, so
          the existing apply string is used instead. */}
      <button
        type="button"
        onClick={onApply}
        disabled={isBusy}
        className="flex h-[58px] shrink-0 items-center justify-between border-t border-sako-black px-[19px] transition-colors hover:bg-surface-secondary disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="font-ploni text-[13px] font-bold text-text-primary">{labels.apply}</span>
        <span aria-hidden="true" className="font-ploni text-[22px] leading-none text-text-primary">
          &#8601;
        </span>
      </button>
    </div>
  )
}
