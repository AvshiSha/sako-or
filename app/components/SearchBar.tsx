'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, X } from 'lucide-react'
import { Product } from '@/lib/firebase'
import ProductCard from './ProductCard'

interface SearchBarProps {
  language: string
}

export default function SearchBar({ language }: SearchBarProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const searchContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      setShowResults(false)
      return
    }

    const debounceTimer = setTimeout(async () => {
      setIsLoading(true)
      try {
        const response = await fetch(
          `/api/products/search?q=${encodeURIComponent(searchQuery)}&lng=${language}`
        )
        const data = await response.json()
        setSearchResults(data.products || [])
        setShowResults(true)
      } catch (error) {
        console.error('Search error:', error)
        setSearchResults([])
      } finally {
        setIsLoading(false)
      }
    }, 400) // 400ms debounce

    return () => clearTimeout(debounceTimer)
  }, [searchQuery, language])

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsExpanded(false)
        setShowResults(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Focus input when expanded
  useEffect(() => {
    if (isExpanded && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isExpanded])

  const handleSearchIconClick = () => {
    setIsExpanded(!isExpanded)
    if (isExpanded) {
      setSearchQuery('')
      setShowResults(false)
    }
  }

  const handleClearSearch = () => {
    setSearchQuery('')
    setShowResults(false)
    inputRef.current?.focus()
  }

  const handleResultClick = () => {
    setIsExpanded(false)
    setSearchQuery('')
    setShowResults(false)
  }

  const translations = {
    en: {
      search: 'Search products...',
      searching: 'Searching...',
      noResults: 'No products found',
      resultsCount: (count: number) => `${count} result${count !== 1 ? 's' : ''} found`
    },
    he: {
      search: 'חיפוש מוצרים...',
      searching: 'מחפש...',
      noResults: 'לא נמצאו מוצרים',
      resultsCount: (count: number) => `נמצאו ${count} תוצאות`
    }
  }

  const t = translations[language as keyof typeof translations] || translations.en

  return (
    <div ref={searchContainerRef} className="relative">
      {/* Search Icon Button */}
      <button
        onClick={handleSearchIconClick}
        className="text-gray-700 hover:text-gray-900 transition-colors duration-200 p-2 rounded-md hover:bg-gray-50"
        aria-label="Search"
      >
        <Search className="h-5 w-5" />
      </button>

      {/* Expanded Search Input - Desktop */}
      {isExpanded && (
        <>
          {/* Overlay backdrop */}
          <div 
            className="fixed inset-0 bg-black/20 z-40"
            onClick={() => {
              setIsExpanded(false)
              setShowResults(false)
            }}
          />
          
          {/* Search Container */}
          <div className="fixed top-20 left-1/2 transform -translate-x-1/2 w-full max-w-3xl z-50 px-4">
            <div className="bg-white rounded-lg shadow-2xl">
              {/* Search Input */}
              <div className="flex items-center border-b border-gray-200 p-4">
                <Search className="h-5 w-5 text-gray-400 mr-3" />
                <input
                  ref={inputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t.search}
                  className="flex-1 outline-none text-gray-900 placeholder-gray-400"
                  dir={language === 'he' ? 'rtl' : 'ltr'}
                />
                {searchQuery && (
                  <button
                    onClick={handleClearSearch}
                    className="ml-2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>

              {/* Search Results */}
              {showResults && (
                <div className="max-h-[70vh] overflow-y-auto">
                  {isLoading ? (
                    <div className="p-8 text-center text-gray-500">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-2"></div>
                      <p>{t.searching}</p>
                    </div>
                  ) : searchResults.length > 0 ? (
                    <>
                      <div className="p-4 border-b border-gray-200 bg-gray-50">
                        <p className="text-sm text-gray-600">
                          {t.resultsCount(searchResults.length)}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 p-4">
                        {searchResults.map((product) => (
                          <div 
                            key={product.id} 
                            onClick={handleResultClick}
                          >
                            <ProductCard
                              product={product}
                              language={language as 'en' | 'he'}
                              returnUrl={`/${language}`}
                            />
                          </div>
                        ))}
                      </div>
                    </>
                  ) : searchQuery.trim() ? (
                    <div className="p-8 text-center text-gray-500">
                      <Search className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                      <p>{t.noResults}</p>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

