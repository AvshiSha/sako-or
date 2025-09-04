'use client'

import Link from 'next/link'
import { ChevronDown, Menu, X } from 'lucide-react'
import { useState } from 'react'
import LanguageSwitcher from './LanguageSwitcher'

const womenCategories = {
  shoes: [
    { name: { en: 'High Heels', he: 'עקבים גבוהים' }, href: '/collection/women/shoes/high-heels' },
    { name: { en: 'Boots', he: 'מגפיים' }, href: '/collection/women/shoes/boots' },
    { name: { en: 'Oxford', he: 'אוקספורד' }, href: '/collection/women/shoes/oxford' },
    { name: { en: 'Sneakers', he: 'סניקרס' }, href: '/collection/women/shoes/sneakers' },
    { name: { en: 'Sandals', he: 'סנדלים' }, href: '/collection/women/shoes/sandals' },
    { name: { en: 'Slippers', he: 'כפכפים' }, href: '/collection/women/shoes/slippers' }
  ],
  accessories: [
    { name: { en: 'Coats', he: 'מעילים' }, href: '/collection/women/accessories/coats' },
    { name: { en: 'Bags', he: 'תיקים' }, href: '/collection/women/accessories/bags' }
  ]
}

// Hardcoded translations for build-time rendering
const translations = {
  en: {
    home: 'Home',
    newCollection: 'New Collection',
    women: 'Women',
    subCategories: {
      shoes: 'Shoes',
      accessories: 'Accessories',
      highHeels: 'High Heels',
      boots: 'Boots',
      oxford: 'Oxford',
      sneakers: 'Sneakers',
      sandals: 'Sandals',
      slippers: 'Slippers',
      coats: 'Coats',
      bags: 'Bags'
    },
    about: 'About',
    contact: 'Contact'
  },
  he: {
    home: 'בית',
    newCollection: 'קולקציה חדשה',
    women: 'נשים',
    subCategories: {
      shoes: 'נעליים',
      accessories: 'אביזרים',
      highHeels: 'עקבים גבוהים',
      boots: 'מגפיים',
      oxford: 'אוקספורד',
      sneakers: 'סניקרס',
      sandals: 'סנדלים',
      slippers: 'כפכפים',
      coats: 'מעילים',
      bags: 'תיקים'
    },
    about: 'אודות',
    contact: 'צור קשר'
  }
}

export default function Navigation({ lng }: { lng: string }) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isMobileWomenOpen, setIsMobileWomenOpen] = useState(false)
  const [hoverTimeout, setHoverTimeout] = useState<NodeJS.Timeout | null>(null)
  const isRTL = lng === 'he'
  const t = translations[lng as keyof typeof translations]

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false)
    setIsMobileWomenOpen(false)
  }

  const handleMouseEnter = () => {
    if (hoverTimeout) {
      clearTimeout(hoverTimeout)
      setHoverTimeout(null)
    }
    setIsDropdownOpen(true)
  }

  const handleMouseLeave = () => {
    const timeout = setTimeout(() => {
      setIsDropdownOpen(false)
    }, 300) // 300ms delay
    setHoverTimeout(timeout)
  }

  return (
    <nav className={`fixed w-full bg-white shadow-md z-50 ${isRTL ? 'text-right' : 'text-left'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo */}
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link href={`/${lng}`} className="text-2xl font-bold text-gray-900">
                SAKO-OR
              </Link>
            </div>
            
            {/* Desktop Navigation */}
            <div className={`hidden sm:ml-6 sm:flex sm:space-x-8 relative ${isRTL ? 'mr-6' : 'ml-6'}`}>
              <Link
                href={`/${lng}`}
                className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
              >
                {t.home}
              </Link>
              <Link
                href={`/${lng}/collection`}
                className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
              >
                {t.newCollection}
              </Link>
               <div 
                className="relative"
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
              >
                <button 
                  className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium h-full"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                >
                  {t.women}
                  <ChevronDown className={`${isRTL ? 'mr-2' : 'ml-2'} h-4 w-4 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                <div className={`absolute top-full left-0 mt-1 w-64 bg-white shadow-lg rounded-md py-2 z-50 transition-all duration-200 ${isDropdownOpen ? 'block' : 'hidden'}`}>
                  <div className="px-4 py-2 text-sm font-medium text-gray-900 border-b border-gray-200">
                    {t.subCategories.shoes}
                  </div>
                  {womenCategories.shoes.map((category) => (
                    <Link
                      key={category.name.en}
                      href={`/${lng}${category.href}`}
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      {category.name[lng as keyof typeof category.name]}
                    </Link>
                  ))}
                  <div className="px-4 py-2 text-sm font-medium text-gray-900 border-b border-gray-200 mt-2">
                    {t.subCategories.accessories}
                  </div>
                  {womenCategories.accessories.map((category) => (
                    <Link
                      key={category.name.en}
                      href={`/${lng}${category.href}`}
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      {category.name[lng as keyof typeof category.name]}
                    </Link>
                  ))}
                </div>
              </div>
              <Link
                href={`/${lng}/about`}
                className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
              >
                {t.about}
              </Link>
              <Link
                href={`/${lng}/contact`}
                className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
              >
                {t.contact}
              </Link>
            </div>
          </div>

          {/* Right side - Language Switcher and Mobile Menu Button */}
          <div className="flex items-center">
            <LanguageSwitcher currentLanguage={lng} />
            
            {/* Mobile menu button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="sm:hidden ml-4 p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
            >
              {isMobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      <div className={`sm:hidden transition-all duration-300 ease-in-out ${isMobileMenuOpen ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
        <div className="px-2 pt-2 pb-3 space-y-1 bg-white border-t border-gray-200 shadow-lg">
          {/* Home */}
          <Link
            href={`/${lng}`}
            onClick={closeMobileMenu}
            className="block px-3 py-2 text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-md"
          >
            {t.home}
          </Link>
          
          {/* New Collection */}
          <Link
            href={`/${lng}/collection`}
            onClick={closeMobileMenu}
            className="block px-3 py-2 text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-md"
          >
            {t.newCollection}
          </Link>
          
          {/* Women Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsMobileWomenOpen(!isMobileWomenOpen)}
              className="w-full text-left px-3 py-2 text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-md flex items-center justify-between"
            >
              {t.women}
              <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isMobileWomenOpen ? 'rotate-180' : ''}`} />
            </button>
            
            <div className={`transition-all duration-200 ease-in-out ${isMobileWomenOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
              <div className="ml-4 space-y-1">
                {/* Shoes Section */}
                <div className="px-3 py-2 text-sm font-medium text-gray-900 border-b border-gray-200">
                  {t.subCategories.shoes}
                </div>
                {womenCategories.shoes.map((category) => (
                  <Link
                    key={category.name.en}
                    href={`/${lng}${category.href}`}
                    onClick={closeMobileMenu}
                    className="block px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md"
                  >
                    {category.name[lng as keyof typeof category.name]}
                  </Link>
                ))}
                
                {/* Accessories Section */}
                <div className="px-3 py-2 text-sm font-medium text-gray-900 border-b border-gray-200 mt-2">
                  {t.subCategories.accessories}
                </div>
                {womenCategories.accessories.map((category) => (
                  <Link
                    key={category.name.en}
                    href={`/${lng}${category.href}`}
                    onClick={closeMobileMenu}
                    className="block px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md"
                  >
                    {category.name[lng as keyof typeof category.name]}
                  </Link>
                ))}
              </div>
            </div>
          </div>
          
          {/* About */}
          <Link
            href={`/${lng}/about`}
            onClick={closeMobileMenu}
            className="block px-3 py-2 text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-md"
          >
            {t.about}
          </Link>
          
          {/* Contact */}
          <Link
            href={`/${lng}/contact`}
            onClick={closeMobileMenu}
            className="block px-3 py-2 text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-md"
          >
            {t.contact}
          </Link>
        </div>
      </div>
    </nav>
  )
}