'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface IsraelPhoneInputProps {
  value: string // Local number (8-9 digits) or with 0 prefix (0XXXXXXXXX), without +972
  onChange: (localNumber: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  dir?: 'ltr' | 'rtl' // Ignored - phone numbers are always LTR
}

export function IsraelPhoneInput({
  value,
  onChange,
  placeholder = '0501234567 או 501234567',
  disabled = false,
  className,
  dir = 'ltr', // Ignored - always use LTR for phone numbers
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

  // Always use LTR for phone numbers
  return (
    <div
      className={cn(
        'flex flex-row h-10 w-full rounded-md border border-[#856D55]/70 bg-[#E1DBD7]/70 ring-offset-background focus-within:ring-[#856D55] focus-within:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      dir="ltr"
      style={{ direction: 'ltr', unicodeBidi: 'embed' }}
    >
      {/* Phone number input - users can type with 0 prefix or without */}
      <input
        ref={inputRef}
        type="tel"
        inputMode="numeric"
        pattern="[0-9]*"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        className="flex-1 bg-transparent px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed"
        style={{ direction: 'ltr', textAlign: 'left' }}
        maxLength={10}
      />
    </div>
  )
}

