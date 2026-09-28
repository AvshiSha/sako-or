'use client'

/**
 * Quantity stepper, design system 438:4667.
 *
 * A 89x31 box: three 29px cells inside a 1px frame, divided by hairlines, with the
 * decrement on the left and the increment on the right. The same control appears on
 * the PDP (mobile and desktop), in the cart and in the add-to-cart modal, which
 * between them carried four separate hand-rolled copies before this.
 */

const CELL =
  'flex h-[29px] w-[29px] items-center justify-center font-ploni text-[12px] leading-none text-text-primary transition-opacity disabled:cursor-not-allowed disabled:opacity-40'

export default function QuantityStepper({
  value,
  min = 1,
  max,
  onChange,
  language = 'he',
  disabled = false,
  className = '',
}: {
  value: number
  min?: number
  /** Usually the stock for the selected size. Omitted, the control has no ceiling. */
  max?: number
  onChange: (next: number) => void
  language?: 'en' | 'he'
  disabled?: boolean
  className?: string
}) {
  const isHe = language === 'he'
  const atMin = disabled || value <= min
  const atMax = disabled || (typeof max === 'number' && value >= max)

  return (
    // dir="ltr" on purpose. The control is numeric, not textual, and the frame puts
    // decrement left / increment right. Left to inherit the page's RTL the two would
    // swap, which reads as a bug rather than as localisation - the same reason the
    // nav bar and the footer's bottom row are pinned LTR.
    <div
      dir="ltr"
      className={`inline-grid grid-cols-[29px_29px_29px] border border-border-default p-px ${className}`}
    >
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={atMin}
        aria-label={isHe ? 'הפחתת כמות' : 'Decrease quantity'}
        className={CELL}
      >
        {/* U+2212 minus sign, not a hyphen: the frame's glyph, and it optically
            matches the + at the same size where a hyphen sits short and light. */}
        &#8722;
      </button>

      {/* Not an input. The design is a display cell, and the value is always driven by
          the two buttons against live stock, so a free-text field would only add a
          parse-and-clamp path with no affordance in the design to hang it on. */}
      <output
        aria-live="polite"
        aria-label={isHe ? 'כמות' : 'Quantity'}
        className={`${CELL} border-l border-border-default tabular-nums`}
      >
        {value}
      </output>

      <button
        type="button"
        onClick={() => onChange(typeof max === 'number' ? Math.min(max, value + 1) : value + 1)}
        disabled={atMax}
        aria-label={isHe ? 'הוספת כמות' : 'Increase quantity'}
        className={`${CELL} border-l border-border-default`}
      >
        +
      </button>
    </div>
  )
}
