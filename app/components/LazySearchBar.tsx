'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { Search } from 'lucide-react'

const SearchBar = dynamic(() => import('./SearchBar'), { ssr: false })

type LazySearchBarProps = {
  language: string
  variant?: 'default' | 'inline'
}

const placeholderText = {
  en: 'Search for a brand name, products and more...',
  he: 'חפשו שם של מותג, מוצרים ועוד...',
}

export default function LazySearchBar({ language, variant = 'default' }: LazySearchBarProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    if (variant === 'inline') {
      const isRTL = language === 'he'
      return (
        <div
          className={`w-full bg-gray-100 border border-gray-300 rounded-md py-2.5 text-gray-500 text-sm ${
            isRTL ? 'pr-10 pl-4' : 'pl-10 pr-4'
          }`}
          dir={isRTL ? 'rtl' : 'ltr'}
          aria-hidden="true"
        >
          {placeholderText[language as keyof typeof placeholderText] ?? placeholderText.en}
        </div>
      )
    }

    return (
      <button
        type="button"
        className="text-gray-700 hover:text-gray-900 transition-colors duration-200 p-2 rounded-md hover:bg-gray-50 flex items-center justify-center"
        aria-label={language === 'he' ? 'חיפוש' : 'Search'}
        tabIndex={-1}
      >
        <Search className="h-5 w-5" aria-hidden="true" />
      </button>
    )
  }

  return <SearchBar language={language} variant={variant} />
}
