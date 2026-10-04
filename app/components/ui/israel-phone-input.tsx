'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

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
          ? 'w-full flex-1 border-0 bg-transparent p-0 font-ploni text-[14px] leading-none text-text-primary outline-none placeholder:text-text-secondary disabled:cursor-not-allowed disabled:text-sako-gray-500 disabled:placeholder:text-sako-gray-500'
          : 'flex-1 bg-transparent px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed'
      )}
      // A phone number is not Hebrew text and reads backwards if it inherits the
      // page direction, so the field is pinned LTR on both locales.
      style={{ direction: 'ltr', textAlign: 'left' }}
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
