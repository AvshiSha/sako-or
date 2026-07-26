'use client'

import type { EnumOption } from '@/lib/product-enums'

interface EnumSelectProps<T extends string> {
  id: string
  label: string
  helperText?: string
  value: T | undefined
  onChange: (value: T) => void
  options: EnumOption<T>[]
  locale: 'en' | 'he'
  error?: string
  placeholder?: string
}

/** Generic single-select for the shoe-fit enums, styled to match the existing product form. */
export default function EnumSelect<T extends string>({
  id,
  label,
  helperText,
  value,
  onChange,
  options,
  locale,
  error,
  placeholder,
}: EnumSelectProps<T>) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      <select
        id={id}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value as T)}
        className={`mt-1 block w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 ${
          error ? 'border-red-300' : 'border-gray-300'
        }`}
      >
        <option value="" className="text-gray-600">
          {placeholder ?? 'Select…'}
        </option>
        {options.map((option) => (
          <option key={option.value} value={option.value} className="text-gray-900">
            {locale === 'he' ? option.label_he : option.label_en}
          </option>
        ))}
      </select>
      {helperText && <p className="mt-1 text-xs text-gray-500">{helperText}</p>}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  )
}
