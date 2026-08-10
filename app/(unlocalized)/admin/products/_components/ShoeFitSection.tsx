'use client'

import EnumSelect from './EnumSelect'
import MultiSelectChips from './MultiSelectChips'
import PresetTextField from './PresetTextField'
import { SIZING_RECOMMENDATION_PRESETS } from '@/lib/product-text-presets'
import {
  SIZE_FIT_OPTIONS,
  FOOT_WIDTH_FIT_OPTIONS,
  ARCH_FIT_OPTIONS,
  ADJUSTABLE_FEATURE_OPTIONS,
  type SizeFit,
  type FootWidthFit,
  type ArchFit,
  type AdjustableFeature,
} from '@/lib/product-enums'

export interface ShoeFitValues {
  sizeFit?: SizeFit
  footWidthFit?: FootWidthFit
  archFit?: ArchFit
  adjustableFeatures: AdjustableFeature[]
  recommendation_en?: string
  recommendation_he?: string
  notes_en?: string
  notes_he?: string
}

interface ShoeFitSectionProps {
  values: ShoeFitValues
  onChange: <K extends keyof ShoeFitValues>(field: K, value: ShoeFitValues[K]) => void
}

const textFieldClass =
  'mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-400 text-gray-700'

/**
 * Shoe Fit and Sizing — only rendered for footwear categories (see
 * getCategoryFieldGroup in lib/product-enums.ts). Values persist even while
 * hidden, so switching a product away from footwear never silently deletes fit data.
 */
export default function ShoeFitSection({ values, onChange }: ShoeFitSectionProps) {
  return (
    <div>
      <h2 className="text-lg font-medium text-gray-900 mb-1">Shoe Fit and Sizing</h2>
      <p className="text-sm text-gray-500 mb-4">
        Only shown for footwear products. Helps customers pick the right size and style.
      </p>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <EnumSelect
          id="sizeFit"
          label="Size Fit"
          locale="en"
          value={values.sizeFit}
          onChange={(value) => onChange('sizeFit', value)}
          options={SIZE_FIT_OPTIONS}
          placeholder="Select size fit"
          helperText="Does this style run small, true to size or large compared with standard sizing?"
        />
        <EnumSelect
          id="footWidthFit"
          label="Recommended Foot Width"
          locale="en"
          value={values.footWidthFit}
          onChange={(value) => onChange('footWidthFit', value)}
          options={FOOT_WIDTH_FIT_OPTIONS}
          placeholder="Select recommended foot width"
          helperText="Select the foot width this style fits best. This information helps customers choose a suitable size and style."
        />
        <EnumSelect
          id="archFit"
          label="Arch Fit (optional)"
          locale="en"
          value={values.archFit}
          onChange={(value) => onChange('archFit', value)}
          options={ARCH_FIT_OPTIONS}
          placeholder="Select arch fit"
          helperText="Only set this if the business can reliably define it — avoid medical or orthopedic claims."
        />

        <div className="sm:col-span-2">
          <MultiSelectChips
            label="Adjustable Features"
            locale="en"
            values={values.adjustableFeatures}
            onChange={(value) => onChange('adjustableFeatures', value)}
            options={ADJUSTABLE_FEATURE_OPTIONS}
          />
        </div>

        <PresetTextField
          idPrefix="fitRecommendation"
          labelEn="Sizing Recommendation"
          labelHe="המלצת מידה"
          valueEn={values.recommendation_en ?? ''}
          valueHe={values.recommendation_he ?? ''}
          onChangeEn={(value) => onChange('recommendation_en', value)}
          onChangeHe={(value) => onChange('recommendation_he', value)}
          presets={SIZING_RECOMMENDATION_PRESETS}
          placeholderEn="This style fits true to size. We recommend selecting your usual size."
          placeholderHe="הדגם מידה במידה. מומלץ לבחור במידה הרגילה שלך."
          rows={2}
          hideTextareas
        />

        <div>
          <label htmlFor="fitNotes_en" className="block text-sm font-medium text-gray-700">
            Fit Notes (English, optional)
          </label>
          <textarea
            id="fitNotes_en"
            dir="ltr"
            rows={2}
            value={values.notes_en ?? ''}
            onChange={(e) => onChange('notes_en', e.target.value)}
            className={textFieldClass}
            placeholder="Model-specific fit information that doesn't fit the structured options"
          />
        </div>
        <div>
          <label htmlFor="fitNotes_he" className="block text-sm font-medium text-gray-700">
            Fit Notes (Hebrew, optional)
          </label>
          <textarea
            id="fitNotes_he"
            dir="rtl"
            rows={2}
            value={values.notes_he ?? ''}
            onChange={(e) => onChange('notes_he', e.target.value)}
            className={textFieldClass}
            placeholder="מידע ספציפי לדגם שלא מתאים לאפשרויות המובנות"
          />
        </div>
      </div>
    </div>
  )
}
