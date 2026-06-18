'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { track } from '@vercel/analytics'
import Link from 'next/link'
import Image from 'next/image'
import { useParams, usePathname } from 'next/navigation'
import {
  getImageUrl,
  getSummerSaleHeroDesktopImageUrl,
  getSummerSaleHeroMobileImageUrl,
  getSakoOrMobileVideoUrl,
  getSakoOrDesktopVideoUrl,
  getHero3DesktopVideoUrl,
  getHero3MobileVideoUrl,
} from '@/lib/image-urls'
import ProductCarousel from '@/app/components/ProductCarousel'
import { type Product } from '@/lib/firebase'
import CollectionTiles from '@/app/components/CollectionTiles'

/** Hero video block: poster, programmatic play, tap-to-play when blocked, and play only when in view (independent). */
function HeroVideoSection({
  desktopSrc,
  mobileSrc,
  posterSrc,
  children,
  overlayOpacity = 'bg-neutral-900/60',
  desktopObjectPosition = 'center',
  mobileObjectPosition = 'center',
}: {
  desktopSrc: string
  mobileSrc: string
  posterSrc: string
  children?: React.ReactNode
  overlayOpacity?: string
  /** CSS object-position for desktop media (e.g. "center top", "50% 20%") */
  desktopObjectPosition?: string
  /** CSS object-position for mobile media (e.g. "center top", "50% 20%") */
  mobileObjectPosition?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const desktopRef = useRef<HTMLVideoElement>(null)
  const mobileRef = useRef<HTMLVideoElement>(null)
  const [showPlayButton, setShowPlayButton] = useState(false)
  const [isInView, setIsInView] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  const isVideoSrc = useCallback((src: string) => src.toLowerCase().includes('.mp4'), [])
  const hasDesktopVideo = isVideoSrc(desktopSrc)
  const hasMobileVideo = isVideoSrc(mobileSrc)

  // Prefer playing only when section is in view so each hero feels independent and we avoid multiple videos fighting
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setIsInView(entry.isIntersecting)
        })
      },
      { threshold: 0.25, rootMargin: '0px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  const playCurrent = useCallback(async () => {
    const video = isMobile ? mobileRef.current : desktopRef.current
    if (!video) return
    try {
      await video.play()
      setShowPlayButton(false)
    } catch {
      setShowPlayButton(true)
    }
  }, [isMobile])

  useEffect(() => {
    if (!hasDesktopVideo && !hasMobileVideo) return
    if (!isInView) {
      desktopRef.current?.pause()
      mobileRef.current?.pause()
      return
    }
    const video = isMobile ? mobileRef.current : desktopRef.current
    if (!video) return
    const p = video.play()
    if (p && typeof p.catch === 'function') {
      p.catch(() => setShowPlayButton(true))
    }
  }, [isInView, isMobile, hasDesktopVideo, hasMobileVideo])

  // Hide play overlay when video actually starts (e.g. after user tap or delayed autoplay)
  useEffect(() => {
    if (!hasDesktopVideo && !hasMobileVideo) return
    const video = isMobile ? mobileRef.current : desktopRef.current
    if (!video) return
    const onPlaying = () => setShowPlayButton(false)
    video.addEventListener('playing', onPlaying)
    return () => video.removeEventListener('playing', onPlaying)
  }, [isMobile, hasDesktopVideo, hasMobileVideo])

  return (
    <div ref={containerRef} className="relative aspect-[3/4] md:aspect-[21/9]">
      <div
        className={`absolute inset-0 flex md:block items-center justify-center bg-black md:bg-transparent md:overflow-hidden ${
          showPlayButton ? 'z-10' : 'z-0'
        }`}
      >
        {hasDesktopVideo ? (
          <video
            ref={desktopRef}
            className="hidden md:block h-full w-full object-cover"
            style={{ objectPosition: desktopObjectPosition }}
            muted
            loop
            playsInline
            preload="metadata"
            poster={posterSrc}
            aria-hidden="true"
          >
            <source src={desktopSrc} type="video/mp4" />
          </video>
        ) : (
          <Image
            src={desktopSrc || posterSrc}
            alt=""
            fill
            sizes="(min-width: 768px) 100vw, 0px"
            className="hidden md:block object-cover"
            style={{ objectPosition: desktopObjectPosition }}
            priority={false}
            aria-hidden="true"
          />
        )}

        {hasMobileVideo ? (
          <video
            ref={mobileRef}
            className="block md:hidden h-full w-full object-cover"
            style={{ objectPosition: mobileObjectPosition }}
            muted
            loop
            playsInline
            preload="metadata"
            poster={posterSrc}
            aria-hidden="true"
          >
            <source src={mobileSrc} type="video/mp4" />
          </video>
        ) : (
          <Image
            src={mobileSrc || posterSrc}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 0px"
            className="block md:hidden object-cover"
            style={{ objectPosition: mobileObjectPosition }}
            priority={false}
            aria-hidden="true"
          />
        )}

        {showPlayButton && (hasDesktopVideo || hasMobileVideo) && (
          <button
            type="button"
            onClick={playCurrent}
            className="md:hidden absolute inset-0 flex items-center justify-center z-10 bg-black/30 focus:outline-none focus:ring-2 focus:ring-white/50 rounded-none"
            aria-label="Play video"
          >
            <span className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
              <svg className="w-8 h-8 text-neutral-900 ml-1" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M8 5v14l11-7L8 5z" />
              </svg>
            </span>
          </button>
        )}
        <div className={`absolute inset-0 ${overlayOpacity}`} aria-hidden="true" />
      </div>
      <div className="relative h-full z-[5]">{children}</div>
    </div>
  )
}

// Define the exact SKUs you want to feature as "Best Sellers"
// You can edit this array in lib/home-products.ts.

interface HomeClientProps {
  initialBestSellers?: Product[]
  initialSakoOrProducts?: Product[]
}

// Hardcoded translations for build-time rendering
const translations = {
  en: {
    brandName: 'Sako Or',
    holidayCollection: 'Holiday Collection',
    forHer: 'FOR HER',
    forHim: 'FOR HIM',
    heroDescription: 'End of year sales on all winter collections!', // 'Discover our curated collection of premium footwear, sourced from Europe\'s finest artisans and China\'s most prestigious manufacturers.',
    exploreCollections: 'Explore Winter Collections', // 'Explore Collections',
    collectionsTitle: 'Curated Collections',
    collectionsDescription: 'Each piece in our collection represents the perfect harmony of design, comfort, and craftsmanship',
    viewCollection: 'View Collection',
    featuredTitle: 'Featured Pieces',
    featuredDescription: 'Discover our most coveted designs, each telling a unique story of luxury and sophistication',
    saleBadge: 'Sale',
    salePriceLabel: 'Now',
    newsletterTitle: 'Join Our World',
    newsletterDescription:
      'Subscribe to receive exclusive updates, early access to new collections, and personalized style recommendations.',
    emailPlaceholder: 'Enter your email',
    subscribeButton: 'Subscribe',
    emailRequired: 'Email is required',
    emailInvalid: 'Please enter a valid email address',
    subscriptionError: 'Failed to subscribe. Please try again.',
    bogoPairTitle: 'Choose two items, and a significant discount awaits in your cart',
  },
  he: {
    brandName: 'סכו עור', // Don't fix it!!
    holidayCollection: 'קולקציית החגים',
    forHer: 'לנשים',
    forHim: 'לגברים',
    heroDescription: 'מבצעי סוף עונה על כל קולקציית החורף!', // 'גלי את האוסף המוקפד שלנו של נעליים יוקרתיות, שמקורן מהאומנים הטובים ביותר באירופה והיצרנים היוקרתיים ביותר בסין',
    exploreCollections: 'מבצעי סוף העונה', // 'לקולקציה החדשה',
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
    subscriptionError: 'ההרשמה נכשלה. אנא נסה שוב.',
    bogoPairTitle: 'תבחרי שני פריטים – ותחכה לך הנחה משמעותית בעגלה',
  },
}

export default function HomeClient({
  initialBestSellers = [],
  initialSakoOrProducts = [],
}: HomeClientProps) {
  const params = useParams()
  const pathname = usePathname()
  const [showCountdownPopup, setShowCountdownPopup] = useState(false)
  const bestSellers = initialBestSellers
  const sakoOrProducts = initialSakoOrProducts

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

  const heroImageSrc = getImageUrl('/images/hero/main-hero.jpg')
  const heroDesktopSrc = getSummerSaleHeroDesktopImageUrl()
  const heroMobileSrc = getSummerSaleHeroMobileImageUrl()
  const sakoOrMobileVideoSrc = getSakoOrMobileVideoUrl()
  const sakoOrDesktopVideoSrc = getSakoOrDesktopVideoUrl()
  const hero3DesktopVideoSrc = getHero3DesktopVideoUrl()
  const hero3MobileVideoSrc = getHero3MobileVideoUrl()

  return (
    <div className={isRTL ? 'text-right' : 'text-left'} style={{ backgroundColor: '#FFFFFF' }}>
      {/* Hero section */}
      <HeroVideoSection
        desktopSrc={heroDesktopSrc}
        mobileSrc={heroMobileSrc}
        posterSrc={heroImageSrc}
        overlayOpacity="bg-transparent"
        mobileObjectPosition="center top"
      >
        <div className="relative h-full flex flex-col items-center text-center">
          <div className="absolute bottom-[15%] md:bottom-[10%] left-0 right-0 max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
            <h1
              className="text-4xl md:text-5xl lg:text-6xl font-semibold text-white tracking-tight text-center uppercase"
              style={{ fontFamily: 'Assistant, sans-serif' }}
            >
              SAKO OR
            </h1>
          </div>
          <div className="absolute bottom-6 md:bottom-8 left-0 right-0 flex flex-row gap-6 md:gap-8 justify-center items-center px-4">
            <Link
              onClick={() => track('new_collection_for_her')}
              href={`/${lng}/collection/women/shoes`}
              className="text-white text-base md:text-xl font-light tracking-wide underline decoration-white underline-offset-4 hover:opacity-80 transition-opacity duration-300"
              style={{ fontFamily: 'Assistant, sans-serif' }}
            >
              {lng === 'he' ? 'לקולקציה החדשה' : 'To New Collection'}
            </Link>
            {/* <Link
              onClick={() => track('outlet_collection_for_her')}
              href={`/${lng}/collection/women/outlet`}
              className="text-white text-base md:text-xl font-light tracking-wide underline decoration-white underline-offset-4 hover:opacity-80 transition-opacity duration-300"
              style={{ fontFamily: 'Assistant, sans-serif' }}
            >
              {lng === 'he' ? 'לכל המבצעים' : 'To Sales'}
            </Link> */}
             <Link
              onClick={() => track('outlet_hero_Section')}
              href={`/${lng}/collection/women/outlet`}
              className="text-white text-base md:text-xl font-light tracking-wide underline decoration-white underline-offset-4 hover:opacity-80 transition-opacity duration-300"
              style={{ fontFamily: 'Assistant, sans-serif' }}
            >
              {lng === 'he' ? 'לקולקציית האאוטלט' : 'To Sales Collection'}
            </Link>
          </div>
        </div>
      </HeroVideoSection>

      {/* Product Carousel - Best Sellers */}
      {bestSellers.length > 0 && (
        <ProductCarousel products={bestSellers} title={lng === 'he' ? 'Summer Collection Essentials' : 'Summer Collection Essentials'} language={lng as 'en' | 'he'} />
      )}

      {/* Hero section - Second */}
      <HeroVideoSection
        desktopSrc={sakoOrDesktopVideoSrc}
        mobileSrc={sakoOrMobileVideoSrc}
        posterSrc={heroImageSrc}
        overlayOpacity="bg-neutral-900/60"
      >
        <div className="relative h-full flex flex-col items-center text-center">
          <div className="absolute bottom-[10%] md:bottom-[10%] left-0 right-0 max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* <h1
              className="text-4xl md:text-5xl lg:text-6xl font-semibold text-white tracking-tight text-center uppercase hero-text-fade-in"
              style={{ fontFamily: 'Assistant, sans-serif', opacity: 0 }}
            >
              SAKO OR BAGS
            </h1> */}
          </div>
          <div className="absolute bottom-6 md:bottom-8 left-0 right-0 flex flex-row justify-center items-center px-4">
            <Link
              onClick={() => track('to_bags_collection')}
              href={`/${lng}/collection/women/accessories/bags`}
              className="text-white text-base md:text-xl font-light tracking-wide underline decoration-white underline-offset-4 hover:opacity-80 transition-opacity duration-300"
              style={{ fontFamily: 'Assistant, sans-serif' }}
            >
              {lng === 'he' ? 'לקולקציית התיקים' : 'to the bags'}
            </Link>
          </div>
        </div>
      </HeroVideoSection>

      {/* Product Carousel - SAKO-OR Products - Second */}
      {sakoOrProducts.length > 0 && (
        <ProductCarousel products={sakoOrProducts} title={'SAKO OR BAGS'} language={lng as 'en' | 'he'} />
      )}

      {/* Campaign tiles - New in / Limited edition */}
      <div className="relative aspect-[3/4] md:aspect-[21/9] bg-black">
        <div className="absolute inset-0 grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3 bg-white p-2 md:p-3">
          <Link
            href={`/${lng}/collection/campaign?slug=new-in`}
            onClick={() => track('campaign_new_in')}
            className="group relative overflow-hidden"
            aria-label={lng === 'he' ? 'חדש באתר' : 'New in'}
          >
            <Image
              src="https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Fnew_in.webp?alt=media&token=304d3a1d-97fe-4194-a77e-1ef83bc38aab"
              alt={lng === 'he' ? 'חדש באתר' : 'New in'}
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
              priority={false}
            />
            <div className="absolute inset-0 bg-neutral-900/40 transition-colors duration-300 group-hover:bg-neutral-900/50" aria-hidden="true" />
            <div className="absolute inset-x-0 bottom-0 p-6 md:p-10">
              <div
                className="text-white text-3xl md:text-4xl font-semibold tracking-tight uppercase"
                style={{ fontFamily: 'Assistant, sans-serif' }}
              >
                {lng === 'he' ? 'חדש באתר' : 'New in'}
              </div>
              <div
                className="mt-2 text-white/90 text-base md:text-lg font-light tracking-wide underline decoration-white/80 underline-offset-4 group-hover:text-white"
                style={{ fontFamily: 'Assistant, sans-serif' }}
              >
                {lng === 'he' ? 'לצפייה' : 'Shop now'}
              </div>
            </div>
          </Link>

          <Link
            href={`/${lng}/collection/campaign?slug=limited-edition`}
            onClick={() => track('campaign_limited_edition')}
            className="group relative overflow-hidden"
            aria-label={lng === 'he' ? 'מהדורה מוגבלת' : 'Limited edition'}
          >
            <Image
              src="https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Flimited_editoin_v2.webp?alt=media&token=1e63ede2-4dc9-49e3-8aca-b2f59f2ac0b8"
              alt={lng === 'he' ? 'מהדורה מוגבלת' : 'Limited edition'}
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
              priority={false}
            />
            <div className="absolute inset-0 bg-neutral-900/40 transition-colors duration-300 group-hover:bg-neutral-900/50" aria-hidden="true" />
            <div className="absolute inset-x-0 bottom-0 p-6 md:p-10">
              <div
                className="text-white text-3xl md:text-4xl font-semibold tracking-tight uppercase"
                style={{ fontFamily: 'Assistant, sans-serif' }}
              >
                {lng === 'he' ? 'מהדורה מוגבלת' : 'Limited edition'}
              </div>
              <div
                className="mt-2 text-white/90 text-base md:text-lg font-light tracking-wide underline decoration-white/80 underline-offset-4 group-hover:text-white"
                style={{ fontFamily: 'Assistant, sans-serif' }}
              >
                {lng === 'he' ? 'לצפייה' : 'Shop now'}
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* Collection Tiles - under Hero #3 */}
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

