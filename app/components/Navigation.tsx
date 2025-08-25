'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { Menu, X, ChevronDown } from 'lucide-react'
import LanguageSwitcher from './LanguageSwitcher'
import { usePathname } from 'next/navigation'

const womenCategories = {
  shoes: [
    { name: 'navigation.subCategories.highHeels', href: '/collection/women/shoes/high-heels' },
    { name: 'navigation.subCategories.boots', href: '/collection/women/shoes/boots' },
    { name: 'navigation.subCategories.oxford', href: '/collection/women/shoes/oxford' },
    { name: 'navigation.subCategories.sneakers', href: '/collection/women/shoes/sneakers' },
    { name: 'navigation.subCategories.sandals', href: '/collection/women/shoes/sandals' },
    { name: 'navigation.subCategories.slippers', href: '/collection/women/shoes/slippers' }
  ],
  accessories: [
    { name: 'navigation.subCategories.coats', href: '/collection/women/accessories/coats' },
    { name: 'navigation.subCategories.bags', href: '/collection/women/accessories/bags' }
  ]
}

export default function Navigation() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isWomenMenuOpen, setIsWomenMenuOpen] = useState(false)
  const { t, i18n } = useTranslation()
  const pathname = usePathname()
  // const params = useParams()
  const lng = pathname.startsWith('/he') ? 'he' : 'en'
  const isRTL = lng === 'he'
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Update document direction
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr'
    
    // Ensure i18n language matches the current path
    if (i18n.language !== lng) {
      i18n.changeLanguage(lng)
    }
  }, [lng, i18n, isRTL])

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    setIsWomenMenuOpen(true)
  }

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setIsWomenMenuOpen(false)
    }, 300)
  }

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return (
    <nav className={`fixed w-full bg-white shadow-md z-50 ${isRTL ? 'text-right' : 'text-left'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link href={`/${lng}`} className="text-2xl font-bold text-gray-900">
                SAKO-OR
              </Link>
            </div>
            <div className={`hidden sm:ml-6 sm:flex sm:space-x-8 relative ${isRTL ? 'mr-6' : 'ml-6'}`}>
              <Link
                href={`/${lng}`}
                className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
              >
                {t('navigation.home')}
              </Link>
              <Link
                href={`/${lng}/collection`}
                className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
              >
                {t('navigation.newCollection')}
              </Link>
              <div 
                className="relative"
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                ref={dropdownRef}
              >
                <button
                  className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium h-full"
                >
                  {t('navigation.women')}
                  <ChevronDown className={`${isRTL ? 'mr-2' : 'ml-2'} h-4 w-4`} />
                </button>
                {isWomenMenuOpen && (
                  <div className={`absolute ${isRTL ? 'right-0' : 'left-0'} mt-2 w-96 bg-white rounded-md shadow-lg py-1 z-50`}>
                    <div className="grid grid-cols-2 gap-4 p-4">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 mb-2">{t('navigation.shoes')}</h3>
                        <ul className="space-y-2">
                          {womenCategories.shoes.map((item) => (
                            <li key={item.name}>
                              <Link
                                href={`/${lng}${item.href}`}
                                className="text-gray-600 hover:text-gray-900 block px-4 py-2 text-sm"
                              >
                                {t(item.name)}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 mb-2">{t('navigation.accessories')}</h3>
                        <ul className="space-y-2">
                          {womenCategories.accessories.map((item) => (
                            <li key={item.name}>
                              <Link
                                href={`/${lng}${item.href}`}
                                className="text-gray-600 hover:text-gray-900 block px-4 py-2 text-sm"
                              >
                                {t(item.name)}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <Link
                href={`/${lng}/collection/men`}
                className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
              >
                {t('navigation.men')}
              </Link>
              <Link
                href={`/${lng}/about`}
                className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
              >
                {t('navigation.about')}
              </Link>
              <Link
                href={`/${lng}/contact`}
                className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
              >
                {t('navigation.contact')}
              </Link>
            </div>
          </div>
          <div className="flex items-center">
            <LanguageSwitcher currentLanguage={lng} />
            <div className={`sm:hidden ${isRTL ? 'mr-4' : 'ml-4'}`}>
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
              >
                {isMenuOpen ? (
                  <X className="block h-6 w-6" />
                ) : (
                  <Menu className="block h-6 w-6" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isMenuOpen && (
        <div className="sm:hidden">
          <div className="pt-2 pb-3 space-y-1">
            <Link
              href={`/${lng}`}
              className="block pl-3 pr-4 py-2 border-l-4 border-transparent text-base font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 hover:border-gray-300"
            >
              {t('navigation.home')}
            </Link>
            <Link
              href={`/${lng}/collection`}
              className="block pl-3 pr-4 py-2 border-l-4 border-transparent text-base font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 hover:border-gray-300"
            >
              {t('navigation.newCollection')}
            </Link>
            <div>
              <button
                onClick={() => setIsWomenMenuOpen(!isWomenMenuOpen)}
                className="w-full flex justify-between items-center pl-3 pr-4 py-2 border-l-4 border-transparent text-base font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 hover:border-gray-300"
              >
                {t('navigation.women')}
                <ChevronDown className={`h-5 w-5 transform ${isWomenMenuOpen ? 'rotate-180' : ''}`} />
              </button>
              {isWomenMenuOpen && (
                <div className="pl-4 space-y-1">
                  <div className="pt-2">
                    <h3 className="px-3 py-1 text-sm font-semibold text-gray-900">{t('navigation.shoes')}</h3>
                    <ul className="space-y-1">
                      {womenCategories.shoes.map((item) => (
                        <li key={item.name}>
                          <Link
                            href={`/${lng}${item.href}`}
                            className="block px-3 py-2 text-base font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                            onClick={() => setIsMenuOpen(false)}
                          >
                            {t(item.name)}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="pt-2">
                    <h3 className="px-3 py-1 text-sm font-semibold text-gray-900">{t('navigation.accessories')}</h3>
                    <ul className="space-y-1">
                      {womenCategories.accessories.map((item) => (
                        <li key={item.name}>
                          <Link
                            href={`/${lng}${item.href}`}
                            className="block px-3 py-2 text-base font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                            onClick={() => setIsMenuOpen(false)}
                          >
                            {t(item.name)}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
            <Link
              href={`/${lng}/collection/men`}
              className="block pl-3 pr-4 py-2 border-l-4 border-transparent text-base font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 hover:border-gray-300"
            >
              {t('navigation.men')}
            </Link>
            <Link
              href={`/${lng}/about`}
              className="block pl-3 pr-4 py-2 border-l-4 border-transparent text-base font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 hover:border-gray-300"
            >
              {t('navigation.about')}
            </Link>
            <Link
              href={`/${lng}/contact`}
              className="block pl-3 pr-4 py-2 border-l-4 border-transparent text-base font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 hover:border-gray-300"
            >
              {t('navigation.contact')}
            </Link>
          </div>
        </div>
      )}
    </nav>
  )
}