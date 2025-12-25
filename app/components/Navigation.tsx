'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Menu, X, Heart, ShoppingBag, ChevronDown } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import DropdownLanguageSwitcher from './DropdownLanguageSwitcher'
import SearchBar from './SearchBar'
import { useCart } from '@/app/hooks/useCart'
import { useFavorites } from '@/app/hooks/useFavorites'
import { categoryService } from '@/lib/firebase'
import { getImageUrl } from '@/lib/image-urls'
import { motion, AnimatePresence } from "framer-motion"

// Category Accordion Item Component with smooth animation
function CategoryAccordionItem({
  categoryId,
  isExpanded,
  hasChildren,
  categoryName,
  subcategory,
  selectedGender,
  lng,
  onToggle,
  onLinkClick,
  translations
}: {
  categoryId: string
  isExpanded: boolean
  hasChildren: boolean
  categoryName: string
  subcategory: { id: string, slug: string, name: string, subChildren?: Array<{ id: string, slug: string, name: string }> }
  selectedGender: 'women' | 'men'
  lng: string
  onToggle: () => void
  onLinkClick: () => void
  translations: {
    en: { allProducts: string }
    he: { allProducts: string }
  }
}) {
  const contentRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number | "auto">(0)
  const [opacity, setOpacity] = useState<number>(0)

  useEffect(() => {
    const contentEl = contentRef.current
    const innerEl = innerRef.current
    if (!contentEl || !innerEl || !hasChildren) {
      if (!isExpanded) {
        setHeight(0)
        setOpacity(0)
      }
      return
    }

    if (isExpanded) {
      const startHeight = contentEl.getBoundingClientRect().height
      const targetHeight = innerEl.scrollHeight

      setOpacity(1)
      setHeight(startHeight)
      requestAnimationFrame(() => {
        setHeight(targetHeight)
      })
    } else {
      // Closing: Get the height we captured before state change
      const storedHeight = contentEl.getAttribute('data-closing-height')
      const currentHeight = storedHeight 
        ? parseFloat(storedHeight) 
        : (contentEl.getBoundingClientRect().height || innerEl.scrollHeight || 0)
      
      if (currentHeight > 0) {
        // Set to the captured height first to ensure smooth transition
        setHeight(currentHeight)
        // Remove the data attribute
        contentEl.removeAttribute('data-closing-height')
        // Then animate to 0 on the next frame
        requestAnimationFrame(() => {
          setHeight(0)
          setOpacity(0)
        })
      } else {
        setHeight(0)
        setOpacity(0)
      }
    }
  }, [isExpanded, hasChildren])

  const onTransitionEnd = () => {
    const contentEl = contentRef.current
    if (!contentEl) return
    
    // After opening finishes, let height be auto for responsive content
    if (isExpanded && height !== "auto") {
      setHeight("auto")
    }
    // Clean up any remaining data attributes
    contentEl.removeAttribute('data-closing-height')
  }

  if (!hasChildren) {
    return (
      <div className="border-b border-gray-200">
        <Link
          href={`/${lng}/collection/${selectedGender}/${subcategory.slug}`}
          onClick={onLinkClick}
          className="flex items-center justify-between min-h-[44px] py-3 px-2 text-gray-700 hover:text-gray-900 transition-colors"
          dir={lng === 'he' ? 'rtl' : 'ltr'}
        >
          <span className="text-sm uppercase tracking-wide">{categoryName}</span>
        </Link>
      </div>
    )
  }

  return (
    <div className="border-b border-gray-200">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between min-h-[44px] py-3 px-2 text-gray-700 hover:text-gray-900 transition-colors"
        dir={lng === 'he' ? 'rtl' : 'ltr'}
      >
        <span className="text-sm uppercase tracking-wide">{categoryName}</span>
        <ChevronDown 
          className={`h-5 w-5 text-gray-400 transition-transform duration-300 ease-in-out ${isExpanded ? 'rotate-180' : ''}`}
        />
      </button>
      <div
        id={`category-content-${categoryId}`}
        ref={contentRef}
        onTransitionEnd={onTransitionEnd}
        style={{
          height: height === "auto" ? "auto" : `${height}px`,
          opacity: opacity,
          transition: 'height 300ms cubic-bezier(0.4, 0, 0.2, 1), opacity 300ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
        className="overflow-hidden"
      >
        <div ref={innerRef} className="bg-gray-50 border-t border-gray-100">
          <Link
            href={`/${lng}/collection/${selectedGender}/${subcategory.slug}`}
            onClick={onLinkClick}
            className="block min-h-[44px] py-3 px-6 text-gray-600 hover:text-gray-900 text-sm font-medium border-b border-gray-200"
            dir={lng === 'he' ? 'rtl' : 'ltr'}
          >
            {translations[lng as keyof typeof translations].allProducts}
          </Link>
          {subcategory.subChildren?.map((subSubCategory) => {
            const subSubName = typeof subSubCategory.name === 'object'
              ? (lng === 'he' ? (subSubCategory.name as any).he : (subSubCategory.name as any).en) || (subSubCategory.name as any).en
              : subSubCategory.name
            return (
              <Link
                key={subSubCategory.id}
                href={`/${lng}/collection/${selectedGender}/${subcategory.slug}/${subSubCategory.slug}`}
                onClick={onLinkClick}
                className="block min-h-[44px] py-3 px-6 text-gray-600 hover:text-gray-900 text-sm border-b border-gray-200 last:border-b-0"
                dir={lng === 'he' ? 'rtl' : 'ltr'}
              >
                {subSubName}
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}


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
  const [selectedGender, setSelectedGender] = useState<'women' | 'men'>('women')
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

  const { items } = useCart()
  const { favorites } = useFavorites()
  const pathname = usePathname()

  // Close menu on route change
  useEffect(() => {
    if (isMobileMenuOpen) {
      closeMobileMenu()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

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
    setExpandedCategories(new Set())
    // Unlock body scroll
    document.body.style.overflow = ''
  }

  // Lock/unlock body scroll when menu opens/closes
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isMobileMenuOpen])

  // Handle ESC key to close menu
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMobileMenuOpen) {
        closeMobileMenu()
      }
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [isMobileMenuOpen])

  const toggleCategory = (categoryId: string) => {
    // If closing, capture height before state change
    const isCurrentlyExpanded = expandedCategories.has(categoryId)
    if (isCurrentlyExpanded) {
      const contentElement = document.getElementById(`category-content-${categoryId}`)
      if (contentElement) {
        // Capture the current rendered height before closing
        const currentHeight = contentElement.getBoundingClientRect().height
        // Store it in a data attribute so the component can access it
        contentElement.setAttribute('data-closing-height', currentHeight.toString())
      }
    }
    
    setExpandedCategories(prev => {
      const newSet = new Set(prev)
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId)
      } else {
        newSet.add(categoryId)
      }
      return newSet
    })
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
    <nav className="shadow-lg fixed w-full top-10 z-50" style={{ backgroundColor: '#FFFFFF' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div
          className="flex justify-between items-center h-16"
          onMouseLeave={handleNavigationMouseLeave}
        >
          {/* Desktop: Logo on left */}
          <div className="hidden md:flex items-center">
            <Link href={`/${lng}`} className="text-1xl font-bold text-gray-900">
              SAKO OR
            </Link>
          </div>

          {/* Mobile Layout: Three-column layout */}
          {/* Left: Menu + Search */}
          <div className="flex items-center flex-1 md:hidden">
            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="text-gray-700 hover:text-gray-900 p-2"
              aria-label="Menu"
            >
              <Menu className="h-6 w-6" />
            </button>

            {/* Search Bar */}
            <div className={lng === 'he' ? 'mr-2' : 'ml-2'}>
              <SearchBar language={lng} />
            </div>
          </div>

          {/* Center: Logo (Mobile only, positioned more to the left) */}
          <div className="flex-1 flex justify-start items-center md:hidden ml-1">
            <Link href={`/${lng}`}>
              <span className="text-xl font-bold text-gray-900">SAKO OR</span>
            </Link>
          </div>

          {/* Desktop Navigation - Center */}
          <div className="hidden md:flex items-center space-x-8 flex-1 justify-center ml-8">
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

            {isWomenDropdownOpen && (
              <div
                dir={lng === 'he' ? 'rtl' : 'ltr'}
                style={{ left: 0, right: 0, width: '100vw' }}
                className={`absolute top-[99%] left-0 right-0 w-screen bg-white shadow-lg border-t border-gray-200 py-10 z-50
                ${lng === 'he' ? 'text-right' : 'text-left'}
                before:content-[''] before:absolute before:top-[-100px] before:left-0 before:w-full before:h-[20px] before:bg-transparent`}
                onMouseEnter={handleDropdownMouseEnter}
                onMouseLeave={() => handleMouseLeave('women')}
              >
                <div
                  className="w-full px-20 grid grid-flow-col auto-cols-[minmax(150px,auto)] gap-x-20 justify-start"

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
              <div className="relative" data-dropdown>
                <button
                  onMouseEnter={() => handleMouseEnter('men')}
                  onMouseLeave={() => handleMouseLeave('men')}
                  className={`flex items-center text-gray-700 hover:text-gray-900 transition-colors duration-200 px-2 py-1 rounded-md hover:bg-gray-50 ${isMenDropdownOpen ? 'bg-gray-50' : ''}`}
                >
                  {translations[lng as keyof typeof translations].men}
                  <ChevronDown className="ml-1 h-4 w-4" />
                </button>
              </div>
            )}

            {isMenDropdownOpen && hasMenCategory() && (
              <div
                dir={lng === 'he' ? 'rtl' : 'ltr'}
                style={{ left: 0, right: 0, width: '100vw' }}
                className={`absolute top-[99%] left-0 right-0 w-screen bg-white shadow-lg border-t border-gray-200 py-10 z-50
                ${lng === 'he' ? 'text-right' : 'text-left'}
                before:content-[''] before:absolute before:top-[-100px] before:left-0 before:w-full before:h-[20px] before:bg-transparent`}
                onMouseEnter={handleDropdownMouseEnter}
                onMouseLeave={() => handleMouseLeave('men')}
              >
                <div
                  className="w-full px-20 grid grid-flow-col auto-cols-[minmax(150px,auto)] gap-x-20 justify-start"

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


          {/* Right side icons - Desktop and Mobile */}
          <div className="flex items-center">
            {/* Desktop: Search Bar, Cart, Favorites, Language Switcher */}
            <div className="hidden md:flex items-center space-x-4">
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
            </div>

            {/* Mobile: Favorites and Cart (right side) */}
            <div className="flex items-center space-x-2 md:hidden">
              <Link
                href={`/${lng}/favorites`}
                className="relative text-gray-700 hover:text-gray-900 transition-colors duration-200 p-2"
              >
                <Heart className="h-5 w-5" />
                {favorites.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold z-10">
                    {favorites.length}
                  </span>
                )}
              </Link>

              <Link
                href={`/${lng}/cart`}
                className="relative text-gray-700 hover:text-gray-900 transition-colors duration-200 p-2"
              >
                <ShoppingBag className="h-5 w-5" />
                {items.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold z-10">
                    {items.length}
                  </span>
                )}
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Menu - New Dropdown Design */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/40 z-[60] md:hidden"
              onClick={closeMobileMenu}
            />

            {/* Dropdown Panel - Anchored to bottom of nav bar */}
            <motion.div
              initial={{ y: -200 }}
              animate={{ y: 0 }}
              exit={{ y: -400 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed left-0 right-0 bg-white shadow-2xl z-[71] md:hidden overflow-hidden"
              style={{
                top: '102px', // Below nav bar (top-10 = 40px + h-16 = 64px + 2px for border)
                maxHeight: 'calc(104vh - 102px)',
              }}
            >
            {/* MEN/WOMEN Toggle */}
            <div className="border-b border-gray-200 px-4 py-3">
              <div className="flex rounded-lg bg-gray-100 p-1" dir={lng === 'he' ? 'rtl' : 'ltr'}>
                <button
                  onClick={() => {
                    setSelectedGender('women')
                    setExpandedCategories(new Set())
                  }}
                  className={`flex-1 py-2.5 px-4 text-sm font-medium rounded-md transition-all duration-200 ${
                    selectedGender === 'women'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {translations[lng as keyof typeof translations].women.toUpperCase()}
                </button>
                {hasMenCategory() && (
                  <button
                    onClick={() => {
                      setSelectedGender('men')
                      setExpandedCategories(new Set())
                    }}
                    className={`flex-1 py-2.5 px-4 text-sm font-medium rounded-md transition-all duration-200 ${
                      selectedGender === 'men'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {translations[lng as keyof typeof translations].men.toUpperCase()}
                  </button>
                )}
              </div>
            </div>

            {/* Categories List */}
            <div
              ref={drawerRef}
              className="overflow-y-auto"
              style={{ maxHeight: 'calc(100vh - 200px)' }}
            >
              <div className="px-4 py-2">
                {/* All Products Link */}
                <Link
                  href={`/${lng}/collection/${selectedGender}`}
                  onClick={closeMobileMenu}
                  className="flex items-center justify-between min-h-[44px] py-3 px-2 text-gray-900 font-medium border-b border-gray-200 uppercase text-sm tracking-wide"
                  dir={lng === 'he' ? 'rtl' : 'ltr'}
                >
                  <span>{selectedGender === 'women' ? translations[lng as keyof typeof translations].allWomen : translations[lng as keyof typeof translations].allMen}</span>
                </Link>

                {/* Categories List with Accordion */}
                {(selectedGender === 'women' ? womenSubcategories : menSubcategories).map((subcategory) => {
                  const hasChildren = subcategory.subChildren && subcategory.subChildren.length > 0
                  const isExpanded = expandedCategories.has(subcategory.id)
                  const categoryName = typeof subcategory.name === 'object' 
                    ? (lng === 'he' ? (subcategory.name as any).he : (subcategory.name as any).en) || (subcategory.name as any).en
                    : subcategory.name

                  return (
                    <CategoryAccordionItem
                      key={subcategory.id}
                      categoryId={subcategory.id}
                      isExpanded={isExpanded}
                      hasChildren={hasChildren ?? false}
                      categoryName={categoryName}
                      subcategory={subcategory}
                      selectedGender={selectedGender}
                      lng={lng}
                      onToggle={() => toggleCategory(subcategory.id)}
                      onLinkClick={closeMobileMenu}
                      translations={translations}
                    />
                  )
                })}

              </div>
            </div>
          </motion.div>
          </>
        )}
      </AnimatePresence>
    </nav>
  )
}