'use client'

import { useRouter, usePathname } from 'next/navigation'
import { languageMetadata } from '../../i18n/settings'
import { ChevronDown } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'

interface DropdownLanguageSwitcherProps {
  currentLanguage: string
}

export default function DropdownLanguageSwitcher({ currentLanguage }: DropdownLanguageSwitcherProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const handleLanguageChange = (newLanguage: string) => {
    // Replace the current language in the pathname
    if (!pathname) return
    
    const pathSegments = pathname.split('/')
    if (pathSegments[1] && Object.keys(languageMetadata).includes(pathSegments[1])) {
      pathSegments[1] = newLanguage
    } else {
      // If no language in path, add it at the beginning
      pathSegments.splice(1, 0, newLanguage)
    }
    
    const newPath = pathSegments.join('/')
    router.push(newPath)
    setIsOpen(false)
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const currentLanguageMeta = languageMetadata[currentLanguage as keyof typeof languageMetadata]

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Dropdown Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-1 px-3 py-2 text-sm font-medium rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors duration-200"
      >
        <span>{currentLanguageMeta.flag}</span>
        <span className="hidden sm:inline">{currentLanguageMeta.nativeName}</span>
        <span className="sm:hidden">{currentLanguage.toUpperCase()}</span>
        <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-50">
          <div className="py-1">
            {Object.entries(languageMetadata).map(([code, meta]) => (
              <button
                key={code}
                onClick={() => handleLanguageChange(code)}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 transition-colors duration-200 flex items-center space-x-2 ${
                  currentLanguage === code ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700'
                }`}
              >
                <span>{meta.flag}</span>
                <span>{meta.nativeName}</span>
                <span className="text-gray-500">({code.toUpperCase()})</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
