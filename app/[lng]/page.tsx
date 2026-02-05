'use client'

import React, { useState, useEffect } from 'react'
import { track } from '@vercel/analytics';
import Image from 'next/image'
import Link from 'next/link'
import { useParams, usePathname } from 'next/navigation'
import { getImageUrl, getHeroDesktopVideoUrl, getHeroMobileVideoUrl, getSakoOrMobileVideoUrl, getSakoOrDesktopVideoUrl, getHero3DesktopVideoUrl, getHero3MobileVideoUrl } from '@/lib/image-urls'
import CountdownPopup from '@/app/components/CountdownPopup'
import ProductCarousel from '@/app/components/ProductCarousel'
import { productService, getFilteredProducts } from '@/lib/firebase'
import { Product } from '@/lib/firebase'
import CollectionTiles from '@/app/components/CollectionTiles'


// Define the exact SKUs you want to feature as "Best Sellers"
// You can edit this array as needed.
const BEST_SELLER_SKUS: string[] = [
  '4905-0036',
  '4905-0012',
  '4904-0003',
  '4929-2318',
  '4926-2356',
  '4925-2901',
  '4925-1309',
  '4725-6119',
  '4714-0006',
  '4714-0001',
  '4904-0001',
  '4904-0007',
  '4904-0010',
  '4904-0050',
  '4905-0001',
  '4912-2168',
  '4912-2170',
  '4922-3151',
  '4925-0310' ,
  '4925-1205'
]

// BOGO pair deal – SKUs from all groups (match assign-bogo-groups.ts)
const BOGO_PAIR_SKUS: string[] = [
  ...['4925-2703', '4925-2704', '4725-1310', '4725-2725'],
  ...['4929-3123', '4724-0231', '4725-1201', '4725-1326', '4725-2521', '4725-2718', '4725-4007', '4725-6110', '4725-6119', '4726-8916'],
  ...['4925-1304', '4925-1309', '4925-1320', '4925-1327', '4925-2714', '4925-2715', '4925-2901', '4925-2913', '4925-4013', '4925-4031', '4925-6113', '4929-9281', '4929-9988', '4715-0603', '4715-0701', '4725-1007', '4725-1011', '4725-1207', '4725-1305', '4725-2915', '4725-6108', '4725-6109'],
  ...['4922-1804', '4924-0001', '4925-0301', '4925-0310', '4925-1205', '4925-1210', '4925-1329', '4925-2512', '4925-4001', '4925-6107', '4925-6108', '4925-6170', '4925-6180', '4929-2318', '4929-3985', '4929-9521', '4725-1210', '4725-3315', '4725-6105'],
  ...['4922-5394', '4924-0605', '4924-7168', '4924-7187', '4924-8017', '4925-1302', '4929-2668', '4704-0007', '4704-0010', '4704-0061', '4712-4218', '4713-0100', '4713-0201']
]

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
    subscriptionError: 'Failed to subscribe. Please try again.',
    bogoPairTitle: 'Choose two items, and a surprise awaits in your cart'
  },
  he: {
    brandName: 'סכו עור', // Don't fix it!!
    holidayCollection: 'קולקציית החגים',
    forHer: 'לנשים',
    forHim: 'לגברים',
    heroDescription: 'מבצעי סוף עונה על כל קולקציית החורף!',   //'גלי את האוסף המוקפד שלנו של נעליים יוקרתיות, שמקורן מהאומנים הטובים ביותר באירופה והיצרנים היוקרתיים ביותר בסין',
    exploreCollections: 'מבצעי סוף העונה',  //'לקולקציה החדשה',
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
    bogoPairTitle: 'תבחרי שני פריטים – ותחכה לך הפתעה בעגלה'
  }
}

export default function Home() {
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
        const results = await Promise.all(
          skuChunks.map((chunk) =>
            getFilteredProducts({ includeSkus: chunk })
          )
        )
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

  const heroImageSrc = getImageUrl("/images/hero/main-hero.jpg")
  const heroDesktopVideoSrc = getHeroDesktopVideoUrl()
  const heroMobileVideoSrc = getHeroMobileVideoUrl()
  const sakoOrMobileVideoSrc = getSakoOrMobileVideoUrl()
  const sakoOrDesktopVideoSrc = getSakoOrDesktopVideoUrl()
  const hero3DesktopVideoSrc = getHero3DesktopVideoUrl()
  const hero3MobileVideoSrc = getHero3MobileVideoUrl()

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
            <source src={sakoOrDesktopVideoSrc} type="video/mp4" />
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

      {/* Hero section - Third (desktop + mobile videos) */}
      <div className="relative aspect-[3/4] md:aspect-[21/9]">
        <div className="absolute inset-0 flex md:block items-center justify-center bg-black md:bg-transparent md:overflow-hidden">
          <video
            className="hidden md:block h-full w-full object-cover"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            aria-hidden="true"
          >
            <source src={hero3DesktopVideoSrc} type="video/mp4" />
          </video>
          <video
            className="block md:hidden h-full w-full object-cover"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            aria-hidden="true"
          >
            <source src={hero3MobileVideoSrc} type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-neutral-900/40" aria-hidden="true" />
        </div>
        <div className="relative h-full flex items-center justify-center text-center">
          <div className="absolute bottom-[10%] md:bottom-[10%] left-0 right-0 max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Optional headline – replace or remove when you add your own content */}
          </div>
        </div>
      </div>

      {/* Product Carousel - BOGO pair deal */}
      {!loadingBogoPairProducts && bogoPairProducts.length > 0 && (
        <ProductCarousel
          products={bogoPairProducts}
          title={t.bogoPairTitle}
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