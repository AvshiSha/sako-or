'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * The 6-digit code entry.
 *
 * `sako` draws each digit as its own "Form Input Field" cell (438:2751) — a
 * hairline with the value sitting on it, no box — so a row of six reads as six
 * of the same control the rest of the form is built from. The design system has
 * no OTP component of its own; this is the field construction repeated, which is
 * the nearest thing it does have. Focus thickens the rule to 2px ink exactly as
 * <Field> does, and `error` turns the whole row accent-error so a wrong code
 * marks the control rather than only printing a message under it.
 */
interface OtpInputProps {
  value: string
  onChange: (value: string) => void
  length?: number
  disabled?: boolean
  className?: string
  dir?: 'ltr' | 'rtl'
  variant?: 'default' | 'sako'
  /** Marks every cell invalid. The message itself belongs to the caller. */
  error?: boolean
  'aria-describedby'?: string
}

export function OtpInput({
  value,
  onChange,
  length = 6,
  disabled = false,
  className,
  dir = 'ltr',
  variant = 'default',
  error = false,
  ...aria
}: OtpInputProps) {
  const inputRefs = React.useRef<(HTMLInputElement | null)[]>([])
  const [focusedIndex, setFocusedIndex] = React.useState<number | null>(null)

  // Initialize refs array
  React.useEffect(() => {
    inputRefs.current = inputRefs.current.slice(0, length)
  }, [length])

  // Sync value with inputs
  React.useEffect(() => {
    const currentValue = value.slice(0, length).padEnd(length, '')
    inputRefs.current.forEach((input, index) => {
      if (input) {
        input.value = currentValue[index] || ''
      }
    })
  }, [value, length])

  const handleChange = (index: number, newValue: string) => {
    // Only allow digits
    const digit = newValue.replace(/\D/g, '').slice(-1)
    
    if (!digit && value[index]) {
      // Backspace - remove digit and focus previous
      const newOtp = value.slice(0, index) + value.slice(index + 1)
      onChange(newOtp)
      
      // Focus previous input (always left-to-right, regardless of dir)
      if (index > 0) {
        const prevIndex = index - 1
        inputRefs.current[prevIndex]?.focus()
      }
      return
    }
    
    if (digit) {
      // Add digit
      const newOtp = value.slice(0, index) + digit + value.slice(index + 1)
      onChange(newOtp.slice(0, length))
      
      // Focus next input (always left-to-right, regardless of dir)
      if (index < length - 1) {
        const nextIndex = index + 1
        inputRefs.current[nextIndex]?.focus()
      }
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !value[index] && index > 0) {
      // Focus previous on backspace when current is empty (always left-to-right)
      const prevIndex = index - 1
      inputRefs.current[prevIndex]?.focus()
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault()
      // Arrow left always goes to previous index (left-to-right)
      const prevIndex = index - 1
      inputRefs.current[prevIndex]?.focus()
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      e.preventDefault()
      // Arrow right always goes to next index (left-to-right)
      const nextIndex = index + 1
      inputRefs.current[nextIndex]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length)
    if (pastedData) {
      onChange(pastedData)
      // Focus the last filled input or the last input
      const focusIndex = Math.min(pastedData.length, length - 1)
      inputRefs.current[focusIndex]?.focus()
    }
  }

  const isSako = variant === 'sako'

  return (
    <div
      className={cn(isSako ? 'flex gap-[10px]' : 'flex gap-2 justify-center', className)}
      // Always LTR: a code is digits, and typed right-to-left it would be
      // entered backwards on the Hebrew storefront.
      dir="ltr"
      onPaste={handlePaste}
    >
      {Array.from({ length }).map((_, index) => (
        <input
          key={index}
          ref={(el) => {
            inputRefs.current[index] = el
          }}
          type="text"
          inputMode="numeric"
          // One-time-code so iOS and Android offer the SMS straight from the
          // keyboard instead of making the customer leave the page to read it.
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          pattern="[0-9]*"
          maxLength={1}
          value={value[index] || ''}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onFocus={() => setFocusedIndex(index)}
          onBlur={() => setFocusedIndex(null)}
          disabled={disabled}
          aria-invalid={error || undefined}
          className={cn(
            isSako
              ? cn(
                  // min-w-0 so six cells still fit a 320px phone rather than
                  // forcing the page wider than the viewport.
                  'h-[54px] min-w-0 flex-1 border-0 border-b bg-transparent pb-px text-center font-ploni text-[20px] font-black leading-none text-text-primary outline-none transition-[border-color]',
                  'focus-visible:border-b-2 focus-visible:border-sako-ink-900 focus-visible:pb-0',
                  'disabled:cursor-not-allowed disabled:border-border-subtle disabled:text-sako-gray-500',
                  error ? 'border-accent-error' : 'border-border-default'
                )
              : cn(
                  'flex h-12 w-12 rounded-md border border-[#856D55]/70 bg-[#E1DBD7]/70 text-center text-lg font-semibold text-slate-900 ring-offset-background transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#856D55] focus-visible:ring-offset-2',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                  'md:h-14 md:w-14 md:text-xl',
                  focusedIndex === index && 'ring-2 ring-[#856D55] ring-offset-2'
                )
          )}
          aria-label={`Digit ${index + 1} of ${length}`}
          {...(index === 0 ? aria : null)}
        />
      ))}
    </div>
  )
}

