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
import { productService, getFilteredProducts, type Product } from '@/lib/firebase'
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
            //poster={posterSrc}
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
            //poster={posterSrc}
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
// You can edit this array as needed.
const BEST_SELLER_SKUS: string[] = [
  '5003-0030',
  '5004-0010',
  '5025-3418',
  '5025-3509',
  '5025-3516',
  '5025-3513',
  '5025-4204',
  '5022-3102',
  '5025-2901',
  '5026-0872',
  '5025-7830',
  '5025-7821',
  '5029-8695',
  '5004-0016',
  '5004-0070',
  '5025-3517'
]

// BOGO pair deal – SKUs from all groups (match assign-bogo-groups.ts)
const BOGO_PAIR_SKUS: string[] = [
  ...['4925-2703', '4925-2704', '4725-1310', '4725-2725'],
  ...[
    '4929-3123',
    '4724-0231',
    '4725-1201',
    '4725-1326',
    '4725-2521',
    '4725-2718',
    '4725-4007',
    '4725-6110',
    '4725-6119',
    '4726-8916',
  ],
  ...[
    '4925-1304',
    '4925-1309',
    '4925-1320',
    '4925-1327',
    '4925-2714',
    '4925-2715',
    '4925-2901',
    '4925-2913',
    '4925-4013',
    '4925-4031',
    '4925-6113',
    '4929-9281',
    '4929-9988',
    '4715-0603',
    '4715-0701',
    '4725-1007',
    '4725-1011',
    '4725-1207',
    '4725-1305',
    '4725-2915',
    '4725-6108',
    '4725-6109',
  ],
  ...[
    '4922-1804',
    '4924-0001',
    '4925-0301',
    '4925-0310',
    '4925-1205',
    '4925-1210',
    '4925-1329',
    '4925-2512',
    '4925-4001',
    '4925-6107',
    '4925-6108',
    '4925-6170',
    '4925-6180',
    '4929-2318',
    '4929-3985',
    '4929-9521',
    '4725-1210',
    '4725-3315',
    '4725-6105',
    '4824-6873',
    '4824-6870',
    '4824-8761',
    '4827-2268',
  ],
  ...[
    '4922-5394',
    '4924-0605',
    '4924-7168',
    '4924-7187',
    '4924-8017',
    '4925-1302',
    '4929-2668',
    '4704-0007',
    '4704-0010',
    '4704-0061',
    '4712-4218',
    '4713-0100',
    '4713-0201',
    '4824-0070',
  ],
]

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

export default function HomeClient() {
  const params = useParams()
  const pathname = usePathname()
  const [showCountdownPopup, setShowCountdownPopup] = useState(false)
  const [bestSellers, setBestSellers] = useState<Product[]>([])
  const [sakoOrProducts, setSakoOrProducts] = useState<Product[]>([])
  const [bogoPairProducts, setBogoPairProducts] = useState<Product[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [loadingSakoOrProducts, setLoadingSakoOrProducts] = useState(true)
  const [loadingBogoPairProducts, setLoadingBogoPairProducts] = useState(true)

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

  // Fetch best sellers products (by explicit SKU list)
  useEffect(() => {
    const fetchBestSellers = async () => {
      try {
        setLoadingProducts(true)
        console.log('Fetching best sellers, SKUs count:', BEST_SELLER_SKUS.length)
        // If no SKUs configured, fall back to newest active products
        if (BEST_SELLER_SKUS.length === 0) {
          const products: Product[] = await productService.getAllProducts({
            isActive: true,
            limit: 12, // Limit to 12 products for the carousel
          })
          setBestSellers(products)
          return
        }

        // Firestore `in` operator supports max 10 items – chunk SKUs
        const chunkSize = 10
        const skuChunks: string[][] = []
        for (let i = 0; i < BEST_SELLER_SKUS.length; i += chunkSize) {
          skuChunks.push(BEST_SELLER_SKUS.slice(i, i + chunkSize))
        }

        const results = await Promise.all(
          skuChunks.map((chunk) =>
            getFilteredProducts({
              includeSkus: chunk,
            })
          )
        )

        // Merge and de-duplicate by SKU
        const productBySku = new Map<string, Product>()
        for (const result of results) {
          for (const product of result.products as Product[]) {
            if (product.sku) {
              productBySku.set(product.sku, product)
            }
          }
        }

        // Preserve the order defined in BEST_SELLER_SKUS
        const orderedBestSellers: Product[] = []
        for (const sku of BEST_SELLER_SKUS) {
          const product = productBySku.get(sku)
          if (product) {
            orderedBestSellers.push(product)
          }
        }

        setBestSellers(orderedBestSellers)
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
        // Women's Accessories -> Bags (women/accessories/bags)
        const result = await getFilteredProducts(
          { categoryPath: 'women/accessories/bags' },
          'newest',
          { page: 1, pageSize: 200 }
        )

        setSakoOrProducts(result.products ?? [])
      } catch (error) {
        console.error('Error fetching women accessories bags products:', error)
      } finally {
        setLoadingSakoOrProducts(false)
      }
    }

    fetchSakoOrProducts()
  }, [])

  // Fetch BOGO pair products (SKUs from assign-bogo-groups.ts)
  useEffect(() => {
    const fetchBogoPairProducts = async () => {
      try {
        setLoadingBogoPairProducts(true)
        if (BOGO_PAIR_SKUS.length === 0) {
          setBogoPairProducts([])
          return
        }
        const chunkSize = 10
        const skuChunks: string[][] = []
        for (let i = 0; i < BOGO_PAIR_SKUS.length; i += chunkSize) {
          skuChunks.push(BOGO_PAIR_SKUS.slice(i, i + chunkSize))
        }
        const results = await Promise.all(skuChunks.map((chunk) => getFilteredProducts({ includeSkus: chunk })))
        const productBySku = new Map<string, Product>()
        for (const result of results) {
          for (const product of result.products as Product[]) {
            if (product.sku) productBySku.set(product.sku, product)
          }
        }
        const ordered: Product[] = []
        for (const sku of BOGO_PAIR_SKUS) {
          const product = productBySku.get(sku)
          if (product) ordered.push(product)
        }
        setBogoPairProducts(ordered)
      } catch (error) {
        console.error('Error fetching BOGO pair products:', error)
      } finally {
        setLoadingBogoPairProducts(false)
      }
    }
    fetchBogoPairProducts()
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
      {!loadingProducts && bestSellers.length > 0 && (
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
      {!loadingSakoOrProducts && sakoOrProducts.length > 0 && (
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

