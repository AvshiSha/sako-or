'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { FIELD_VALUE_TEXT } from './input'

interface IsraelPhoneInputProps {
  value: string // Local number (8-9 digits) or with 0 prefix (0XXXXXXXXX), without +972
  onChange: (localNumber: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  /**
   * `sako` is the design system control: no box of its own, because it is meant
   * to sit inside <Field>, which draws the caption and the hairline. `default`
   * is the pre-redesign boxed control, kept for any consumer still on it.
   */
  variant?: 'default' | 'sako'
  id?: string
  'aria-invalid'?: boolean
  'aria-describedby'?: string
  autoComplete?: string
}

export function IsraelPhoneInput({
  value,
  onChange,
  placeholder = '0501234567 או 501234567',
  disabled = false,
  className,
  variant = 'default',
  id,
  autoComplete = 'tel',
  ...aria
}: IsraelPhoneInputProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Allow digits, accept both 0-prefixed (0XXXXXXXXX) and non-prefixed (XXXXXXXXX) formats
    // Max 10 digits if starting with 0, max 9 digits otherwise
    let digits = e.target.value.replace(/\D/g, '')

    // If starts with 0, allow up to 10 digits (0 + 8-9 digits)
    // Otherwise, allow up to 9 digits (8-9 digits)
    if (digits.startsWith('0')) {
      digits = digits.slice(0, 10)
    } else {
      digits = digits.slice(0, 9)
    }

    onChange(digits)
  }

  const isSako = variant === 'sako'

  const input = (
    <input
      ref={inputRef}
      id={id}
      type="tel"
      inputMode="numeric"
      pattern="[0-9]*"
      autoComplete={autoComplete}
      value={value}
      onChange={handleChange}
      placeholder={placeholder}
      disabled={disabled}
      className={cn(
        isSako
          ? `w-full flex-1 border-0 bg-transparent p-0 font-ploni ${FIELD_VALUE_TEXT} leading-none text-text-primary outline-none placeholder:text-text-secondary disabled:cursor-not-allowed disabled:text-sako-gray-500 disabled:placeholder:text-sako-gray-500`
          : `flex-1 bg-transparent px-3 py-2 ${FIELD_VALUE_TEXT} text-slate-900 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed`
      )}
      style={
        isSako
          ? // Two different things were conflated here before: which way the digits
            // run, and which edge the field sits on. Pinning `direction: ltr` plus
            // `text-align: left` fixed both, so a Hebrew form had its phone number
            // hanging off the left margin while every other field was right-aligned.
            //
            // `unicode-bidi: plaintext` resolves the run's direction from its own
            // content instead. A phone number has no strong characters - handleChange
            // strips everything that is not a digit - so it always lays out
            // left-to-right, while the element itself keeps the page's direction.
            // That is what lets `text-align: start`, inherited from <Field>'s
            // `text-start`, put the number on the right in Hebrew and the left in
            // English, with the digits in reading order either way.
            //
            // Deliberately not `dir="auto"`, which this project bans: that rule is
            // about CMS prose that opens on the Latin brand name and flips a whole
            // Hebrew block. This value is digits and nothing else.
            //
            // `direction: inherit` is load-bearing and not a no-op: Blink's UA
            // stylesheet forces `direction: ltr` on input[type=tel], so without this
            // the element's own direction is ltr whatever the page says, and the
            // `text-align: start` inherited from <Field> resolves to the LEFT edge on
            // a Hebrew form. Taking the page's direction back is what puts the number
            // on the reading edge; plaintext above is what keeps its digits in order.
            { direction: 'inherit', unicodeBidi: 'plaintext' }
          : // The legacy boxed variant keeps its hard LTR pinning; its own wrapper
            // below sets the same thing.
            { direction: 'ltr', textAlign: 'left' }
      }
      maxLength={10}
      {...aria}
    />
  )

  // In the design system the field has no wrapper of its own — <Field> owns the
  // rule and the caption, so a second box here would draw a line the design
  // does not have.
  if (isSako) return input

  return (
    <div
      className={cn(
        'flex flex-row h-10 w-full rounded-md border border-[#856D55]/70 bg-[#E1DBD7]/70 ring-offset-background focus-within:ring-[#856D55] focus-within:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      dir="ltr"
      style={{ direction: 'ltr', unicodeBidi: 'embed' }}
    >
      {input}
    </div>
  )
}
