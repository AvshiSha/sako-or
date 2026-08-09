'use client'

import { PRODUCT_IMAGE_TYPE_OPTIONS, type ProductImageType } from '@/lib/product-enums'

export interface ProductImageSeoValues {
  altEn?: string
  altHe?: string
  type?: ProductImageType
}

interface ProductImageSeoFieldsProps {
  values: ProductImageSeoValues
  onChange: (updates: ProductImageSeoValues) => void
}

const smallFieldClass =
  'mt-0.5 block w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-gray-400 text-gray-700'

/** Per-image alt text (Hebrew + English) and image type/view, dropped under each thumbnail in the color-variant image list. */
export default function ProductImageSeoFields({ values, onChange }: ProductImageSeoFieldsProps) {
  return (
    <div className="mt-2 space-y-1">
      <input
        type="text"
        dir="ltr"
        value={values.altEn ?? ''}
        onChange={(e) => onChange({ ...values, altEn: e.target.value })}
        className={smallFieldClass}
        placeholder="Alt text (English)"
        aria-label="Image alt text (English)"
      />
      <input
        type="text"
        dir="rtl"
        value={values.altHe ?? ''}
        onChange={(e) => onChange({ ...values, altHe: e.target.value })}
        className={smallFieldClass}
        placeholder="טקסט חלופי (עברית)"
        aria-label="Image alt text (Hebrew)"
      />
      <select
        value={values.type ?? ''}
        onChange={(e) => onChange({ ...values, type: (e.target.value || undefined) as ProductImageType | undefined })}
        className={smallFieldClass}
        aria-label="Image type"
      >
        <option value="">Image type…</option>
        {PRODUCT_IMAGE_TYPE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label_en}
          </option>
        ))}
      </select>
    </div>
  )
}
