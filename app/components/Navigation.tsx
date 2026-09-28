'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Menu, Heart, ShoppingBag, ChevronDown, User, X } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import DropdownLanguageSwitcher from './DropdownLanguageSwitcher'
import LazySearchBar from './LazySearchBar'
import MobileAuthGreeting from './MobileAuthGreeting'
import { useCart } from '@/app/hooks/useCart'
import { useFavorites } from '@/app/hooks/useFavorites'
import { useAuth } from '@/app/hooks/useAuth'
import { useUserProfile } from '@/app/hooks/useUserProfile'
import { getImageUrl } from '@/lib/image-urls'
import type { NavigationCategoriesData } from '@/lib/navigation-categories'
import { NAV_BAR_H } from '@/lib/header-layout'
import NavigationCategories from '@/app/components/NavigationCategories'
import {
  Sheet,
  SheetContent,
  SheetClose,
  SheetTitle,
} from '@/app/components/ui/sheet'
import { ScrollArea } from '@/app/components/ui/scroll-area'
import {
  WOMEN_BOGO_NAV_LINKS,
  womenSalesCampaignHref,
  womenSalesLinkLabel,
  womenSalesSectionTitle,
} from '@/lib/navigation/women-sales-nav'


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
    allProducts: 'Show All',
    signIn: 'Sign in',
    myProfile: 'My Profile',
    favorites: 'Favorites',
    shoppingCart: 'Shopping cart',
  },
  he: {
    home: 'בית',
    women: 'נשים',
    men: 'גברים',
    about: 'אודות',
    contact: 'צרו קשר',
    allWomen: 'לכל קולקצית הנשים',
    allMen: 'לכל קולקצית הגברים',
    categories: 'קטגוריות',
    allProducts: 'לכל המוצרים',
    signIn: 'התחברות',
    myProfile: 'הפרופיל שלי',
    favorites: 'מועדפים',
    shoppingCart: 'עגלת קניות',
  }
}

type NavIconLinkKey = 'favorites' | 'shoppingCart'

function getIconLinkAriaLabel(lng: string, key: NavIconLinkKey, count: number): string {
  const locale = lng === 'he' ? 'he' : 'en'
  const base = translations[locale][key]
  if (count <= 0) return base
  return lng === 'he' ? `${base}, ${count} פריטים` : `${base}, ${count} items`
}

export default function Navigation({
  lng,
  initialNavData,
}: {
  lng: string
  initialNavData: NavigationCategoriesData
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  // Transparent over the full-bleed hero at rest, solid once the page moves - the
  // design's two header variants (438:4393 Transparent / 438:4419 Solid). Starts
  // false so the server render matches the top-of-page state and does not flash.
  const [isScrolled, setIsScrolled] = useState(false)
  // Desktop navigation is a full-width dropdown under the bar (2016:2578), not the
  // drawer mobile uses, so it needs its own open state.
  const [isDesktopNavOpen, setIsDesktopNavOpen] = useState(false)
  const [isWomenDropdownOpen, setIsWomenDropdownOpen] = useState(false)
  const [isMenDropdownOpen, setIsMenDropdownOpen] = useState(false)

  // Read straight from the server prop rather than mirroring it into state.
  // The nav used to hold these in useState and re-fetch them from Firestore in
  // the browser on every tab focus, so the server HTML and the client could
  // show different category orders, and the order visibly changed mid-session.
  // Freshness after an admin edit is handled server-side by revalidating
  // NAVIGATION_CATEGORIES_TAG (see lib/navigation-categories.server.ts), which
  // updates every visitor rather than only whoever happened to switch tabs.
  const { availableCategories, womenSubcategories, menSubcategories } = initialNavData

  const [hoverTimeout, setHoverTimeout] = useState<NodeJS.Timeout | null>(null)
  const [openTimeout, setOpenTimeout] = useState<NodeJS.Timeout | null>(null)
  const [selectedGender, setSelectedGender] = useState<'women' | 'men'>('women')

  // Drives the Transparent -> Solid header swap. Read once on mount as well as on
  // scroll, because a restored scroll position or a deep link does not fire an
  // initial scroll event and the bar would otherwise stay transparent mid-page.
  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const { items } = useCart()
  const { favorites } = useFavorites()
  const { user, loading: authLoading } = useAuth()
  const pathname = usePathname()

  const favoritesAriaLabel = getIconLinkAriaLabel(lng, 'favorites', favorites.length)
  const cartAriaLabel = getIconLinkAriaLabel(lng, 'shoppingCart', items.length)

  // Desktop greeting state
  const { profile, isLoading: profileLoading } = useUserProfile()
  const greetingName = user
    ? profile?.firstName || user.displayName || (user.email ? user.email.split('@')[0] : null)
    : null

  // Close menu on route change
  useEffect(() => {
    if (isMobileMenuOpen) {
      setIsMobileMenuOpen(false)
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
    // Header, design system 438:4392 (desktop) / 438:4292 (mobile). No shadow and no
    // white ground: the design sits on surface-secondary under a hairline rule.
    // The icons stay ink-900 in both variants, per the design - so a hero that is
    // dark behind the bar would swallow them. Worth checking against real heroes.
    <nav
      className={`relative w-full border-b transition-colors duration-200 ${
        isScrolled
          ? 'border-text-primary/20 bg-surface-secondary/95 lg:border-sako-black lg:bg-surface-secondary'
          : 'border-transparent bg-transparent'
      }`}
    >
      <div className="mx-auto w-full px-[16px] lg:px-[36px]">
        {/* dir="ltr" is deliberate. This bar carries no directional text - icons, the
            Latin wordmark and MENU - and the Hebrew frames themselves put the icons
            left and MENU right. Fixing the direction makes both locales match the
            design rather than mirroring into an arrangement nobody drew. */}
        <div
          dir="ltr"
          className={`relative flex ${NAV_BAR_H} items-center justify-between`}
          onMouseLeave={handleNavigationMouseLeave}
        >
          {/* Left cluster — favourites, account, cart. Favourites occupies the slot the
              design gave to search; search has moved beside the menu control. Counts
              render as the design's 9px Ploni numeral inside the glyph rather than the
              old red badge. */}
          {/* Mobile gap is 3px, not the design's 13px, and that is the point: the
              design spaces bare 22px icons 13px apart, while these sit in 32px hit
              areas so touch targets stay usable. 3px + 2x5px of box padding lands the
              icons exactly 13px apart on screen. Desktop uses 20px verbatim because
              the desktop frame already boxes its icons at 32x36. */}
          <div className="flex items-center gap-[3px] lg:gap-[20px]">
            <Link
              href={`/${lng}/favorites`}
              className="relative flex h-[36px] w-[32px] items-center justify-center"
              suppressHydrationWarning
              aria-label={favoritesAriaLabel}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icons/sako/favorites.svg" width={22} height={22} alt="" aria-hidden="true" />
              {favorites.length > 0 && (
                <span
                  className="absolute inset-0 flex items-center justify-center pt-[3px] font-ploni text-[9px] text-text-primary"
                  aria-hidden="true"
                >
                  {favorites.length}
                </span>
              )}
            </Link>

            <Link
              href={`/${lng}/cart`}
              className="relative flex h-[36px] w-[32px] items-center justify-center"
              suppressHydrationWarning
              aria-label={cartAriaLabel}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icons/sako/cart.svg" width={22} height={22} alt="" aria-hidden="true" />
              <span
                className="absolute inset-0 flex items-center justify-center pt-[4px] font-ploni text-[9px] text-text-primary"
                aria-hidden="true"
              >
                {items.length}
              </span>
            </Link>
          </div>

          {/* Centred wordmark — Ploni Black 25/-1.4px on mobile (438:4307) stepping to
              28/-1.8px on desktop (438:4414). Absolutely centred so the two icon
              clusters, which are not equal widths, cannot push it off axis. */}
          <div className="absolute left-1/2 top-1/2 z-10 flex shrink-0 -translate-x-1/2 -translate-y-1/2 items-center px-1">
            <Link
              href={`/${lng}`}
              className="whitespace-nowrap font-ploni text-[25px] font-black leading-[25px] tracking-[-1.4px] text-text-primary lg:text-[28px] lg:leading-[38px] lg:tracking-[-1.8px]"
              suppressHydrationWarning
            >
              SAKO OR
            </Link>
          </div>

          {/* Desktop category navigation. The redesign moves all of this behind the
              MENU control (438:4522), so it no longer renders in the bar. The markup
              and its data wiring are parked rather than deleted: the drawer rebuild
              reuses the same NavigationCategoriesData, and deleting ~200 lines before
              that exists would throw away the only working consumer of it. */}
          <div className="hidden items-center space-x-8 flex-1 justify-center ml-8">
            <Link
              href={`/${lng}`}
              className="text-gray-700 hover:text-gray-900 transition-colors duration-200 px-2 py-1 rounded-md hover:bg-gray-50"
              suppressHydrationWarning
            >
              {translations[lng as keyof typeof translations].home}
            </Link>

            {/* Women Dropdown */}
            <div className="relative" data-dropdown>
              <button
                onMouseEnter={() => handleMouseEnter('women')}
                onMouseLeave={() => handleMouseLeave('women')}
                className={`flex items-center text-gray-700 hover:text-gray-900 transition-colors duration-200 px-2 py-1 rounded-md hover:bg-gray-50 ${isWomenDropdownOpen ? 'bg-gray-50' : ''}`}
                suppressHydrationWarning
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
                <div className="w-full px-20">
                  {/* Every enabled subcategory gets a column, so the row scrolls
                      rather than overflowing once there are more than a screen's
                      worth. Works in both directions - the browser flips the
                      scroll origin under dir="rtl". */}
                  <div className="grid grid-flow-col auto-cols-[minmax(150px,auto)] gap-x-20 justify-start overflow-x-auto pb-2">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">
                      {translations[lng as keyof typeof translations].categories}
                    </h3>

                    <Link
                      href={`/${lng}/collection/women`}
                      className="block text-sm text-gray-700 hover:text-gray-900 mb-1 transition-colors duration-150"
                      suppressHydrationWarning
                    >
                      {translations[lng as keyof typeof translations].allWomen}
                    </Link>
                  </div>

                  {womenSubcategories.map((subcategory) => (
                    <div key={subcategory.id} data-nav-subcategory={subcategory.slug}>
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        {subcategory.name}
                      </h3>

                      <Link
                        href={`/${lng}/collection/women/${subcategory.slug}`}
                        className="block text-sm text-gray-600 hover:text-gray-800 transition-colors duration-150 mb-1"
                        suppressHydrationWarning
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
                                suppressHydrationWarning
                              >
                                {subSubCategory.name}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}

                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">
                      {womenSalesSectionTitle(lng)}
                    </h3>
                    <ul className="space-y-1">
                      {WOMEN_BOGO_NAV_LINKS.map((link) => (
                        <li key={link.slug}>
                          <Link
                            href={womenSalesCampaignHref(lng, link.slug)}
                            className="block text-sm text-gray-600 hover:text-gray-800 transition-colors duration-150"
                            suppressHydrationWarning
                          >
                            {womenSalesLinkLabel(lng, link)}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                  </div>
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
                  suppressHydrationWarning
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
                  className="w-full px-20 grid grid-flow-col auto-cols-[minmax(150px,auto)] gap-x-20 justify-start overflow-x-auto pb-2"
                >
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">
                      {translations[lng as keyof typeof translations].categories}
                    </h3>

                    <Link
                      href={`/${lng}/collection/men`}
                      className="block text-sm text-gray-700 hover:text-gray-900 mb-1 transition-colors duration-150"
                      suppressHydrationWarning
                    >
                      {translations[lng as keyof typeof translations].allMen}
                    </Link>
                  </div>

                  {menSubcategories.map((subcategory) => (
                    <div key={subcategory.id} data-nav-subcategory={subcategory.slug}>
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        {subcategory.name}
                      </h3>

                      <Link
                        href={`/${lng}/collection/men/${subcategory.slug}`}
                        className="block text-sm text-gray-600 hover:text-gray-800 transition-colors duration-150 mb-1"
                        suppressHydrationWarning
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
                                suppressHydrationWarning
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
              suppressHydrationWarning
            >
              {translations[lng as keyof typeof translations].about}
            </Link>

            <Link
              href={`/${lng}/contact`}
              className="text-gray-700 hover:text-gray-900 transition-colors duration-200 px-2 py-1 rounded-md hover:bg-gray-50"
              suppressHydrationWarning
            >
              {translations[lng as keyof typeof translations].contact}
            </Link>
          </div>


          {/* Right cluster — search, then the menu control at the outer edge. Desktop
              shows the design's "MENU" wordmark with its two 18x1 rules (438:4415);
              mobile shows the ☰ glyph (438:4308), which the design sets as Ploni Bold
              text rather than an asset. */}
          <div className="flex items-center gap-[13px] lg:gap-[20px]">
            {/* No language switcher here by decision: the design has no slot for one
                and it was dropped from the bar deliberately, not by oversight.

                Search is desktop-only for now. On mobile it moves inside the
                navigation panel, so the bar there is just the ☰ control. */}
            <div className="hidden items-center lg:flex">
              <LazySearchBar language={lng} />
            </div>

            <div className="relative flex items-center justify-center">
              <Link
                href={user ? `/${lng}/profile` : `/${lng}/signin`}
                className="flex h-[36px] w-[32px] items-center justify-center"
                suppressHydrationWarning
                aria-label={
                  user
                    ? translations[lng as keyof typeof translations].myProfile
                    : translations[lng as keyof typeof translations].signIn
                }
                title={
                  user
                    ? translations[lng as keyof typeof translations].myProfile
                    : translations[lng as keyof typeof translations].signIn
                }
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/icons/sako/account.svg" width={22} height={22} alt="" aria-hidden="true" />
              </Link>
              {/* The signed-in greeting has no home in the design; kept, restyled. */}
              <span
                // Anchored to the right edge rather than centred: the account icon now
                // sits next to the menu control at the end of the bar, so a centred
                // greeting would hang off the viewport.
                className={`absolute top-full right-0 min-h-[14px] whitespace-nowrap pt-0.5 font-ploni text-[9px] leading-none text-text-secondary ${
                  user && !authLoading && !profileLoading && greetingName ? 'opacity-100' : 'opacity-0'
                }`}
                aria-hidden={!(user && greetingName)}
              >
                {greetingName
                  ? lng === 'he'
                    ? `היי, ${greetingName}`
                    : `Hi, ${greetingName}`
                  : ' '}
              </span>
            </div>

            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="flex items-center justify-center lg:hidden"
              aria-label="Menu"
              aria-expanded={isMobileMenuOpen}
              suppressHydrationWarning
            >
              <span aria-hidden="true" className="font-ploni text-[19px] font-bold leading-none text-text-primary">
                ☰
              </span>
            </button>

            <button
              onClick={() => setIsDesktopNavOpen((open) => !open)}
              className="hidden h-[22px] w-[70px] items-center justify-end gap-[6px] lg:flex"
              aria-label="Menu"
              aria-expanded={isDesktopNavOpen}
              suppressHydrationWarning
            >
              <span className="font-ploni text-[10px] tracking-[0.9px] text-text-primary">MENU</span>
              <span aria-hidden="true" className="flex w-[18px] shrink-0 flex-col gap-[1px]">
                <span className="h-px w-full bg-text-primary" />
                <span className="h-px w-full bg-text-primary" />
              </span>
            </button>
          </div>

          {/* Parked with the desktop category navigation above: the old right-hand
              cluster. Its favourites, cart and account controls now live in the left
              cluster, built from the design's own icon assets. */}
          <div className="hidden flex-1 items-center justify-end">
            <div className="hidden items-center space-x-4">
              <div className="relative flex items-center justify-center">
                <Link
                  href={user ? `/${lng}/profile` : `/${lng}/signin`}
                  className="relative text-gray-700 hover:text-gray-900 transition-colors duration-200 p-2 rounded-md hover:bg-gray-50 flex items-center justify-center"
                  suppressHydrationWarning
                  aria-label={
                    user
                      ? translations[lng as keyof typeof translations].myProfile
                      : translations[lng as keyof typeof translations].signIn
                  }
                  title={
                    user
                      ? translations[lng as keyof typeof translations].myProfile
                      : translations[lng as keyof typeof translations].signIn
                  }
                >
                  <User className="h-6 w-6" aria-hidden="true" />
                </Link>
                <span
                  className={`absolute top-full left-1/2 -translate-x-1/2 pt-0.5 text-[11px] text-gray-500 leading-none whitespace-nowrap min-h-[14px] ${
                    user && !authLoading && !profileLoading && greetingName ? 'opacity-100' : 'opacity-0'
                  }`}
                  aria-hidden={!(user && greetingName)}
                >
                  {greetingName
                    ? lng === 'he'
                      ? `היי, ${greetingName}`
                      : `Hi, ${greetingName}`
                    : '\u00A0'}
                </span>
              </div>
              <Link
                href={`/${lng}/cart`}
                className="relative text-gray-700 hover:text-gray-900 transition-colors duration-200 p-2 rounded-md hover:bg-gray-50"
                suppressHydrationWarning
                aria-label={cartAriaLabel}
              >
                <ShoppingBag className="h-5 w-5" aria-hidden="true" />
                {items.length > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-6 w-6 flex items-center justify-center font-bold z-10" aria-hidden="true">
                    {items.length}
                  </span>
                )}
              </Link>

              <Link
                href={`/${lng}/favorites`}
                className="relative text-gray-700 hover:text-gray-900 transition-colors duration-200 p-2 rounded-md hover:bg-gray-50"
                suppressHydrationWarning
                aria-label={favoritesAriaLabel}
              >
                <Heart className="h-5 w-5" aria-hidden="true" />
                {favorites.length > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-6 w-6 flex items-center justify-center font-bold z-10" aria-hidden="true">
                    {favorites.length}
                  </span>
                )}
              </Link>

              <DropdownLanguageSwitcher currentLanguage={lng} />
            </div>

            {/* Parked: superseded by the left cluster. */}
            <div className="hidden items-center">
              <Link
                href={`/${lng}/favorites`}
                className="relative text-gray-700 hover:text-gray-900 transition-colors duration-200 p-2"
                suppressHydrationWarning
                aria-label={favoritesAriaLabel}
              >
                <Heart className="h-5 w-5" aria-hidden="true" />
                {favorites.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold z-10" aria-hidden="true">
                    {favorites.length}
                  </span>
                )}
              </Link>

              <Link
                href={`/${lng}/cart`}
                className="relative text-gray-700 hover:text-gray-900 transition-colors duration-200 p-2"
                suppressHydrationWarning
                aria-label={cartAriaLabel}
              >
                <ShoppingBag className="h-5 w-5" aria-hidden="true" />
                {items.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold z-10" aria-hidden="true">
                    {items.length}
                  </span>
                )}
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop navigation panel (2016:2578) — a full-width dropdown under the bar
          rather than a drawer. Below lg the ☰ opens the Sheet instead. */}
      {isDesktopNavOpen && (
        <div
          dir={lng === 'he' ? 'rtl' : 'ltr'}
          // Height follows content. The frame's 595px is the artboard's figure, not a
          // rule — pinning it left the panel tall and empty once the rows shrank. The
          // viewport cap is only a guard so a long category list scrolls instead of
          // running off-screen; it is not what sizes the panel.
          className="absolute inset-x-0 top-full z-[70] hidden max-h-[calc(100vh-var(--nav-bar-h,73px))] overflow-auto border-t border-sako-black bg-surface-secondary lg:block"
        >
          <NavigationCategories
            lng={lng === 'he' ? 'he' : 'en'}
            variant="panel"
            selectedGender={selectedGender}
            onSelectGender={setSelectedGender}
            womenSubcategories={womenSubcategories}
            menSubcategories={menSubcategories}
            hasMen={hasMenCategory()}
            labels={{
              allWomen: translations[lng as keyof typeof translations].allWomen,
              allMen: translations[lng as keyof typeof translations].allMen,
              allProducts: translations[lng as keyof typeof translations].allProducts,
              women: translations[lng as keyof typeof translations].women,
              men: translations[lng as keyof typeof translations].men,
            }}
            onNavigate={() => setIsDesktopNavOpen(false)}
            aside={
              // The frame fills this half with two campaign photographs, but those are
              // content rather than design assets and have no source yet. It sits on
              // the panel's own ground rather than the frame's near-black: an empty
              // black slab across half the viewport reads as a heavy blind, which is
              // most of what made the open panel feel like it was burying the hero.
              // The column still holds its half so the rows keep the design's measure
              // instead of stretching the full width of a wide desktop.
              <div className="bg-surface-secondary" aria-hidden="true" />
            }
          />
        </div>
      )}

      {/* Mobile Menu - Sheet Component */}
      <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
        <SheetContent
          side={lng === 'he' ? 'right' : 'left'}
          // No longer md:hidden: the redesign routes desktop category navigation
          // through this same panel, since MENU is now the only way in.
          className="p-0 flex flex-col"
          dir={lng === 'he' ? 'rtl' : 'ltr'}
          // The floating default close sits absolute top-4 in the inline-start
          // corner, right on top of the search field's magnifier. This panel lays
          // out its own on a dedicated row instead.
          hideClose
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {/* Visually hidden title for accessibility */}
          <SheetTitle className="sr-only">
            {lng === 'he' ? 'תפריט נייד' : 'Mobile Menu'}
          </SheetTitle>
          
          {/* Close sits on its own row at the inline-start edge — the same corner the
              ☰ occupies in the header, so the control returns to where it was tapped,
              and clear of the search field's magnifier. */}
          <div className="flex shrink-0 items-center justify-start px-[16px] pt-[12px]">
            <SheetClose
              className="flex h-[32px] w-[32px] items-center justify-center text-text-primary transition-opacity hover:opacity-70"
              aria-label={lng === 'he' ? 'סגירת התפריט' : 'Close menu'}
            >
              <X className="h-[22px] w-[22px]" strokeWidth={1.25} aria-hidden="true" />
            </SheetClose>
          </div>

          {/* Search, in its own bordered band (2014:2506/2507) */}
          <div className="border-b border-sako-black px-[16px] pb-[16px] pt-[8px]">
            <LazySearchBar language={lng} variant="inline" />
          </div>

          {/* Department tabs (2014:2515). The active tab carries the d5d2cc ground;
              the inactive one sits on the panel ground with its label at 20% and a
              dividing rule. No pill, no radius — this design system has neither. */}
          <div className="grid h-[44px] shrink-0 grid-cols-2 border-b border-sako-black">
            <button
              onClick={() => setSelectedGender('women')}
              className={`flex items-center justify-center transition-colors ${
                selectedGender === 'women' ? 'bg-surface-tab-active' : 'bg-surface-secondary'
              }`}
              aria-pressed={selectedGender === 'women'}
              suppressHydrationWarning
            >
              {/* The 20% dim is on the label, not the tab: the design fades the text
                  while the inactive tab keeps a full-strength ground. */}
              <span
                className={`font-ploni text-[19px] font-bold leading-[19px] text-text-primary ${
                  selectedGender === 'women' ? '' : 'opacity-20'
                }`}
              >
                {translations[lng as keyof typeof translations].women}
              </span>
            </button>
            {hasMenCategory() && (
              <button
                onClick={() => setSelectedGender('men')}
                className={`flex items-center justify-center border-e border-sako-black transition-colors ${
                  selectedGender === 'men' ? 'bg-surface-tab-active' : 'bg-surface-secondary'
                }`}
                aria-pressed={selectedGender === 'men'}
                suppressHydrationWarning
              >
                <span
                  className={`font-ploni text-[19px] font-bold leading-[19px] text-text-primary ${
                    selectedGender === 'men' ? '' : 'opacity-20'
                  }`}
                >
                  {translations[lng as keyof typeof translations].men}
                </span>
              </button>
            )}
          </div>

          {/* Scrollable Categories List — the same component the desktop panel
              renders, at drawer scale, so the two surfaces cannot drift. */}
          <ScrollArea className="flex-1">
            <div>
              <NavigationCategories
                lng={lng === 'he' ? 'he' : 'en'}
                variant="drawer"
                selectedGender={selectedGender}
                onSelectGender={setSelectedGender}
                womenSubcategories={womenSubcategories}
                menSubcategories={menSubcategories}
                hasMen={hasMenCategory()}
                labels={{
                  allWomen: translations[lng as keyof typeof translations].allWomen,
                  allMen: translations[lng as keyof typeof translations].allMen,
                  allProducts: translations[lng as keyof typeof translations].allProducts,
                  women: translations[lng as keyof typeof translations].women,
                  men: translations[lng as keyof typeof translations].men,
                }}
                onNavigate={() => setIsMobileMenuOpen(false)}
              />
              {/* Mobile Auth Greeting Component */}
              <div className="pt-2">
                <MobileAuthGreeting lng={lng} />
              </div>
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </nav>
  )
}