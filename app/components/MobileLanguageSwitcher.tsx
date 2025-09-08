'use client'

import { useRouter, usePathname } from 'next/navigation'
import { languageMetadata } from '../../i18n/settings'

interface MobileLanguageSwitcherProps {
  currentLanguage: string
}

export default function MobileLanguageSwitcher({ currentLanguage }: MobileLanguageSwitcherProps) {
  const router = useRouter()
  const pathname = usePathname()

  const handleLanguageChange = (newLanguage: string) => {
    // Replace the current language in the pathname
    const pathSegments = pathname.split('/')
    if (pathSegments[1] && Object.keys(languageMetadata).includes(pathSegments[1])) {
      pathSegments[1] = newLanguage
    } else {
      // If no language in path, add it at the beginning
      pathSegments.splice(1, 0, newLanguage)
    }
    
    const newPath = pathSegments.join('/')
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
            {meta.flag} {meta.nativeName} ({code.toUpperCase()})
          </option>
        ))}
      </select>
    </div>
  )
}
