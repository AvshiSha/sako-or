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
} from '@/lib/product-enums'
import { CARE_INSTRUCTIONS_PRESETS } from '@/lib/product-text-presets'
import PresetTextField from './PresetTextField'
import EnumSelect from './EnumSelect'
import MultiSelectChips from './MultiSelectChips'
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
}

type SpecificationFieldValue = string | number | string[] | undefined

interface ProductSpecificationsSectionProps {
  values: ProductSpecificationsValues
  onChange: (field: keyof ProductSpecificationsValues, value: SpecificationFieldValue) => void
  fieldGroup: CategoryFieldGroup
}

const fieldClass =
  'mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-400 text-gray-700'

function TextField({
  id,
  labelEn,
  labelHe,
  valueEn,
  valueHe,
  placeholderEn,
  placeholderHe,
  onChange,
}: {
  id: string
  labelEn: string
  labelHe: string
  valueEn: string
  valueHe: string
  placeholderEn: string
  placeholderHe: string
  onChange: (field: string, value: string) => void
}) {
  return (
    <>
      <div>
        <label htmlFor={`${id}_en`} className="block text-sm font-medium text-gray-700">
          {labelEn} (English)
        </label>
        <input
          type="text"
          id={`${id}_en`}
          dir="ltr"
          value={valueEn}
          onChange={(e) => onChange(`${id}_en`, e.target.value)}
          className={fieldClass}
          placeholder={placeholderEn}
        />
      </div>
      <div>
        <label htmlFor={`${id}_he`} className="block text-sm font-medium text-gray-700">
          {labelHe} (Hebrew)
        </label>
        <input
          type="text"
          id={`${id}_he`}
          dir="rtl"
          value={valueHe}
          onChange={(e) => onChange(`${id}_he`, e.target.value)}
          className={fieldClass}
          placeholder={placeholderHe}
        />
      </div>
    </>
  )
}

/**
 * Product Specifications — dropdown-backed attribute fields (Upper Material,
 * Lining, Insole, Outsole, Sole Type, Toe Shape, Heel Type, Closure Type, Heel
 * Height), plus free-text dimensions and care instructions. Each dropdown
 * stores a single stable value (or an array for Upper Material); Hebrew/English
 * labels are resolved from lib/product-enums.ts, never persisted. A
 * PreviousValueHint surfaces the old free-text value next to any dropdown that
 * hasn't been reconciled yet. Heel-specific and lining/sole/insole fields are
 * only shown for the category groups where they're relevant.
 */
export default function ProductSpecificationsSection({
  values,
  onChange,
  fieldGroup,
}: ProductSpecificationsSectionProps) {
  const showSoleAndLining = fieldGroup === 'shoes' || fieldGroup === 'bags'
  const showHeelFields = fieldGroup === 'shoes'
  const showClosure = fieldGroup === 'shoes' || fieldGroup === 'bags' || fieldGroup === 'belts'

  const onTextFieldChange = (field: string, value: string) =>
    onChange(field as keyof ProductSpecificationsValues, value)

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

        {showSoleAndLining && (
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
              options={CLOSURE_TYPE_OPTIONS}
              placeholder="Select closure type"
            />
            {!values.closureType && (
              <PreviousValueHint legacyEn={values.closureType_en} legacyHe={values.closureType_he} />
            )}
          </div>
        )}

        {showHeelFields && (
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

        <TextField
          id="height"
          labelEn="Height"
          labelHe="גובה"
          valueEn={values.height_en}
          valueHe={values.height_he}
          placeholderEn="e.g., 25cm"
          placeholderHe="לדוגמה: 25 ס״מ"
          onChange={onTextFieldChange}
        />
        <TextField
          id="width"
          labelEn="Width"
          labelHe="רוחב"
          valueEn={values.width_en}
          valueHe={values.width_he}
          placeholderEn="e.g., 10cm"
          placeholderHe="לדוגמה: 10 ס״מ"
          onChange={onTextFieldChange}
        />
        <TextField
          id="depth"
          labelEn="Depth"
          labelHe="עומק"
          valueEn={values.depth_en}
          valueHe={values.depth_he}
          placeholderEn="e.g., 15cm"
          placeholderHe="לדוגמה: 15 ס״מ"
          onChange={onTextFieldChange}
        />

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
