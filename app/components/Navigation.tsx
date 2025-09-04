'use client'

import Link from 'next/link'
import { ChevronDown, Menu, X, ArrowLeft } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import LanguageSwitcher from './LanguageSwitcher'

// Navigation structure for mobile drawer
const getNavigationStructure = (lng: string) => ({
  women: {
    name: { en: 'Women', he: 'נשים' },
    children: {
      shoes: {
        name: { en: 'Shoes', he: 'נעליים' },
        children: {
          highHeels: { name: { en: 'High Heels', he: 'עקבים גבוהים' }, href: `/${lng}/collection/women/shoes/high-heels` },
          boots: { name: { en: 'Boots', he: 'מגפיים' }, href: `/${lng}/collection/women/shoes/boots` },
          oxford: { name: { en: 'Oxford', he: 'אוקספורד' }, href: `/${lng}/collection/women/shoes/oxford` },
          sneakers: { name: { en: 'Sneakers', he: 'סניקרס' }, href: `/${lng}/collection/women/shoes/sneakers` },
          sandals: { name: { en: 'Sandals', he: 'סנדלים' }, href: `/${lng}/collection/women/shoes/sandals` },
          slippers: { name: { en: 'Slippers', he: 'כפכפים' }, href: `/${lng}/collection/women/shoes/slippers` }
        }
      },
      accessories: {
        name: { en: 'Accessories', he: 'אביזרים' },
        children: {
          coats: { name: { en: 'Coats', he: 'מעילים' }, href: `/${lng}/collection/women/accessories/coats` },
          bags: { name: { en: 'Bags', he: 'תיקים' }, href: `/${lng}/collection/women/accessories/bags` }
        }
      }
    }
  }
})

// Legacy structure for desktop dropdown (keeping for compatibility)
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
  
  // Mobile drawer state
  const [drawerStack, setDrawerStack] = useState<any[]>([])
  const [scrollPositions, setScrollPositions] = useState<number[]>([])
  const [animationDirection, setAnimationDirection] = useState<'forward' | 'backward' | null>(null)
  const drawerRef = useRef<HTMLDivElement>(null)
  const isRTL = lng === 'he'
  const t = translations[lng as keyof typeof translations]

  // Initialize drawer with top-level categories
  useEffect(() => {
    if (isMobileMenuOpen && drawerStack.length === 0) {
      const navigationStructure = getNavigationStructure(lng)
      const topLevelCategories = [
        { key: 'home', name: t.home, href: `/${lng}` },
        { key: 'collection', name: t.newCollection, href: `/${lng}/collection` },
        { key: 'women', name: t.women, children: navigationStructure.women.children },
        { key: 'about', name: t.about, href: `/${lng}/about` },
        { key: 'contact', name: t.contact, href: `/${lng}/contact` }
      ]
      setDrawerStack([topLevelCategories])
    }
  }, [isMobileMenuOpen, lng, t])

  // Handle ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMobileMenuOpen) {
        closeMobileMenu()
      }
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [isMobileMenuOpen])

  // Focus trap
  useEffect(() => {
    if (isMobileMenuOpen && drawerRef.current) {
      const focusableElements = drawerRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      const firstElement = focusableElements[0] as HTMLElement
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement

      const handleTabKey = (e: KeyboardEvent) => {
        if (e.key === 'Tab') {
          if (e.shiftKey) {
            if (document.activeElement === firstElement) {
              lastElement?.focus()
              e.preventDefault()
            }
          } else {
            if (document.activeElement === lastElement) {
              firstElement?.focus()
              e.preventDefault()
            }
          }
        }
      }

      firstElement?.focus()
      document.addEventListener('keydown', handleTabKey)
      return () => document.removeEventListener('keydown', handleTabKey)
    }
  }, [isMobileMenuOpen, drawerStack])

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false)
    setIsMobileWomenOpen(false)
    setDrawerStack([])
    setScrollPositions([])
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

  const navigateToSubcategory = (category: any) => {
    if (category.children && !animationDirection) {
      setAnimationDirection('forward')
      
      // Save current scroll position
      const currentScroll = drawerRef.current?.scrollTop || 0
      const newScrollPositions = [...scrollPositions, currentScroll]
      setScrollPositions(newScrollPositions)
      
      // Convert children object to array
      const childrenArray = Object.entries(category.children).map(([key, value]: [string, any]) => ({
        key,
        ...value
      }))
      
      // Small delay to allow exit animation to start
      setTimeout(() => {
        setDrawerStack([...drawerStack, childrenArray])
        // Reset animation direction after new content is loaded
        setTimeout(() => setAnimationDirection(null), 50)
      }, 150)
    }
  }

  const navigateBack = () => {
    if (drawerStack.length > 1 && !animationDirection) {
      setAnimationDirection('backward')
      
      // Restore scroll position
      const newScrollPositions = [...scrollPositions]
      const previousScroll = newScrollPositions.pop() || 0
      setScrollPositions(newScrollPositions)
      
      setDrawerStack(drawerStack.slice(0, -1))
      
      // Restore scroll position after animation
      setTimeout(() => {
        if (drawerRef.current) {
          drawerRef.current.scrollTop = previousScroll
        }
        setAnimationDirection(null)
      }, 300)
    }
  }

  const handleCategoryClick = (category: any) => {
    if (category.href) {
      // Navigate to page
      window.location.href = category.href
    } else if (category.children) {
      // Navigate to subcategory
      navigateToSubcategory(category)
    }
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
          <div className="flex items-center gap-3">
            <LanguageSwitcher currentLanguage={lng} />
            
            {/* Mobile menu button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="sm:hidden p-1 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
            >
              {isMobileMenuOpen ? (
                <X className="h-6 w-8" />
              ) : (
                <Menu className="h-6 w-8" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {isMobileMenuOpen && (
        <>
          {/* Overlay */}
          <div 
            className="fixed inset-0 bg-black/40 z-40 sm:hidden"
            onClick={closeMobileMenu}
          />
          
          {/* Drawer */}
          <div 
            ref={drawerRef}
            className="fixed top-0 left-0 h-full w-80 max-w-[85vw] bg-white shadow-xl z-50 sm:hidden transform transition-transform duration-300 ease-in-out"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            style={{
              transform: isMobileMenuOpen ? 'translateX(0)' : 'translateX(-100%)'
            }}
          >
            {/* Drawer Content */}
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">
                  {drawerStack.length > 1 ? (
                    <button
                      onClick={navigateBack}
                      className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
                      aria-label="Back"
                    >
                      <ArrowLeft className="h-5 w-5" />
                      Back
                    </button>
                  ) : (
                    'Menu'
                  )}
                </h2>
                <button
                  onClick={closeMobileMenu}
                  className="p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                  aria-label="Close menu"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              
              {/* Navigation Items */}
              <div className="flex-1 overflow-y-auto">
                <div 
                  className={`p-4 space-y-1 transition-all duration-300 ease-in-out ${
                    animationDirection === 'forward' 
                      ? 'transform -translate-x-full opacity-0' 
                      : animationDirection === 'backward'
                      ? 'transform translate-x-full opacity-0'
                      : 'transform translate-x-0 opacity-100'
                  }`}
                >
                  {drawerStack[drawerStack.length - 1]?.map((category: any, index: number) => (
                    <button
                      key={`${category.key}-${index}`}
                      onClick={() => handleCategoryClick(category)}
                      className="w-full text-left px-4 py-3 text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-md flex items-center justify-between group transition-colors duration-200"
                    >
                      <span>
                        {category.name?.[lng as keyof typeof category.name] || category.name}
                      </span>
                      {category.children && (
                        <ChevronDown className="h-4 w-4 text-gray-400 group-hover:text-gray-600 transition-colors duration-200" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </nav>
  )
}