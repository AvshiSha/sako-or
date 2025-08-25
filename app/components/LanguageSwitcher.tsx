'use client'

import { useRouter, usePathname } from 'next/navigation'
import i18next from 'i18next'

interface LanguageSwitcherProps {
  currentLanguage: string;
}

export default function LanguageSwitcher({ currentLanguage }: LanguageSwitcherProps) {
  const router = useRouter()
  const pathname = usePathname()
  // const { t } = useTranslation() // TODO: Use translation if needed

  const handleLanguageChange = async (lng: string) => {
    // Get the current path without the language prefix
    let currentPath = pathname
    if (pathname.startsWith('/en/') || pathname.startsWith('/he/')) {
      currentPath = pathname.slice(3) // Remove the language prefix
    } else if (pathname === '/en' || pathname === '/he') {
      currentPath = '/' // Handle root path
    }

    // Change the language first
    await i18next.changeLanguage(lng)
    
    // Then navigate to the new path with the selected language
    router.push(`/${lng}${currentPath}`)
  }

  return (
    <div className="flex space-x-2">
      <button
        onClick={() => handleLanguageChange('en')}
        className={`px-2 py-1 text-sm font-medium rounded-md ${
          currentLanguage === 'en'
            ? 'bg-gray-900 text-white'
            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
        }`}
      >
        EN
      </button>
      <button
        onClick={() => handleLanguageChange('he')}
        className={`px-2 py-1 text-sm font-medium rounded-md ${
          currentLanguage === 'he'
            ? 'bg-gray-900 text-white'
            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
        }`}
      >
        HE
      </button>
    </div>
  )
} 