'use client'

import { useState } from 'react'
import { XMarkIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'

interface SeoKeywordInputProps {
  label: string
  helperText?: string
  values: string[]
  onChange: (values: string[]) => void
  dir?: 'ltr' | 'rtl'
  placeholder?: string
}

function normalizeKeyword(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim()
}

/**
 * Tag input for SEO secondary keywords: Enter to add, paste comma-separated text
 * to add several at once, duplicates are skipped, and each tag can be reordered
 * with the arrow buttons (kept as simple, reliably-testable buttons rather than
 * a drag interaction that can't be visually verified in this environment).
 */
export default function SeoKeywordInput({
  label,
  helperText,
  values,
  onChange,
  dir = 'ltr',
  placeholder,
}: SeoKeywordInputProps) {
  const [draft, setDraft] = useState('')

  const addKeywords = (raw: string) => {
    const parts = raw.split(',').map(normalizeKeyword).filter(Boolean)
    if (parts.length === 0) return
    const next = [...values]
    for (const part of parts) {
      const isDuplicate = next.some((existing) => existing.toLowerCase() === part.toLowerCase())
      if (!isDuplicate) next.push(part)
    }
    onChange(next)
    setDraft('')
  }

  const removeAt = (index: number) => {
    onChange(values.filter((_, i) => i !== index))
  }

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= values.length) return
    const next = [...values]
    const temp = next[index]
    next[index] = next[target]
    next[target] = temp
    onChange(next)
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2" dir={dir}>
          {values.map((keyword, index) => (
            <span
              key={`${keyword}-${index}`}
              className="inline-flex items-center gap-1 bg-gray-100 border border-gray-300 rounded-full pl-3 pr-1 py-1 text-sm text-gray-700"
            >
              {keyword}
              <button
                type="button"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                title="Move earlier"
              >
                <ChevronLeftIcon className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                disabled={index === values.length - 1}
                className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                title="Move later"
              >
                <ChevronRightIcon className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => removeAt(index)}
                className="text-gray-400 hover:text-red-600"
                title="Remove"
              >
                <XMarkIcon className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        type="text"
        dir={dir}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            addKeywords(draft)
          }
        }}
        onPaste={(e) => {
          const pasted = e.clipboardData.getData('text')
          if (pasted.includes(',')) {
            e.preventDefault()
            addKeywords(pasted)
          }
        }}
        onBlur={() => {
          if (draft.trim()) addKeywords(draft)
        }}
        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-400 text-gray-700"
        placeholder={placeholder ?? 'Type a keyword and press Enter'}
      />
      {helperText && <p className="mt-1 text-xs text-gray-500">{helperText}</p>}
    </div>
  )
}
