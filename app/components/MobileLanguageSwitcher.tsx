'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { languageMetadata } from '../../i18n/settings'
import { Suspense } from 'react'

interface MobileLanguageSwitcherProps {
  currentLanguage: string
}

function MobileLanguageSwitcherInner({ currentLanguage }: MobileLanguageSwitcherProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

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
    
    // Preserve query parameters
    const queryString = searchParams?.toString() || ''
    const queryParams = queryString ? `?${queryString}` : ''
    
    const newPath = pathSegments.join('/') + queryParams
    router.push(newPath)
  }

  return (
    <div className="px-4 py-3 border-t border-gray-200">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {currentLanguage === 'he' ? 'שפה' : 'Language'}
      </label>
      <select
        value={currentLanguage}
        onChange={(e) => handleLanguageChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-900"
      >
        {Object.entries(languageMetadata).map(([code, meta]) => (
          <option key={code} value={code}>
            {meta.nativeName} ({code.toUpperCase()})
          </option>
        ))}
      </select>
    </div>
  )
}

export default function MobileLanguageSwitcher({ currentLanguage }: MobileLanguageSwitcherProps) {
  return (
    <Suspense fallback={
      <div className="px-4 py-3 border-t border-gray-200">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {currentLanguage === 'he' ? 'שפה' : 'Language'}
        </label>
        <select
          value={currentLanguage}
          disabled
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-gray-900"
        >
          <option value={currentLanguage}>
            {languageMetadata[currentLanguage as keyof typeof languageMetadata]?.nativeName} ({currentLanguage.toUpperCase()})
          </option>
        </select>
      </div>
    }>
      <MobileLanguageSwitcherInner currentLanguage={currentLanguage} />
    </Suspense>
  )
}
