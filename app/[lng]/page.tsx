'use client'

import React, { useState, useEffect } from 'react'
import { track } from '@vercel/analytics';
import Image from 'next/image'
import Link from 'next/link'
import { useParams, usePathname } from 'next/navigation'
import { getImageUrl, getHeroDesktopVideoUrl, getHeroMobileVideoUrl, getSakoOrMobileVideoUrl } from '@/lib/image-urls'
import CountdownPopup from '@/app/components/CountdownPopup'
import ProductCarousel from '@/app/components/ProductCarousel'
import { productService } from '@/lib/firebase'
import { Product } from '@/lib/firebase'
import CollectionTiles from '@/app/components/CollectionTiles'


// Hardcoded translations for build-time rendering
const translations = {
  en: {
    brandName: 'Sako Or',
    holidayCollection: 'Holiday Collection',
    forHer: 'FOR HER',
    forHim: 'FOR HIM',
    heroDescription: 'End of year sales on all winter collections!',  //'Discover our curated collection of premium footwear, sourced from Europe\'s finest artisans and China\'s most prestigious manufacturers.',
    exploreCollections: 'Explore Winter Collections',  //'Explore Collections',
    collectionsTitle: 'Curated Collections',
    collectionsDescription: 'Each piece in our collection represents the perfect harmony of design, comfort, and craftsmanship',
    viewCollection: 'View Collection',
    featuredTitle: 'Featured Pieces',
    featuredDescription: 'Discover our most coveted designs, each telling a unique story of luxury and sophistication',
    saleBadge: 'Sale',
    salePriceLabel: 'Now',
    newsletterTitle: 'Join Our World',
    newsletterDescription: 'Subscribe to receive exclusive updates, early access to new collections, and personalized style recommendations.',
    emailPlaceholder: 'Enter your email',
    subscribeButton: 'Subscribe',
    emailRequired: 'Email is required',
    emailInvalid: 'Please enter a valid email address',
    subscriptionError: 'Failed to subscribe. Please try again.'
  },
  he: {
    brandName: 'סכו עור', // Don't fix it!!
    holidayCollection: 'קולקציית החגים',
    forHer: 'לנשים',
    forHim: 'לגברים',
    heroDescription:  'מבצעי סוף עונה על כל קולקציית החורף!',   //'גלי את האוסף המוקפד שלנו של נעליים יוקרתיות, שמקורן מהאומנים הטובים ביותר באירופה והיצרנים היוקרתיים ביותר בסין',
    exploreCollections:  'מבצעי סוף העונה',  //'לקולקציה החדשה',
    collectionsTitle: 'אוספים מוקפדים',
    collectionsDescription: 'כל חלק באוסף שלנו מייצג הרמוניה מושלמת של עיצוב, נוחות ואומנות',
    viewCollection: 'צפה באוסף',
    featuredTitle: 'יצירות מובילות',
    featuredDescription: 'גלי את העיצובים הנחשקים ביותר שלנו, כל אחד מספר סיפור ייחודי של יוקרה ותחכום',
    saleBadge: 'מבצע',
    salePriceLabel: 'עכשיו',
    newsletterTitle: 'הצטרפי לעולמנו',
    newsletterDescription: 'הירשמי לקבלת עדכונים בלעדיים, גישה מוקדמת לאוספים חדשים והמלצות סגנון מותאמות אישית.',
    emailPlaceholder: 'הזן את האימייל שלך',
    subscribeButton: 'הירשם',
    emailRequired: 'נדרש אימייל',
    emailInvalid: 'אנא הזן כתובת אימייל תקינה',
    subscriptionError: 'ההרשמה נכשלה. אנא נסה שוב.'
  }
}

export default function Home() {
  const params = useParams()
  const pathname = usePathname()
  const [showCountdownPopup, setShowCountdownPopup] = useState(false)
  const [bestSellers, setBestSellers] = useState<Product[]>([])
  const [sakoOrProducts, setSakoOrProducts] = useState<Product[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [loadingSakoOrProducts, setLoadingSakoOrProducts] = useState(true)

  // Extract language from pathname or params to avoid hydration mismatch
  // Prioritize pathname (available during SSR) for consistency between server and client
  // Fallback to params only if pathname doesn't provide a valid language
  const lng = React.useMemo((): 'en' | 'he' => {
    // Try pathname first (available during SSR and consistent on both server and client)
    if (pathname) {
      const pathSegments = pathname.split('/').filter(Boolean)
      const langFromPath = pathSegments[0]
      if (langFromPath === 'he' || langFromPath === 'en') {
        return langFromPath
      }
    }
    // Fallback to params (available after hydration, but may not be during SSR)
    if (params?.lng && (params.lng === 'he' || params.lng === 'en')) {
      return params.lng as 'en' | 'he'
    }
    return 'en'
  }, [pathname, params?.lng])

  // Fetch best sellers products
  useEffect(() => {
    const fetchBestSellers = async () => {
      try {
        setLoadingProducts(true)
        // Fetch featured products or newest products as best sellers
        const products = await productService.getAllProducts({
          isActive: true,
          limit: 12, // Limit to 12 products for the carousel
        })
        setBestSellers(products)
      } catch (error) {
        console.error('Error fetching best sellers:', error)
      } finally {
        setLoadingProducts(false)
      }
    }

    fetchBestSellers()
  }, [])

  // Fetch SAKO-OR brand products (random order)
  useEffect(() => {
    const fetchSakoOrProducts = async () => {
      try {
        setLoadingSakoOrProducts(true)
        // Fetch more products to get better randomness, then shuffle and limit
        const allProducts = await productService.getAllProducts({
          isActive: true,
          brand: 'SAKO-OR',
          limit: 50, // Fetch more for better randomness
        })
        
        // Shuffle array using Fisher-Yates algorithm
        const shuffled = [...allProducts]
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
        }
        
        // Take first 15 after shuffling
        setSakoOrProducts(shuffled.slice(0, 15))
      } catch (error) {
        console.error('Error fetching SAKO-OR products:', error)
      } finally {
        setLoadingSakoOrProducts(false)
      }
    }

    fetchSakoOrProducts()
  }, [])

  // Show countdown popup on home page
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Small delay to ensure component is fully mounted
      const timer = setTimeout(() => {
        setShowCountdownPopup(true)
      }, 500) // 500ms delay to ensure everything is ready
      
      return () => clearTimeout(timer)
    }
  }, [])

  const isRTL = lng === 'he'
  
  // Get translations for current language
  const t = translations[lng]

  const heroImageSrc = getImageUrl("/images/hero/main-hero.jpg")
  const heroDesktopVideoSrc = getHeroDesktopVideoUrl()
  const heroMobileVideoSrc = getHeroMobileVideoUrl()
  const sakoOrMobileVideoSrc = getSakoOrMobileVideoUrl()

  return (
    <div className={`pt-[104px] ${isRTL ? 'text-right' : 'text-left'}`} style={{ backgroundColor: '#FFFFFF' }}>
      {/* Hero section */}
      <div className="relative aspect-[3/4] md:aspect-[21/9]">
        <div className="absolute inset-0 flex md:block items-center justify-center bg-black md:bg-transparent md:overflow-hidden">
          <video
            className="hidden md:block h-full w-full object-cover"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            // poster={heroImageSrc}
            aria-hidden="true"
          >
            <source src={heroDesktopVideoSrc} type="video/mp4" />
          </video>
          <video
            className="block md:hidden h-full w-full object-cover"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            //poster={heroImageSrc}
            aria-hidden="true"

          >
            <source src={heroMobileVideoSrc} type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-neutral-900/60" aria-hidden="true" />
        </div>
        <div className="relative h-full flex flex-col items-center text-center">
          <div className="absolute bottom-[15%] md:bottom-[10%] left-0 right-0 max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold text-white tracking-tight text-center uppercase" style={{ fontFamily: 'Assistant, sans-serif' }}>
              SAKO OR
            </h1>
          </div>
          <div className="absolute bottom-6 md:bottom-8 left-0 right-0 flex flex-row gap-6 md:gap-8 justify-center items-center px-4">
            <Link
              onClick={() => track('new_collection_for_her')}
              href={`/${lng}/collection/women/shoes`}
              className="text-white text-base md:text-xl font-light tracking-wide underline decoration-white underline-offset-4 hover:opacity-80 transition-opacity duration-300" style={{ fontFamily: 'Assistant, sans-serif' }}>
              {lng === 'he' ? 'לקולקציה החדשה' : 'To New Collection'}
            </Link>
            <Link
              onClick={() => track('outlet_collection_for_her')}
              href={`/${lng}/collection/women/outlet`}
              className="text-white text-base md:text-xl font-light tracking-wide underline decoration-white underline-offset-4 hover:opacity-80 transition-opacity duration-300" style={{ fontFamily: 'Assistant, sans-serif' }}>
              {lng === 'he' ? 'לכל המבצעים' : 'To Sales'}
            </Link>
          </div>
        </div>
      </div>

      {/* Product Carousel - Best Sellers */}
      {!loadingProducts && bestSellers.length > 0 && (
        <ProductCarousel
          products={bestSellers}
          title={lng === 'he' ? 'הנמכרים ביותר' : 'Best Sellers'}
          language={lng as 'en' | 'he'}
        />
      )}

      {/* Hero section - Second */}
      <div className="relative aspect-[3/4] md:aspect-[21/9]">
        <div className="absolute inset-0 flex md:block items-center justify-center bg-black md:bg-transparent md:overflow-hidden">
          <video
            className="hidden md:block h-full w-full object-cover"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            // poster={heroImageSrc}
            aria-hidden="true"
          >
            <source src={heroDesktopVideoSrc} type="video/mp4" />
          </video>
          <video
            className="block md:hidden h-full w-full object-cover"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            //poster={heroImageSrc}
            aria-hidden="true"

          >
            <source src={sakoOrMobileVideoSrc} type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-neutral-900/60" aria-hidden="true" />
        </div>
         <div className="relative h-full flex items-center justify-center text-center">
          <div className="absolute bottom-[10%] md:bottom-[10%] left-0 right-0 max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold text-white tracking-tight text-center uppercase hero-text-fade-in" style={{ fontFamily: 'Assistant, sans-serif', opacity: 0 }}>
              SAKO OR EXCLUSIVE
            </h1>
            </div>
            </div>
      </div>

      {/* Product Carousel - SAKO-OR Products - Second */}
      {!loadingSakoOrProducts && sakoOrProducts.length > 0 && (
        <ProductCarousel
          products={sakoOrProducts}
          title={'Only at SAKO OR'}
          language={lng as 'en' | 'he'}
        />
      )}

      {/* Collection Tiles - under Hero #2 */}
      <CollectionTiles lng={lng} />

      {/* Countdown Popup */}
      {/* <CountdownPopup
        isOpen={showCountdownPopup}
        onClose={() => setShowCountdownPopup(false)}
        targetDate="2025-12-09T23:59:59"
        ctaUrl={`/${lng}/collection/campaign?slug=dec-sales`}
        lng={lng}
      /> */}
    </div>
  )
} 