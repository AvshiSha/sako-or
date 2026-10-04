'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'
import { Input, type InputProps } from './input'

/**
 * "Form Input Field", checkout 438:2751.
 *
 * A 54px cell with a 9px caption stacked over a 14px value and a single hairline
 * closing it off underneath — there is no box. The rule is the control's only
 * visible edge, so it lives here rather than on the <input>, which stays
 * transparent (see the `sako` variant in ./input).
 *
 * text-start rather than the frame's items-end: the frame is drawn in Hebrew, so
 * "end" there is the reading start. Mirrored this way the English storefront puts
 * its captions on the left where they belong.
 *
 * GAP: 438:2751 is a lone symbol with no variants — the design system ships
 * exactly one input state. There is no focused, disabled or filled design, the
 * same omission the DS audit (438:7670) owns up to for the size selector and the
 * stepper boundaries. The three states below are therefore defined here, built
 * only from vocabulary the system already uses so they do not read as foreign:
 *
 *   - focus    the rule, which IS the control, thickens 1px -> 2px in ink-900.
 *              pb-px drops to pb-0 at the same time so the cell stays exactly
 *              54px and nothing below it moves. No ring and no glow: this system
 *              draws no shadows and rounds nothing.
 *   - error    the rule turns accent-error and the message sits under it. Already
 *              the behaviour contact and checkout rely on.
 *   - disabled the rule drops to border-subtle and the type to gray-500 — the
 *              same flat-grey "unavailable" the CTA uses (438:7683 disabled), not
 *              a 50% fade.
 *
 * Done with :has()/group-has rather than React state so a passed-in child — a
 * <select>, a textarea, the phone input — gets the same states for free.
 */

export interface FieldProps extends Omit<InputProps, 'variant'> {
  /** The 9px caption above the value (438:2752). */
  label: string
  /** Wrapper class — pass grid placement and width here, not on the input. */
  fieldClassName?: string
  /**
   * Class for the 54px cell itself, for the rare control that cannot be one
   * line — the contact form's message box passes `h-auto` here. `cn` is
   * tailwind-merge, so a height passed in replaces the default rather than
   * fighting it. Checkout passes nothing and is unaffected.
   */
  cellClassName?: string
  /** Shown under the rule and turns it red. Also wires aria-invalid. */
  error?: string | null
  /** Renders something other than an <input> in the value slot, e.g. a <select>. */
  children?: React.ReactNode
}

const Field = React.forwardRef<HTMLInputElement, FieldProps>(
  (
    { label, id, fieldClassName, cellClassName, className, error, children, required, ...props },
    ref
  ) => {
    const generatedId = React.useId()
    const fieldId = id || generatedId
    const errorId = error ? `${fieldId}-error` : undefined

    return (
      <div className={cn('flex flex-col', fieldClassName)}>
        <div
          className={cn(
            // pb-px, not pb-0: the frame insets the rule by a pixel so a descender
            // in the value never touches it. On focus the border takes that pixel
            // back, which is why the two always change together.
            'group flex h-[54px] flex-col gap-[10px] border-b pb-px text-start transition-[border-color]',
            error ? 'border-accent-error' : 'border-border-default',
            'has-[:focus-visible]:border-b-2 has-[:focus-visible]:border-sako-ink-900 has-[:focus-visible]:pb-0',
            'has-[:disabled]:border-border-subtle',
            cellClassName
          )}
        >
          <label
            htmlFor={fieldId}
            className="font-ploni text-[9px] leading-none text-text-secondary group-has-[:disabled]:text-sako-gray-500"
          >
            {label}
            {required && <span aria-hidden="true"> *</span>}
          </label>

          {children ?? (
            <Input
              ref={ref}
              id={fieldId}
              variant="sako"
              required={required}
              aria-invalid={error ? true : undefined}
              aria-describedby={errorId}
              className={className}
              {...props}
            />
          )}
        </div>

        {error && (
          <p id={errorId} role="alert" className="pt-[6px] font-ploni text-[12px] text-accent-error">
            {error}
          </p>
        )}
      </div>
    )
  }
)
Field.displayName = 'Field'

/**
 * A native <select> dressed as the field's value line, for use as a Field child.
 *
 * Native rather than the Radix Select the old sign-up used: inside a control
 * whose entire visual identity is one hairline, a floating popover with its own
 * border, radius and shadow is the one element on the page that would look
 * borrowed. The platform picker also costs no JS and is what a phone user
 * expects. `appearance-none` removes the OS chevron — the caret is drawn by the
 * caller as a rotated U+2199, the same arrow the CTAs use.
 *
 * Empty value renders in text-secondary so an unchosen select reads as a
 * placeholder, matching the input's placeholder colour.
 */
export const FIELD_SELECT =
  'w-full flex-1 cursor-pointer appearance-none border-0 bg-transparent p-0 font-ploni text-[14px] leading-none text-text-primary outline-none focus-visible:outline-none disabled:cursor-not-allowed disabled:text-sako-gray-500'

export { Field }
