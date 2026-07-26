'use client'

import type { CategoryFieldGroup } from '@/lib/product-enums'

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
  pattern_en?: string
  pattern_he?: string
  finish_en?: string
  finish_he?: string
  closureType_en?: string
  closureType_he?: string
  heelType_en?: string
  heelType_he?: string
  careInstructions_en?: string
  careInstructions_he?: string
}

interface ProductSpecificationsSectionProps {
  values: ProductSpecificationsValues
  onChange: (field: keyof ProductSpecificationsValues, value: string | number | undefined) => void
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
 * Product Specifications — reuses the existing material/lining/sole/dimensions/heel-height
 * text fields, and adds structured toe shape, pattern, finish, closure, heel type,
 * and care instructions (each as Hebrew/English pairs). Heel-specific and lining/sole
 * fields are only shown for the category groups where they're relevant.
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
        <TextField
          id="upperMaterial"
          labelEn="Material"
          labelHe="חומר"
          valueEn={values.upperMaterial_en}
          valueHe={values.upperMaterial_he}
          placeholderEn="e.g., Leather Combination"
          placeholderHe="לדוגמה: שילוב עור"
          onChange={onTextFieldChange}
        />

        {showSoleAndLining && (
          <>
            <TextField
              id="materialInnerSole"
              labelEn="Inner Sole Material"
              labelHe="חומר מדרס"
              valueEn={values.materialInnerSole_en}
              valueHe={values.materialInnerSole_he}
              placeholderEn="e.g., Leather"
              placeholderHe="לדוגמה: עור"
              onChange={onTextFieldChange}
            />
            <TextField
              id="lining"
              labelEn="Lining Material"
              labelHe="חומר בטנה"
              valueEn={values.lining_en}
              valueHe={values.lining_he}
              placeholderEn="e.g., 100% Textile"
              placeholderHe="לדוגמה: 100% טקסטיל"
              onChange={onTextFieldChange}
            />
            <TextField
              id="sole"
              labelEn="Sole Material"
              labelHe="חומר סוליה"
              valueEn={values.sole_en}
              valueHe={values.sole_he}
              placeholderEn="e.g., Rubber Sole"
              placeholderHe="לדוגמה: סוליה מגומי"
              onChange={onTextFieldChange}
            />
          </>
        )}

        <TextField
          id="pattern"
          labelEn="Pattern"
          labelHe="דוגמה"
          valueEn={values.pattern_en ?? ''}
          valueHe={values.pattern_he ?? ''}
          placeholderEn="e.g., Solid, Striped, Animal print"
          placeholderHe="לדוגמה: אחיד, פסים, הדפס אנימל"
          onChange={onTextFieldChange}
        />
        <TextField
          id="finish"
          labelEn="Finish"
          labelHe="גימור"
          valueEn={values.finish_en ?? ''}
          valueHe={values.finish_he ?? ''}
          placeholderEn="e.g., Matte, Glossy, Metallic"
          placeholderHe="לדוגמה: מט, מבריק, מטאלי"
          onChange={onTextFieldChange}
        />

        {showClosure && (
          <TextField
            id="closureType"
            labelEn="Closure Type"
            labelHe="סוג סגירה"
            valueEn={values.closureType_en ?? ''}
            valueHe={values.closureType_he ?? ''}
            placeholderEn="e.g., Buckle, Zipper, Slip-on"
            placeholderHe="לדוגמה: אבזם, רוכסן, ללא סגירה"
            onChange={onTextFieldChange}
          />
        )}

        {showHeelFields && (
          <>
            <TextField
              id="heelType"
              labelEn="Heel Type"
              labelHe="סוג עקב"
              valueEn={values.heelType_en ?? ''}
              valueHe={values.heelType_he ?? ''}
              placeholderEn="e.g., Stiletto, Block, Wedge"
              placeholderHe="לדוגמה: עקב מחט, עקב עבה, טריז"
              onChange={onTextFieldChange}
            />
            <TextField
              id="heelHeight"
              labelEn="Heel Height"
              labelHe="גובה עקב"
              valueEn={values.heelHeight_en}
              valueHe={values.heelHeight_he}
              placeholderEn="e.g., 5cm"
              placeholderHe="לדוגמה: 5 ס״מ"
              onChange={onTextFieldChange}
            />
            <TextField
              id="toeShape"
              labelEn="Toe Shape"
              labelHe="צורת קדמת הנעל"
              valueEn={values.toeShape_en ?? ''}
              valueHe={values.toeShape_he ?? ''}
              placeholderEn="e.g., Pointed, Round, Square"
              placeholderHe="לדוגמה: מחודדת, עגולה, מרובעת"
              onChange={onTextFieldChange}
            />
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

        <div>
          <label htmlFor="careInstructions_en" className="block text-sm font-medium text-gray-700">
            Care Instructions (English)
          </label>
          <textarea
            id="careInstructions_en"
            dir="ltr"
            rows={2}
            value={values.careInstructions_en ?? ''}
            onChange={(e) => onChange('careInstructions_en', e.target.value)}
            className={fieldClass}
            placeholder="e.g., Wipe clean with a soft, dry cloth"
          />
        </div>
        <div>
          <label htmlFor="careInstructions_he" className="block text-sm font-medium text-gray-700">
            Care Instructions (Hebrew)
          </label>
          <textarea
            id="careInstructions_he"
            dir="rtl"
            rows={2}
            value={values.careInstructions_he ?? ''}
            onChange={(e) => onChange('careInstructions_he', e.target.value)}
            className={fieldClass}
            placeholder="לדוגמה: לנקות במטלית רכה ויבשה"
          />
        </div>
      </div>
    </div>
  )
}
