'use client'

import React from 'react'
import { profileTheme } from './profileTheme'

export function Field({
  label,
  children,
  hint,
  error
}: {
  label: string
  children: React.ReactNode
  hint?: string
  error?: string | null
}) {
  return (
    <div>
      <label className={profileTheme.label}>{label}</label>
      {children}
      {error ? <div className={profileTheme.error}>{error}</div> : null}
      {!error && hint ? <div className={profileTheme.hint}>{hint}</div> : null}
    </div>
  )
}

export function TextInput({
  value,
  onChange,
  placeholder,
  disabled,
  inputMode
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  disabled?: boolean
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      inputMode={inputMode}
      className={`${profileTheme.input} ${disabled ? profileTheme.inputDisabled : ''}`}
    />
  )
}

export function SelectInput({
  value,
  onChange,
  options,
  placeholder,
  disabled
}: {
  value: string
  onChange: (v: string) => void
  options: Array<{ value: string; label: string }>
  placeholder?: string
  disabled?: boolean
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={`${profileTheme.input} ${disabled ? profileTheme.inputDisabled : ''}`}
    >
      <option value="">{placeholder ?? 'Select...'}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

export function RadioGroup({
  value,
  onChange,
  options,
  disabled
}: {
  value: string
  onChange: (v: string) => void
  options: Array<{ value: string; label: string }>
  disabled?: boolean
}) {
  return (
    <div className="mt-2 flex flex-wrap gap-4">
      {options.map((opt) => (
        <label key={opt.value} className="inline-flex items-center gap-2 text-sm text-slate-700">
          <input
            type="radio"
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
            disabled={disabled}
            className="accent-[#856D55] rounded-sm"
          />
          {opt.label}
        </label>
      ))}
    </div>
  )
}

export function Checkbox({
  checked,
  onChange,
  label,
  description,
  disabled
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  description?: string
  disabled?: boolean
}) {
  return (
    <label className="flex items-start gap-3">
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 accent-[#856D55] rounded-sm"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
      <span>
        <span className="block text-sm font-medium text-slate-800">{label}</span>
        {description ? (
          <span className="block text-xs text-slate-500">{description}</span>
        ) : null}
      </span>
    </label>
  )
}


