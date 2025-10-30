'use client'

import Link from 'next/link'
import { Menu, X, Heart, ShoppingBag, ChevronDown } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import DropdownLanguageSwitcher from './DropdownLanguageSwitcher'
import SearchBar from './SearchBar'
import { useCart } from '@/app/hooks/useCart'
import { useFavorites } from '@/app/hooks/useFavorites'
import { categoryService } from '@/lib/firebase'


// Hardcoded translations for build-time rendering
const translations = {
  en: {
    home: 'Home',
    women: 'Women',
    men: 'Men',
    about: 'About',
    contact: 'Contact',
    allWomen: 'All Women',
    allMen: 'All Men',
    categories: 'Categories',
    allProducts: 'Show All'
  },
  he: {
    home: 'בית',
    women: 'נשים',
    men: 'גברים',
    about: 'אודות',
    contact: 'צרו קשר',
    allWomen: 'כל קולקצית הנשים',
    allMen: 'כל קולקצית הגברים',
    categories: 'קטגוריות',
    allProducts: 'לכל המוצרים'
  }
}

export default function Navigation({ lng }: { lng: string }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [womenSubcategories, setWomenSubcategories] = useState<Array<{ id: string, slug: string, name: string, subChildren?: Array<{ id: string, slug: string, name: string }> }>>([])
  const [menSubcategories, setMenSubcategories] = useState<Array<{ id: string, slug: string, name: string, subChildren?: Array<{ id: string, slug: string, name: string }> }>>([])
  const [isWomenDropdownOpen, setIsWomenDropdownOpen] = useState(false)
  const [isMenDropdownOpen, setIsMenDropdownOpen] = useState(false)
  const [availableCategories, setAvailableCategories] = useState<Array<{ id: string, slug: string, name: string, level: number }>>([])
  const [hoverTimeout, setHoverTimeout] = useState<NodeJS.Timeout | null>(null)
  const [openTimeout, setOpenTimeout] = useState<NodeJS.Timeout | null>(null)
  const drawerRef = useRef<HTMLDivElement>(null)

  // Mobile navigation state
  const [mobileNavLevel, setMobileNavLevel] = useState<'main' | 'women' | 'men' | 'women-sub' | 'men-sub'>('main')
  const [selectedMobileCategory, setSelectedMobileCategory] = useState<{ id: string, slug: string, name: string, subChildren?: Array<{ id: string, slug: string, name: string }> } | null>(null)

  const { items } = useCart()
  const { favorites } = useFavorites()

  // Helper functions to check if categories exist
  const hasWomenCategory = () => {
    return availableCategories.some(cat =>
      cat.level === 0 && cat.slug.toLowerCase() === 'women'
    )
  }

  const hasMenCategory = () => {
    return availableCategories.some(cat =>
      cat.level === 0 && cat.slug.toLowerCase() === 'men'
    )
  }

  // Function to refresh navigation categories
  const refreshNavigation = async () => {
    try {
      const navCategories = await categoryService.getNavigationCategories()

      // Store available categories for dynamic rendering
      setAvailableCategories(navCategories.map(cat => ({
        id: cat.id!,
        slug: typeof cat.slug === 'string' ? cat.slug : cat.slug?.en || '',
        name: typeof cat.name === 'string' ? cat.name : cat.name?.en || '',
        level: cat.level
      })))


      // Find Women and Men categories and fetch their subcategories
      const womenCategory = navCategories.find(cat =>
        cat.level === 0 &&
        (typeof cat.slug === 'string' ? cat.slug : cat.slug?.en || '').toLowerCase() === 'women'
      )

      const menCategory = navCategories.find(cat =>
        cat.level === 0 &&
        (typeof cat.slug === 'string' ? cat.slug : cat.slug?.en || '').toLowerCase() === 'men'
      )

      // Fetch subcategories for Women and Men
      if (womenCategory?.id) {
        const womenSubs = await categoryService.getSubCategories(womenCategory.id)

        // Fetch sub-sub-categories for each subcategory
        const womenSubsWithChildren = await Promise.all(womenSubs.map(async (sub) => {
          const subChildren = await categoryService.getSubCategories(sub.id!)
          return {
            id: sub.id!,
            slug: typeof sub.slug === 'string' ? sub.slug : sub.slug?.en || '',
            name: typeof sub.name === 'string' ? sub.name : (lng === 'he' ? sub.name?.he : sub.name?.en) || '',
            subChildren: subChildren.map(child => ({
              id: child.id!,
              slug: typeof child.slug === 'string' ? child.slug : child.slug?.en || '',
              name: typeof child.name === 'string' ? child.name : (lng === 'he' ? child.name?.he : child.name?.en) || ''
            }))
          }
        }))

        setWomenSubcategories(womenSubsWithChildren)
      }

      if (menCategory?.id) {
        const menSubs = await categoryService.getSubCategories(menCategory.id)

        // Fetch sub-sub-categories for each subcategory
        const menSubsWithChildren = await Promise.all(menSubs.map(async (sub) => {
          const subChildren = await categoryService.getSubCategories(sub.id!)
          return {
            id: sub.id!,
            slug: typeof sub.slug === 'string' ? sub.slug : sub.slug?.en || '',
            name: typeof sub.name === 'string' ? sub.name : (lng === 'he' ? sub.name?.he : sub.name?.en) || '',
            subChildren: subChildren.map(child => ({
              id: child.id!,
              slug: typeof child.slug === 'string' ? child.slug : child.slug?.en || '',
              name: typeof child.name === 'string' ? child.name : (lng === 'he' ? child.name?.he : child.name?.en) || ''
            }))
          }
        }))

        setMenSubcategories(menSubsWithChildren)
      }
    } catch (error) {
      console.error('Error refreshing navigation categories:', error)
    }
  }

  // Fetch navigation categories and subcategories on mount
  useEffect(() => {
    refreshNavigation()
  }, [lng])

  // Add listener for page visibility changes to refresh navigation when user returns
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Page became visible, refresh navigation
        refreshNavigation()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeout) {
        clearTimeout(hoverTimeout)
      }
      if (openTimeout) {
        clearTimeout(openTimeout)
      }
    }
  }, [hoverTimeout, openTimeout]) // Both timeouts are needed for cleanup

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      if (!target.closest('[data-dropdown]')) {
        setIsWomenDropdownOpen(false)
        setIsMenDropdownOpen(false)
        if (hoverTimeout) {
          clearTimeout(hoverTimeout)
          setHoverTimeout(null)
        }
        if (openTimeout) {
          clearTimeout(openTimeout)
          setOpenTimeout(null)
        }
      }
    }

    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [hoverTimeout, openTimeout]) // Both timeouts are needed for cleanup

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false)
    setMobileNavLevel('main')
    setSelectedMobileCategory(null)
  }

  const navigateToLevel = (level: 'main' | 'women' | 'men' | 'women-sub' | 'men-sub', category?: { id: string, slug: string, name: string, subChildren?: Array<{ id: string, slug: string, name: string }> }) => {
    setMobileNavLevel(level)
    setSelectedMobileCategory(category || null)
  }

  const navigateBack = () => {
    switch (mobileNavLevel) {
      case 'women-sub':
        setMobileNavLevel('women')
        setSelectedMobileCategory(null)
        break
      case 'men-sub':
        setMobileNavLevel('men')
        setSelectedMobileCategory(null)
        break
      case 'women':
      case 'men':
        setMobileNavLevel('main')
        setSelectedMobileCategory(null)
        break
      default:
        setMobileNavLevel('main')
        setSelectedMobileCategory(null)
    }
  }

  const handleMouseEnter = (dropdown: 'women' | 'men') => {
    // Clear any existing timeouts
    if (hoverTimeout) {
      clearTimeout(hoverTimeout)
      setHoverTimeout(null)
    }
    if (openTimeout) {
      clearTimeout(openTimeout)
      setOpenTimeout(null)
    }

    // Set a delay before opening the dropdown
    const timeout = setTimeout(() => {
      // Close the other dropdown to prevent overlap
      if (dropdown === 'women') {
        setIsMenDropdownOpen(false)
        setIsWomenDropdownOpen(true)
      } else {
        setIsWomenDropdownOpen(false)
        setIsMenDropdownOpen(true)
      }
    }, 300) // 300ms delay before opening

    setOpenTimeout(timeout)
  }

  const handleMouseLeave = (dropdown: 'women' | 'men') => {
    // Clear any existing timeouts
    if (hoverTimeout) {
      clearTimeout(hoverTimeout)
    }
    if (openTimeout) {
      clearTimeout(openTimeout)
      setOpenTimeout(null)
    }

    const timeout = setTimeout(() => {
      if (dropdown === 'women') {
        setIsWomenDropdownOpen(false);
      } else {
        setIsMenDropdownOpen(false);
      }
      setHoverTimeout(null);
    }, 200); // 200ms delay before closing

    setHoverTimeout(timeout)
  }

  const handleDropdownMouseEnter = () => {
    // Clear timeouts when mouse enters dropdown
    if (hoverTimeout) {
      clearTimeout(hoverTimeout)
      setHoverTimeout(null)
    }
    if (openTimeout) {
      clearTimeout(openTimeout)
      setOpenTimeout(null)
    }
  }

  const handleNavigationMouseLeave = () => {
    // Close all dropdowns when mouse leaves navigation area
    if (hoverTimeout) {
      clearTimeout(hoverTimeout)
    }
    if (openTimeout) {
      clearTimeout(openTimeout)
    }
    setIsWomenDropdownOpen(false)
    setIsMenDropdownOpen(false)
    setHoverTimeout(null)
    setOpenTimeout(null)
  }



  return (
    <nav className="shadow-lg fixed w-full top-0 z-50" style={{ backgroundColor: '#FFFFFF' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div
          className="flex justify-between items-center h-16"
          onMouseLeave={handleNavigationMouseLeave}
        >
          {/* Logo */}
          <div className="flex items-center">
            <Link href={`/${lng}`} className="text-1xl font-bold text-gray-900">
              SAKO OR
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            <Link
              href={`/${lng}`}
              className="text-gray-700 hover:text-gray-900 transition-colors duration-200 px-2 py-1 rounded-md hover:bg-gray-50"
            >
              {translations[lng as keyof typeof translations].home}
            </Link>

            {/* Women Dropdown */}
            <div className="relative" data-dropdown>
              <button
                onMouseEnter={() => handleMouseEnter('women')}
                onMouseLeave={() => handleMouseLeave('women')}
                className={`flex items-center text-gray-700 hover:text-gray-900 transition-colors duration-200 px-2 py-1 rounded-md hover:bg-gray-50 ${isWomenDropdownOpen ? 'bg-gray-50' : ''}`}
              >
                {translations[lng as keyof typeof translations].women}
                <ChevronDown className="ml-1 h-4 w-4" />
              </button>
            </div>

            {/*{isWomenDropdownOpen && (
                <div
                  className="absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-white shadow-lg border border-gray-200 rounded-md py-6 px-6 z-50 grid grid-cols-3 gap-8 min-w-[700px]"
                  onMouseEnter={handleDropdownMouseEnter}
                  onMouseLeave={() => handleMouseLeave('women')}
                >
                  {// All Women Link }
                  <Link
                    href={`/${lng}/collection/women`}
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 font-medium transition-colors duration-150 border-b border-gray-100 mb-3"
                  >
                    {translations[lng as keyof typeof translations].allWomen}
                  </Link>

                  {// Subcategories }
                  {womenSubcategories.map((subcategory) => (
                    <div key={subcategory.id}>
                      <Link
                        href={`/${lng}/collection/women/${subcategory.slug}`}
                      //  className="block px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-100 hover:text-gray-900 transition-colors duration-150"
                      className="block text-base font-semibold text-gray-900 mb-2 hover:text-gray-600"
                      >
                        {typeof subcategory.name === 'object' ? (subcategory.name as any).en : subcategory.name}
                      </Link>

                      {// Sub-sub-categories }
                      {subcategory.subChildren && subcategory.subChildren.length > 0 && (
                        /*<div className="pl-6 space-y-1">
                          {subcategory.subChildren.map((subSubCategory) => (
                            <Link
                              key={subSubCategory.id}
                              href={`/${lng}/collection/women/${subcategory.slug}/${subSubCategory.slug}`}
                              className="block px-4 py-1.5 text-xs text-gray-600 hover:bg-gray-100 hover:text-gray-800 transition-colors duration-150"
                            >
                              {typeof subSubCategory.name === 'object' ? (subSubCategory.name as any).en : subSubCategory.name}
                            </Link>
                          ))}
                        </div>*//*

                        <ul className="pl-4 space-y-1">
                          {subcategory.subChildren.map((subSubCategory) => (
                            <li key={subSubCategory.id}>
                              <Link
                                href={`/${lng}/collection/women/${subcategory.slug}/${subSubCategory.slug}`}
                                className="block text-sm text-gray-600 hover:text-gray-800 transition-colors duration-150"
                              >
                                {typeof subSubCategory.name === 'object'
                                  ? (subSubCategory.name as any).en
                                  : subSubCategory.name}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}*/}


            {isWomenDropdownOpen && (
              <div
                dir={lng === 'he' ? 'rtl' : 'ltr'}
                className={`absolute top-full left-0 w-full mt-2 bg-white shadow-lg border-t border-gray-200 py-10 z-50
                ${lng === 'he' ? 'text-right' : 'text-left'}
                before:content-[''] before:absolute before:top-[-15px] before:left-0 before:w-full before:h-[20px] before:bg-transparent`}
                onMouseEnter={handleDropdownMouseEnter}
                onMouseLeave={() => handleMouseLeave('women')}
              >
                <div
                  className="w-full px-20 grid grid-flow-col auto-cols-min gap-x-20 justify-start"

                >
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">
                      {translations[lng as keyof typeof translations].categories}
                    </h3>

                    <Link
                      href={`/${lng}/collection/women`}
                      className="block text-sm text-gray-700 hover:text-gray-900 mb-1 transition-colors duration-150"
                    >
                      {translations[lng as keyof typeof translations].allWomen}
                    </Link>
                  </div>

                  {womenSubcategories.slice(0, 3).map((subcategory) => (
                    <div key={subcategory.id}>
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        {subcategory.name}
                      </h3>

                      <Link
                        href={`/${lng}/collection/women/${subcategory.slug}`}
                        className="block text-sm text-gray-600 hover:text-gray-800 transition-colors duration-150 mb-1"
                      >
                        {translations[lng as keyof typeof translations].allProducts}
                      </Link>



                      {subcategory.subChildren && subcategory.subChildren.length > 0 && (
                        <ul className="space-y-1">
                          {subcategory.subChildren.map((subSubCategory) => (
                            <li key={subSubCategory.id}>
                              <Link
                                href={`/${lng}/collection/women/${subcategory.slug}/${subSubCategory.slug}`}
                                className="block text-sm text-gray-600 hover:text-gray-800 transition-colors duration-150"
                              >
                                {subSubCategory.name}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Men Dropdown - Only show if Men category exists */}
            {hasMenCategory() && (
              <div
                dir={lng === 'he' ? 'rtl' : 'ltr'}
                className={`absolute top-full left-0 w-full mt-2 bg-white shadow-lg border-t border-gray-200 py-10 z-50
                ${lng === 'he' ? 'text-right' : 'text-left'}
                before:content-[''] before:absolute before:top-[-15px] before:left-0 before:w-full before:h-[20px] before:bg-transparent`}
                onMouseEnter={handleDropdownMouseEnter}
                onMouseLeave={() => handleMouseLeave('men')}
              >
                <div
                  className="w-full px-20 grid grid-flow-col auto-cols-min gap-x-20 justify-start"

                >
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">
                      {translations[lng as keyof typeof translations].categories}
                    </h3>

                    <Link
                      href={`/${lng}/collection/men`}
                      className="block text-sm text-gray-700 hover:text-gray-900 mb-1 transition-colors duration-150"
                    >
                      {translations[lng as keyof typeof translations].allMen}
                    </Link>
                  </div>

                  {menSubcategories.slice(0, 3).map((subcategory) => (
                    <div key={subcategory.id}>
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        {subcategory.name}
                      </h3>

                      <Link
                        href={`/${lng}/collection/men/${subcategory.slug}`}
                        className="block text-sm text-gray-600 hover:text-gray-800 transition-colors duration-150 mb-1"
                      >
                        {translations[lng as keyof typeof translations].allProducts}
                      </Link>



                      {subcategory.subChildren && subcategory.subChildren.length > 0 && (
                        <ul className="space-y-1">
                          {subcategory.subChildren.map((subSubCategory) => (
                            <li key={subSubCategory.id}>
                              <Link
                                href={`/${lng}/collection/men/${subcategory.slug}/${subSubCategory.slug}`}
                                className="block text-sm text-gray-600 hover:text-gray-800 transition-colors duration-150"
                              >
                                {subSubCategory.name}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Link
              href={`/${lng}/about`}
              className="text-gray-700 hover:text-gray-900 transition-colors duration-200 px-2 py-1 rounded-md hover:bg-gray-50"
            >
              {translations[lng as keyof typeof translations].about}
            </Link>

            <Link
              href={`/${lng}/contact`}
              className="text-gray-700 hover:text-gray-900 transition-colors duration-200 px-2 py-1 rounded-md hover:bg-gray-50"
            >
              {translations[lng as keyof typeof translations].contact}
            </Link>
          </div>


          {/* Right side icons */}
          <div className="flex items-center space-x-4">
            {/* Search Bar next to cart and favorites */}
            <SearchBar language={lng} />
            <Link
              href={`/${lng}/cart`}
              className="relative text-gray-700 hover:text-gray-900 transition-colors duration-200 p-2 rounded-md hover:bg-gray-50"
            >
              <ShoppingBag className="h-5 w-5" />
              {items.length > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-6 w-6 flex items-center justify-center font-bold z-10">
                  {items.length}
                </span>
              )}
            </Link>

            <Link
              href={`/${lng}/favorites`}
              className="relative text-gray-700 hover:text-gray-900 transition-colors duration-200 p-2 rounded-md hover:bg-gray-50"
            >
              <Heart className="h-5 w-5" />
              {favorites.length > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-6 w-6 flex items-center justify-center font-bold z-10">
                  {favorites.length}
                </span>
              )}
            </Link>

            <DropdownLanguageSwitcher currentLanguage={lng} />

            {/* Mobile menu button */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden text-gray-700 hover:text-gray-900"
            >
              <Menu className="h-6 w-6" />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="fixed inset-0 bg-black/20 bg-opacity-50" onClick={closeMobileMenu} />

          <div className="fixed top-0 left-0 h-full w-80 bg-white shadow-xl">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">Menu</h2>
              <button
                onClick={closeMobileMenu}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div
              ref={drawerRef}
              className="overflow-y-auto h-full pb-20"
            >
              <div className="p-4">
                {/* Header with back button (if not on main level) */}
                {mobileNavLevel !== 'main' && (
                  <div className="flex items-center mb-6 pb-4 border-b border-gray-200">
                    <button
                      onClick={navigateBack}
                      className="flex items-center text-gray-600 hover:text-gray-900 mr-3 p-2 rounded-md hover:bg-gray-50"
                    >
                      <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>

                    </button>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {mobileNavLevel === 'women' && translations[lng as keyof typeof translations].women}
                      {mobileNavLevel === 'men' && translations[lng as keyof typeof translations].men}
                      {mobileNavLevel === 'women-sub' && (typeof selectedMobileCategory?.name === 'object' ? (selectedMobileCategory.name as any).en : selectedMobileCategory?.name)}
                      {mobileNavLevel === 'men-sub' && (typeof selectedMobileCategory?.name === 'object' ? (selectedMobileCategory.name as any).en : selectedMobileCategory?.name)}
                    </h3>
                  </div>
                )}

                {/* Main Level */}
                {mobileNavLevel === 'main' && (
                  <>
                    <Link
                      href={`/${lng}`}
                      onClick={closeMobileMenu}
                      className="block py-3 text-gray-700 hover:text-gray-900 border-b border-gray-100"
                    >
                      {translations[lng as keyof typeof translations].home}
                    </Link>

                    <button
                      onClick={() => navigateToLevel('women')}
                      className="block w-full text-left py-3 text-gray-700 hover:text-gray-900 border-b border-gray-100 font-medium flex items-center justify-between"
                    >
                      {translations[lng as keyof typeof translations].women}
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>

                    {hasMenCategory() && (
                      <button
                        onClick={() => navigateToLevel('men')}
                        className="block w-full text-left py-3 text-gray-700 hover:text-gray-900 border-b border-gray-100 font-medium flex items-center justify-between"
                      >
                        {translations[lng as keyof typeof translations].men}
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    )}

                    <Link
                      href={`/${lng}/about`}
                      onClick={closeMobileMenu}
                      className="block py-3 text-gray-700 hover:text-gray-900 border-b border-gray-100"
                    >
                      {translations[lng as keyof typeof translations].about}
                    </Link>

                    <Link
                      href={`/${lng}/contact`}
                      onClick={closeMobileMenu}
                      className="block py-3 text-gray-700 hover:text-gray-900 border-b border-gray-100"
                    >
                      {translations[lng as keyof typeof translations].contact}
                    </Link>
                  </>
                )}

                {/* Women Level */}
                {mobileNavLevel === 'women' && (
                  <>
                    <Link
                      href={`/${lng}/collection/women`}
                      onClick={closeMobileMenu}
                      className="block py-3 text-gray-700 hover:text-gray-900 border-b border-gray-100 font-medium"
                    >
                      {translations[lng as keyof typeof translations].allWomen}
                    </Link>

                    {womenSubcategories.map((subcategory) => (
                      <div key={subcategory.id}>
                        {subcategory.subChildren && subcategory.subChildren.length > 0 ? (
                          <button
                            onClick={() => navigateToLevel('women-sub', subcategory)}
                            className="block w-full text-left py-3 text-gray-600 hover:text-gray-900 border-b border-gray-100 flex items-center justify-between"
                          >
                            {typeof subcategory.name === 'object' ? (subcategory.name as any).en : subcategory.name}
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        ) : (
                          <Link
                            href={`/${lng}/collection/women/${subcategory.slug}`}
                            onClick={closeMobileMenu}
                            className="block py-3 text-gray-600 hover:text-gray-900 border-b border-gray-100"
                          >
                            {typeof subcategory.name === 'object' ? (subcategory.name as any).en : subcategory.name}
                          </Link>
                        )}
                      </div>
                    ))}
                  </>
                )}

                {/* Men Level - Only show if Men category exists */}
                {mobileNavLevel === 'men' && hasMenCategory() && (
                  <>
                    <Link
                      href={`/${lng}/collection/men`}
                      onClick={closeMobileMenu}
                      className="block py-3 text-gray-700 hover:text-gray-900 border-b border-gray-100 font-medium"
                    >
                      {translations[lng as keyof typeof translations].allMen}
                    </Link>

                    {menSubcategories.map((subcategory) => (
                      <div key={subcategory.id}>
                        {subcategory.subChildren && subcategory.subChildren.length > 0 ? (
                          <button
                            onClick={() => navigateToLevel('men-sub', subcategory)}
                            className="block w-full text-left py-3 text-gray-600 hover:text-gray-900 border-b border-gray-100 flex items-center justify-between"
                          >
                            {typeof subcategory.name === 'object' ? (subcategory.name as any).en : subcategory.name}
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        ) : (
                          <Link
                            href={`/${lng}/collection/men/${subcategory.slug}`}
                            onClick={closeMobileMenu}
                            className="block py-3 text-gray-600 hover:text-gray-900 border-b border-gray-100"
                          >
                            {typeof subcategory.name === 'object' ? (subcategory.name as any).en : subcategory.name}
                          </Link>
                        )}
                      </div>
                    ))}
                  </>
                )}

                {/* Women Sub-sub-categories Level */}
                {mobileNavLevel === 'women-sub' && selectedMobileCategory && (
                  <>
                    {selectedMobileCategory.subChildren?.map((subSubCategory) => (
                      <Link
                        key={subSubCategory.id}
                        href={`/${lng}/collection/women/${selectedMobileCategory.slug}/${subSubCategory.slug}`}
                        onClick={closeMobileMenu}
                        className="block py-3 text-gray-600 hover:text-gray-900 border-b border-gray-100"
                      >
                        {typeof subSubCategory.name === 'object' ? (subSubCategory.name as any).en : subSubCategory.name}
                      </Link>
                    ))}
                  </>
                )}

                {/* Men Sub-sub-categories Level - Only show if Men category exists */}
                {mobileNavLevel === 'men-sub' && selectedMobileCategory && hasMenCategory() && (
                  <>
                    {selectedMobileCategory.subChildren?.map((subSubCategory) => (
                      <Link
                        key={subSubCategory.id}
                        href={`/${lng}/collection/men/${selectedMobileCategory.slug}/${subSubCategory.slug}`}
                        onClick={closeMobileMenu}
                        className="block py-3 text-gray-600 hover:text-gray-900 border-b border-gray-100"
                      >
                        {typeof subSubCategory.name === 'object' ? (subSubCategory.name as any).en : subSubCategory.name}
                      </Link>
                    ))}
                  </>
                )}

                {/* Mobile Cart and Favorites Icons */}
                <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 bg-white">
                  <div className="flex items-center justify-center space-x-8">
                    <Link
                      href={`/${lng}/favorites`}
                      onClick={closeMobileMenu}
                      className="relative text-gray-700 hover:text-gray-900 transition-colors duration-200 p-3 rounded-md hover:bg-gray-50"
                    >
                      <Heart className="h-6 w-6" />
                      {favorites.length > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-6 w-6 flex items-center justify-center font-bold z-10">
                          {favorites.length}
                        </span>
                      )}
                    </Link>

                    <Link
                      href={`/${lng}/cart`}
                      onClick={closeMobileMenu}
                      className="relative text-gray-700 hover:text-gray-900 transition-colors duration-200 p-3 rounded-md hover:bg-gray-50"
                    >
                      <ShoppingBag className="h-6 w-6" />
                      {items.length > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-6 w-6 flex items-center justify-center font-bold z-10">
                          {items.length}
                        </span>
                      )}
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}