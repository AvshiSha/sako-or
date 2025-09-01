'use client'

import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import LanguageSwitcher from './LanguageSwitcher'

const womenCategories = {
  shoes: [
    { name: 'High Heels', href: '/collection/women/shoes/high-heels' },
    { name: 'Boots', href: '/collection/women/shoes/boots' },
    { name: 'Oxford', href: '/collection/women/shoes/oxford' },
    { name: 'Sneakers', href: '/collection/women/shoes/sneakers' },
    { name: 'Sandals', href: '/collection/women/shoes/sandals' },
    { name: 'Slippers', href: '/collection/women/shoes/slippers' }
  ],
  accessories: [
    { name: 'Coats', href: '/collection/women/accessories/coats' },
    { name: 'Bags', href: '/collection/women/accessories/bags' }
  ]
}

// Hardcoded translations for build-time rendering
const translations = {
  en: {
    home: 'Home',
    newCollection: 'New Collection',
    women: 'Women',
    about: 'About',
    contact: 'Contact'
  },
  he: {
    home: 'בית',
    newCollection: 'אוסף חדש',
    women: 'נשים',
    about: 'אודות',
    contact: 'צור קשר'
  }
}

export default function Navigation({ lng }: { lng: string }) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const isRTL = lng === 'he'
  const t = translations[lng as keyof typeof translations]

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
                onMouseEnter={() => setIsDropdownOpen(true)}
                onMouseLeave={() => setIsDropdownOpen(false)}
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
                    Shoes
                  </div>
                  {womenCategories.shoes.map((category) => (
                    <Link
                      key={category.name}
                      href={`/${lng}${category.href}`}
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      {category.name}
                    </Link>
                  ))}
                  <div className="px-4 py-2 text-sm font-medium text-gray-900 border-b border-gray-200 mt-2">
                    Accessories
                  </div>
                  {womenCategories.accessories.map((category) => (
                    <Link
                      key={category.name}
                      href={`/${lng}${category.href}`}
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      {category.name}
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
          <div className="flex items-center">
            <LanguageSwitcher currentLanguage={lng} />
          </div>
        </div>
      </div>
    </nav>
  )
}