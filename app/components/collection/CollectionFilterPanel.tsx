'use client'

import type { Category } from '@/lib/firebase'
import { Slider } from '@/app/components/ui/slider'

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

  const sizeGroups = [numericSizes, alphaSizes].filter((group) => group.length > 0)

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

        {/* Sizes, 438:3116. Same cell treatment as the PDP size grid: an ink ground
            showing through 1px gaps, so the run stays evenly ruled when it wraps. */}
        {sizeGroups.length > 0 && (
          <div className={SECTION}>
            <h3 className={SECTION_LABEL}>{labels.sizes}</h3>
            {sizeGroups.map((group, groupIndex) => (
              <div
                key={groupIndex}
                className="mt-[16px] grid grid-cols-7 gap-px border border-border-default bg-sako-ink-900 p-px"
              >
                {group.map((size) => {
                  const isSelected = selectedSizes.includes(size)
                  return (
                    <button
                      key={size}
                      type="button"
                      onClick={() => onSizeToggle(size)}
                      aria-pressed={isSelected}
                      className={`flex h-[44px] items-center justify-center font-ploni text-[16px] tabular-nums transition-colors ${
                        isSelected
                          ? 'bg-sako-ink-900 text-text-inverse'
                          : 'bg-surface-secondary text-text-primary hover:bg-sako-gray-200'
                      }`}
                    >
                      {size}
                    </button>
                  )
                })}
                {/* Spacers keep the ink ground from showing as solid blocks where a
                    row runs short - the same reason the PDP grid pads its last row. */}
                {Array.from({ length: (7 - (group.length % 7)) % 7 }).map((_, index) => (
                  <div key={`size-spacer-${index}`} aria-hidden="true" className="h-[44px] bg-surface-secondary" />
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Colours, 438:3142. A 32px dot inside a 36px ring, with a 9px caption
            beside it. The frame draws the ring on every swatch and documents no
            selected state, so selection thickens the ring rather than inventing a
            new treatment. */}
        {allColors.length > 0 && (
          <div className={SECTION}>
            <h3 className={SECTION_LABEL}>{labels.colors}</h3>
            <div className="flex flex-wrap gap-x-[18px] gap-y-[11px] pt-[16px]">
              {allColors.map((color) => {
                const isSelected = selectedColors.includes(color)
                return (
                  <button
                    key={color}
                    type="button"
                    onClick={() => onColorToggle(color)}
                    aria-pressed={isSelected}
                    className="group flex items-center gap-[7px] transition-opacity hover:opacity-70"
                  >
                    <span
                      className={`flex size-[36px] shrink-0 items-center justify-center rounded-full transition-colors ${
                        isSelected ? 'border-2 border-sako-ink-900' : 'border border-border-subtle'
                      }`}
                    >
                      <span
                        className="block size-[32px] rounded-full border border-border-subtle"
                        style={{ backgroundColor: getColorHex(color) }}
                      />
                    </span>
                    <span className="font-ploni text-[9px] tracking-[0.72px] text-text-primary">
                      {getColorLabel(color)}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Sub-categories, 438:3205 — two columns of plain labels. */}
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
                        className={`flex h-[28px] items-center text-start font-ploni text-[16px] transition-opacity hover:opacity-70 ${
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
