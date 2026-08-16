'use client'

interface DerivedValueHintProps {
  /** Human-readable computed value, or null when the inputs are missing. */
  computed: string | null
  /** True when the admin has typed an override that differs from `computed`. */
  isOverridden: boolean
  onClearOverride: () => void
  /** What the value is computed from, shown when nothing could be computed. */
  requires?: string
}

/**
 * Shown beneath a derived bag field (size category, fits A4, …) to explain
 * where its value came from.
 *
 * Three states, because the distinction matters when someone is auditing a
 * bag: computed and accepted, computed but overridden by hand, or not
 * computable because the dimensions are missing. The last one is a prompt to go
 * fill in the dimensions rather than to guess this field directly.
 */
export default function DerivedValueHint({
  computed,
  isOverridden,
  onClearOverride,
  requires = 'height, width and depth',
}: DerivedValueHintProps) {
  if (computed === null) {
    return <p className="mt-1 text-xs text-gray-500">Calculated from {requires} — not enough data yet.</p>
  }

  if (isOverridden) {
    return (
      <p className="mt-1 text-xs text-amber-600">
        Overriding the calculated value ({computed}).{' '}
        <button
          type="button"
          onClick={onClearOverride}
          className="underline hover:text-amber-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded"
        >
          Use calculated
        </button>
      </p>
    )
  }

  return <p className="mt-1 text-xs text-gray-500">Calculated: {computed}</p>
}
