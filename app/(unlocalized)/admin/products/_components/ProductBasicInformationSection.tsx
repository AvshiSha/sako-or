'use client'

export interface ProductBasicInformationValues {
  title_en: string
  title_he: string
  shortTitle_en?: string
  shortTitle_he?: string
  description_en: string
  description_he: string
  shortDescription_en?: string
  shortDescription_he?: string
}

export interface ProductBasicInformationErrors {
  title_en?: string
  title_he?: string
  description_en?: string
  description_he?: string
}

interface ProductBasicInformationSectionProps {
  values: ProductBasicInformationValues
  onChange: (field: keyof ProductBasicInformationValues, value: string) => void
  errors?: ProductBasicInformationErrors
}

const inputClass = (hasError?: boolean) =>
  `mt-1 block w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-400 text-gray-700 ${
    hasError ? 'border-red-300' : 'border-gray-300'
  }`

/** Basic Product Information section — reuses the existing title_en/he and description_en/he fields, and adds short title/description for cards and previews. */
export default function ProductBasicInformationSection({
  values,
  onChange,
  errors = {},
}: ProductBasicInformationSectionProps) {
  return (
    <div>
      <h2 className="text-lg font-medium text-gray-900 mb-4">Basic Product Information</h2>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="title_en" className="block text-sm font-medium text-gray-700">
            Product Name (English) *
          </label>
          <input
            type="text"
            id="title_en"
            dir="ltr"
            value={values.title_en}
            onChange={(e) => onChange('title_en', e.target.value)}
            className={inputClass(!!errors.title_en)}
            placeholder="e.g. Women's Silver Leather Pumps"
          />
          {errors.title_en && <p className="mt-1 text-sm text-red-600">{errors.title_en}</p>}
        </div>

        <div>
          <label htmlFor="title_he" className="block text-sm font-medium text-gray-700">
            Product Name (Hebrew) *
          </label>
          <input
            type="text"
            id="title_he"
            dir="rtl"
            value={values.title_he}
            onChange={(e) => onChange('title_he', e.target.value)}
            className={inputClass(!!errors.title_he)}
            placeholder="לדוגמה: נעלי סירה כסופות מעור לנשים"
          />
          {errors.title_he && <p className="mt-1 text-sm text-red-600">{errors.title_he}</p>}
        </div>

        <div>
          <label htmlFor="shortTitle_en" className="block text-sm font-medium text-gray-700">
            Short Product Name (English)
          </label>
          <input
            type="text"
            id="shortTitle_en"
            dir="ltr"
            value={values.shortTitle_en ?? ''}
            onChange={(e) => onChange('shortTitle_en', e.target.value)}
            className={inputClass()}
            placeholder="e.g. Silver Pumps"
          />
          <p className="mt-1 text-xs text-gray-500">
            Used on product cards and other places the full name is too long.
          </p>
        </div>

        <div>
          <label htmlFor="shortTitle_he" className="block text-sm font-medium text-gray-700">
            Short Product Name (Hebrew)
          </label>
          <input
            type="text"
            id="shortTitle_he"
            dir="rtl"
            value={values.shortTitle_he ?? ''}
            onChange={(e) => onChange('shortTitle_he', e.target.value)}
            className={inputClass()}
            placeholder="לדוגמה: נעלי סירה כסופות"
          />
          <p className="mt-1 text-xs text-gray-500">
            משמש בכרטיסי מוצר ובמקומות שבהם השם המלא ארוך מדי.
          </p>
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="shortDescription_en" className="block text-sm font-medium text-gray-700">
            Short Description (English)
          </label>
          <textarea
            id="shortDescription_en"
            dir="ltr"
            rows={2}
            value={values.shortDescription_en ?? ''}
            onChange={(e) => onChange('shortDescription_en', e.target.value)}
            className={inputClass()}
            placeholder="One or two sentence summary for listings and previews"
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="shortDescription_he" className="block text-sm font-medium text-gray-700">
            Short Description (Hebrew)
          </label>
          <textarea
            id="shortDescription_he"
            dir="rtl"
            rows={2}
            value={values.shortDescription_he ?? ''}
            onChange={(e) => onChange('shortDescription_he', e.target.value)}
            className={inputClass()}
            placeholder="תיאור קצר של משפט או שניים לרשימות ותצוגות מקדימות"
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="description_en" className="block text-sm font-medium text-gray-700">
            Full Description (English) *
          </label>
          <textarea
            id="description_en"
            dir="ltr"
            rows={4}
            value={values.description_en}
            onChange={(e) => onChange('description_en', e.target.value)}
            className={inputClass(!!errors.description_en)}
            placeholder="Full product description in English"
          />
          {errors.description_en && <p className="mt-1 text-sm text-red-600">{errors.description_en}</p>}
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="description_he" className="block text-sm font-medium text-gray-700">
            Full Description (Hebrew) *
          </label>
          <textarea
            id="description_he"
            dir="rtl"
            rows={4}
            value={values.description_he}
            onChange={(e) => onChange('description_he', e.target.value)}
            className={inputClass(!!errors.description_he)}
            placeholder="תיאור מוצר מלא בעברית"
          />
          {errors.description_he && <p className="mt-1 text-sm text-red-600">{errors.description_he}</p>}
        </div>
      </div>
    </div>
  )
}
