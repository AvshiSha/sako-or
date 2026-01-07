'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface IsraelPhoneInputProps {
  value: string // Local number only (8-9 digits), without +972
  onChange: (localNumber: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  dir?: 'ltr' | 'rtl' // Ignored - phone numbers are always LTR
}

export function IsraelPhoneInput({
  value,
  onChange,
  placeholder = '50-123-4567',
  disabled = false,
  className,
  dir = 'ltr', // Ignored - always use LTR for phone numbers
}: IsraelPhoneInputProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow digits, max 9 digits (Israeli phone numbers are 8-9 digits)
    const digits = e.target.value.replace(/\D/g, '').slice(0, 9)
    onChange(digits)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Prevent backspace from deleting the prefix
    if (e.key === 'Backspace' && inputRef.current?.selectionStart === 0) {
      e.preventDefault()
    }
  }

  // Always use LTR for phone numbers - +972 should always be on the left
  return (
    <div
      className={cn(
        'flex flex-row h-10 w-full rounded-md border border-[#856D55]/70 bg-[#E1DBD7]/70 ring-offset-background focus-within:ring-[#856D55] focus-within:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      dir="ltr"
      style={{ direction: 'ltr', unicodeBidi: 'embed' }}
    >
      {/* Fixed +972 prefix - always on the left */}
      <div 
        className="flex items-center px-3 py-2 text-sm font-medium text-slate-900 select-none border-r border-[#856D55]/70"
        style={{ direction: 'ltr' }}
      >
        +972
      </div>
      
      {/* Local number input */}
      <input
        ref={inputRef}
        type="tel"
        inputMode="numeric"
        pattern="[0-9]*"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className="flex-1 bg-transparent px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed"
        style={{ direction: 'ltr', textAlign: 'left' }}
        maxLength={9}
      />
    </div>
  )
}

