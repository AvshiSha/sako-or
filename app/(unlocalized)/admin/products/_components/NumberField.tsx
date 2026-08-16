'use client'

interface NumberFieldProps {
  id: string
  label: string
  helperText?: string
  /** `null` means "not measured" and renders as an empty input. */
  value: number | null | undefined
  onChange: (value: number | null) => void
  min?: number
  max?: number
  step?: number
  /** Shown inside the input's trailing edge, e.g. `cm`, `g`. */
  unit?: string
  placeholder?: string
  error?: string
}

const fieldClass =
  'mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-400 text-gray-700'

/**
 * Numeric input for measurements and counts, styled to match the rest of the
 * product form.
 *
 * The one thing it does that a raw `<input type="number">` does not: an empty
 * input reports `null`, never `0`. Everywhere else in this form the pattern is
 * `parseFloat(e.target.value) || 0`, which is right for a price but wrong for a
 * specification — it would turn "nobody has measured this bag" into "this bag
 * is 0 cm deep", and that value then flows into derived capacity, the product
 * page and the assistant's answers as though it were a fact.
 */
export default function NumberField({
  id,
  label,
  helperText,
  value,
  onChange,
  min = 0,
  max,
  step = 0.5,
  unit,
  placeholder,
  error,
}: NumberFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      <div className="relative">
        <input
          type="number"
          id={id}
          dir="ltr"
          inputMode="decimal"
          value={value ?? ''}
          min={min}
          max={max}
          step={step}
          placeholder={placeholder}
          onChange={(event) => {
            const raw = event.target.value.trim()
            if (raw === '') {
              onChange(null)
              return
            }
            const parsed = Number(raw)
            onChange(Number.isFinite(parsed) ? parsed : null)
          }}
          className={`${fieldClass} ${unit ? 'pr-12' : ''}`}
        />
        {unit && (
          <span className="pointer-events-none absolute inset-y-0 right-3 top-1 flex items-center text-sm text-gray-400">
            {unit}
          </span>
        )}
      </div>
      {helperText && <p className="mt-1 text-xs text-gray-500">{helperText}</p>}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  )
}
