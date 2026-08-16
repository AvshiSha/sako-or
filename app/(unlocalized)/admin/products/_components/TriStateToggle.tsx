'use client'

interface TriStateToggleProps {
  id: string
  label: string
  helperText?: string
  value: boolean | null | undefined
  onChange: (value: boolean | null) => void
  labelYes?: string
  labelNo?: string
  labelUnknown?: string
}

const OPTION_BASE =
  'px-3 py-1.5 text-sm border transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:z-10'

/**
 * Yes / No / Not specified, for bag attributes that are genuinely unknown on
 * most existing products.
 *
 * A plain checkbox can't express this: unchecked would mean both "this bag has
 * no protective base feet" and "nobody has looked", and the two are not the
 * same claim. The unspecified state is the default and maps to `null`, which
 * is then simply omitted from the product page and the assistant's data rather
 * than asserted as false.
 */
export default function TriStateToggle({
  id,
  label,
  helperText,
  value,
  onChange,
  labelYes = 'Yes',
  labelNo = 'No',
  labelUnknown = 'Not specified',
}: TriStateToggleProps) {
  const options: { key: string; optionValue: boolean | null; text: string }[] = [
    { key: 'yes', optionValue: true, text: labelYes },
    { key: 'no', optionValue: false, text: labelNo },
    { key: 'unknown', optionValue: null, text: labelUnknown },
  ]

  // Treat undefined and null identically — both mean "not specified".
  const current = value ?? null

  return (
    <div>
      <span id={`${id}-label`} className="block text-sm font-medium text-gray-700">
        {label}
      </span>
      <div className="mt-1 inline-flex rounded-md shadow-sm" role="group" aria-labelledby={`${id}-label`}>
        {options.map((option, index) => {
          const active = current === option.optionValue
          const first = index === 0
          const last = index === options.length - 1
          return (
            <button
              key={option.key}
              type="button"
              onClick={() => onChange(option.optionValue)}
              aria-pressed={active}
              className={`${OPTION_BASE} ${first ? 'rounded-l-md' : ''} ${last ? 'rounded-r-md' : ''} ${
                last ? '' : '-mr-px'
              } ${
                active
                  ? 'bg-indigo-100 border-indigo-300 text-indigo-800'
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {option.text}
            </button>
          )
        })}
      </div>
      {helperText && <p className="mt-1 text-xs text-gray-500">{helperText}</p>}
    </div>
  )
}
