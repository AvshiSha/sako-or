'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { TextSearch } from 'lucide-react'

const SearchBar = dynamic(() => import('./SearchBar'), { ssr: false })

type LazySearchBarProps = {
  language: string
  variant?: 'default' | 'inline'
}

export default function LazySearchBar({ language, variant = 'default' }: LazySearchBarProps) {
  const [active, setActive] = useState(false)

  if (!active) {
    return (
      <button
        type="button"
        onClick={() => setActive(true)}
        className="text-gray-700 hover:text-gray-900 transition-colors duration-200 p-2 rounded-md hover:bg-gray-50 flex items-center justify-center"
        aria-label={language === 'he' ? 'חיפוש' : 'Search'}
      >
        <TextSearch className="h-6 w-6" />
      </button>
    )
  }

  return <SearchBar language={language} variant={variant} />
}
