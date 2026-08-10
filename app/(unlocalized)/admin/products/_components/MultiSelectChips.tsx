'use client'

import type { EnumOption } from '@/lib/product-enums'

interface MultiSelectChipsProps<T extends string> {
  label: string
  helperText?: string
  values: T[]
  onChange: (values: T[]) => void
  options: EnumOption<T>[]
  locale: 'en' | 'he'
  /** Render "English / Hebrew" on every chip regardless of `locale`. */
  showBothLanguages?: boolean
}

/** Generic multi-select rendered as toggle chips, e.g. for adjustable shoe-fit features. */
export default function MultiSelectChips<T extends string>({
  label,
  helperText,
  values,
  onChange,
  options,
  locale,
  showBothLanguages,
}: MultiSelectChipsProps<T>) {
  const toggle = (value: T) => {
    if (values.includes(value)) {
      onChange(values.filter((existing) => existing !== value))
    } else {
      onChange([...values, value])
    }
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = values.includes(option.value)
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => toggle(option.value)}
              aria-pressed={active}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                active
                  ? 'bg-indigo-100 border-indigo-300 text-indigo-800'
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {showBothLanguages
                ? `${option.label_en} / ${option.label_he}`
                : locale === 'he'
                  ? option.label_he
                  : option.label_en}
            </button>
          )
        })}
      </div>
      {helperText && <p className="mt-1 text-xs text-gray-500">{helperText}</p>}
    </div>
  )
}
