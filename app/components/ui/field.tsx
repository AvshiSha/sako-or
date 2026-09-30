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
 */

export interface FieldProps extends Omit<InputProps, 'variant'> {
  /** The 9px caption above the value (438:2752). */
  label: string
  /** Wrapper class — pass grid placement and width here, not on the input. */
  fieldClassName?: string
  /** Shown under the rule and turns it red. Also wires aria-invalid. */
  error?: string | null
  /** Renders something other than an <input> in the value slot, e.g. a <select>. */
  children?: React.ReactNode
}

const Field = React.forwardRef<HTMLInputElement, FieldProps>(
  ({ label, id, fieldClassName, className, error, children, required, ...props }, ref) => {
    const generatedId = React.useId()
    const fieldId = id || generatedId
    const errorId = error ? `${fieldId}-error` : undefined

    return (
      <div className={cn('flex flex-col', fieldClassName)}>
        <div
          className={cn(
            // pb-px, not pb-0: the frame insets the rule by a pixel so a descender
            // in the value never touches it.
            'flex h-[54px] flex-col gap-[10px] border-b pb-px text-start',
            error ? 'border-accent-error' : 'border-border-default'
          )}
        >
          <label
            htmlFor={fieldId}
            className="font-ploni text-[9px] leading-none text-text-secondary"
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

export { Field }
