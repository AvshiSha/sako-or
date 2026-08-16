'use client'

import type {
  CategoryFieldGroup,
  UpperMaterial,
  Lining,
  Insole,
  Outsole,
  ToeShape,
  HeelType,
  ClosureType,
  SoleType,
  HeelHeightCm,
} from '@/lib/product-enums'
import {
  UPPER_MATERIAL_OPTIONS,
  LINING_OPTIONS,
  INSOLE_OPTIONS,
  OUTSOLE_OPTIONS,
  TOE_SHAPE_OPTIONS,
  HEEL_TYPE_OPTIONS,
  CLOSURE_TYPE_OPTIONS,
  SOLE_TYPE_OPTIONS,
  HEEL_HEIGHT_CM_OPTIONS,
  optionsForGroup,
} from '@/lib/product-enums'
import { CARE_INSTRUCTIONS_PRESETS } from '@/lib/product-text-presets'
import PresetTextField from './PresetTextField'
import EnumSelect from './EnumSelect'
import MultiSelectChips from './MultiSelectChips'
import NumberField from './NumberField'
import PreviousValueHint from './PreviousValueHint'

export interface ProductSpecificationsValues {
  upperMaterial_en: string
  upperMaterial_he: string
  materialInnerSole_en: string
  materialInnerSole_he: string
  lining_en: string
  lining_he: string
  sole_en: string
  sole_he: string
  heelHeight_en: string
  heelHeight_he: string
  /** Legacy free-text dimensions. No longer editable — kept so their old values
   * can still be shown via PreviousValueHint next to the numeric fields that
   * replaced them, until every product has been reconciled. */
  height_en: string
  height_he: string
  depth_en: string
  depth_he: string
  width_en: string
  width_he: string
  toeShape_en?: string
  toeShape_he?: string
  closureType_en?: string
  closureType_he?: string
  heelType_en?: string
  heelType_he?: string
  careInstructions_en?: string
  careInstructions_he?: string
  // Dropdown-backed attribute fields (replace the free-text pairs above). The
  // legacy _en/_he pairs stay in ProductSpecificationsValues purely so their
  // old text can still be shown via PreviousValueHint for reconciliation.
  upperMaterial: UpperMaterial[]
  lining?: Lining
  insole?: Insole
  outsole?: Outsole
  soleType?: SoleType
  toeShape?: ToeShape
  heelType?: HeelType
  closureType?: ClosureType
  heelHeight?: HeelHeightCm
  // Structured measurements, replacing the free-text pairs above. Shown for
  // every non-shoe field group. null means "not measured", never 0.
  heightCm?: number | null
  widthCm?: number | null
  depthCm?: number | null
  weightGrams?: number | null
}

type SpecificationFieldValue = string | number | string[] | null | undefined

interface ProductSpecificationsSectionProps {
  values: ProductSpecificationsValues
  onChange: (field: keyof ProductSpecificationsValues, value: SpecificationFieldValue) => void
  fieldGroup: CategoryFieldGroup
}

/**
 * Product Specifications — dropdown-backed attribute fields (Upper Material,
 * Lining, Insole, Outsole, Sole Type, Toe Shape, Heel Type, Closure Type, Heel
 * Height), plus free-text dimensions and care instructions. Each dropdown
 * stores a single stable value (or an array for Upper Material); Hebrew/English
 * labels are resolved from lib/product-enums.ts, never persisted. A
 * PreviousValueHint surfaces the old free-text value next to any dropdown that
 * hasn't been reconciled yet.
 *
 * Field visibility is dynamic based on product type (fieldGroup, derived from
 * the selected category): shoe-only attributes (Insole, Outsole, Sole Type, Toe
 * Shape, Heel Type, Heel Height) show only for footwear; Lining shows for shoes
 * and bags; dimensions (Height/Width/Depth) and Weight show only for
 * non-footwear (bags/belts/wallets/other), since they don't apply to shoes;
 * Closure Type stays category-conditional (shoes/bags/belts) and narrows its own
 * options to that group; Upper Material is always shown since it applies to
 * nearly every product type. Hidden fields keep their saved value in
 * formData — visibility is purely a rendering concern, never a data reset.
 */
export default function ProductSpecificationsSection({
  values,
  onChange,
  fieldGroup,
}: ProductSpecificationsSectionProps) {
  const showShoeAttributes = fieldGroup === 'shoes'
  const showLining = fieldGroup === 'shoes' || fieldGroup === 'bags'
  const showDimensions = fieldGroup !== 'shoes'
  const showClosure = fieldGroup === 'shoes' || fieldGroup === 'bags' || fieldGroup === 'belts'
  // A shoe never has a turn-lock; a bag never has laces. Same stored field,
  // different vocabulary per product type.
  const closureOptions = optionsForGroup(CLOSURE_TYPE_OPTIONS, fieldGroup)

  return (
    <div>
      <h2 className="text-lg font-medium text-gray-900 mb-4">Product Specifications</h2>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <MultiSelectChips
            label="Upper Material"
            locale="en"
            showBothLanguages
            values={values.upperMaterial}
            onChange={(value) => onChange('upperMaterial', value)}
            options={UPPER_MATERIAL_OPTIONS}
          />
          {values.upperMaterial.length === 0 && (
            <PreviousValueHint legacyEn={values.upperMaterial_en} legacyHe={values.upperMaterial_he} />
          )}
        </div>

        {showShoeAttributes && (
          <>
            <div>
              <EnumSelect
                id="insole"
                label="Insole"
                locale="en"
                showBothLanguages
                value={values.insole}
                onChange={(value) => onChange('insole', value)}
                options={INSOLE_OPTIONS}
                placeholder="Select insole"
              />
              {!values.insole && (
                <PreviousValueHint legacyEn={values.materialInnerSole_en} legacyHe={values.materialInnerSole_he} />
              )}
            </div>
          </>
        )}

        {showLining && (
          <div>
            <EnumSelect
              id="lining"
              label="Lining"
              locale="en"
              showBothLanguages
              value={values.lining}
              onChange={(value) => onChange('lining', value)}
              options={LINING_OPTIONS}
              placeholder="Select lining"
            />
            {!values.lining && <PreviousValueHint legacyEn={values.lining_en} legacyHe={values.lining_he} />}
          </div>
        )}

        {showShoeAttributes && (
          <>
            <div>
              <EnumSelect
                id="outsole"
                label="Outsole"
                locale="en"
                showBothLanguages
                value={values.outsole}
                onChange={(value) => onChange('outsole', value)}
                options={OUTSOLE_OPTIONS}
                placeholder="Select outsole"
              />
              {!values.outsole && <PreviousValueHint legacyEn={values.sole_en} legacyHe={values.sole_he} />}
            </div>
            <EnumSelect
              id="soleType"
              label="Sole Type"
              locale="en"
              showBothLanguages
              value={values.soleType}
              onChange={(value) => onChange('soleType', value)}
              options={SOLE_TYPE_OPTIONS}
              placeholder="Select sole type"
            />
          </>
        )}

        {showClosure && (
          <div>
            <EnumSelect
              id="closureType"
              label="Closure Type"
              locale="en"
              showBothLanguages
              value={values.closureType}
              onChange={(value) => onChange('closureType', value)}
              options={closureOptions}
              placeholder="Select closure type"
            />
            {!values.closureType && (
              <PreviousValueHint legacyEn={values.closureType_en} legacyHe={values.closureType_he} />
            )}
          </div>
        )}

        {showShoeAttributes && (
          <>
            <div>
              <EnumSelect
                id="heelType"
                label="Heel Type"
                locale="en"
                showBothLanguages
                value={values.heelType}
                onChange={(value) => onChange('heelType', value)}
                options={HEEL_TYPE_OPTIONS}
                placeholder="Select heel type"
              />
              {!values.heelType && <PreviousValueHint legacyEn={values.heelType_en} legacyHe={values.heelType_he} />}
            </div>
            <div>
              <EnumSelect
                id="heelHeight"
                label="Heel Height"
                locale="en"
                showBothLanguages
                value={values.heelHeight}
                onChange={(value) => onChange('heelHeight', value)}
                options={HEEL_HEIGHT_CM_OPTIONS}
                placeholder="Select heel height"
              />
              {!values.heelHeight && (
                <PreviousValueHint legacyEn={values.heelHeight_en} legacyHe={values.heelHeight_he} />
              )}
            </div>
            <div>
              <EnumSelect
                id="toeShape"
                label="Toe Shape"
                locale="en"
                showBothLanguages
                value={values.toeShape}
                onChange={(value) => onChange('toeShape', value)}
                options={TOE_SHAPE_OPTIONS}
                placeholder="Select toe shape"
              />
              {!values.toeShape && <PreviousValueHint legacyEn={values.toeShape_en} legacyHe={values.toeShape_he} />}
            </div>
          </>
        )}

        {showDimensions && (
          <>
            <div className="sm:col-span-2">
              <h3 className="text-sm font-medium text-gray-900">Dimensions</h3>
              <p className="text-xs text-gray-500">
                Measured on the outside, in centimetres. Height is top to bottom, width is side to
                side, depth is front to back — mixing width and depth up is the most common mistake
                and changes what the site tells customers a bag can hold.
              </p>
            </div>
            <div>
              <NumberField
                id="heightCm"
                label="Height (גובה)"
                unit="cm"
                min={0}
                max={200}
                value={values.heightCm}
                onChange={(value) => onChange('heightCm', value)}
                placeholder="e.g. 18"
              />
              {values.heightCm === null || values.heightCm === undefined ? (
                <PreviousValueHint legacyEn={values.height_en} legacyHe={values.height_he} />
              ) : null}
            </div>
            <div>
              <NumberField
                id="widthCm"
                label="Width (רוחב)"
                unit="cm"
                min={0}
                max={200}
                value={values.widthCm}
                onChange={(value) => onChange('widthCm', value)}
                placeholder="e.g. 25"
              />
              {values.widthCm === null || values.widthCm === undefined ? (
                <PreviousValueHint legacyEn={values.width_en} legacyHe={values.width_he} />
              ) : null}
            </div>
            <div>
              <NumberField
                id="depthCm"
                label="Depth (עומק)"
                unit="cm"
                min={0}
                max={200}
                value={values.depthCm}
                onChange={(value) => onChange('depthCm', value)}
                placeholder="e.g. 13"
              />
              {values.depthCm === null || values.depthCm === undefined ? (
                <PreviousValueHint legacyEn={values.depth_en} legacyHe={values.depth_he} />
              ) : null}
            </div>
            <NumberField
              id="weightGrams"
              label="Weight"
              unit="g"
              min={0}
              max={20000}
              step={10}
              value={values.weightGrams}
              onChange={(value) => onChange('weightGrams', value)}
              placeholder="e.g. 620"
            />
          </>
        )}

        <PresetTextField
          idPrefix="careInstructions"
          labelEn="Care Instructions"
          labelHe="הוראות טיפוח"
          valueEn={values.careInstructions_en ?? ''}
          valueHe={values.careInstructions_he ?? ''}
          onChangeEn={(value) => onChange('careInstructions_en', value)}
          onChangeHe={(value) => onChange('careInstructions_he', value)}
          presets={CARE_INSTRUCTIONS_PRESETS}
          placeholderEn="e.g., Wipe clean with a soft, dry cloth"
          placeholderHe="לדוגמה: לנקות במטלית רכה ויבשה"
        />
      </div>
    </div>
  )
}
