'use client'

import React, { useState, useEffect } from 'react'
import { track } from '@vercel/analytics';
import Image from 'next/image'
import Link from 'next/link'
import { getImageUrl, getCollectionImageUrl, getProductImageUrl, getHeroDesktopVideoUrl, getHeroMobileVideoUrl } from '@/lib/image-urls'
import NewsletterSuccessModal from '@/app/components/NewsletterSuccessModal'
import CountdownPopup from '@/app/components/CountdownPopup'
import ProductCarousel from '@/app/components/ProductCarousel'
import { productService } from '@/lib/firebase'
import { Product } from '@/lib/firebase'

const collections = [
  {
    name: {
      en: 'Luxury Heels',
      he: 'נעלי עקב יוקרתיות'
    },
    description: {
      en: 'Elevate your style with our curated collection of designer heels',
      he: 'העלאת הסגנון שלך עם אוסף מוקפד של עיצובים'
    },
    href: '/collection/women/shoes/pumps',
    imageSrc: getCollectionImageUrl('Luxury Heels'),
  },
  {
    name: {
      en: 'Designer Boots',
      he: 'מגפיים יוקרתיים'
    },
    description: {
      en: 'Sophisticated boots for the modern fashion connoisseur',
      he: 'מגפיים יוקרתיים בעלי עיצוב מורכב'
    },
    href: '/collection/women/shoes/low-boots',
    imageSrc: getCollectionImageUrl('Designer Boots'),
  },
  {
    name: {
      en: 'Classic Oxford',
      he: 'נעלי אוקספורד קלאסיות'
    },
    description: {
      en: 'Timeless elegance meets contemporary design',
      he: 'נעלי אוקספורד יוקרתיות בעלות עיצוב מורכב'
    },
    href: '/collection/women/shoes/oxford',
    imageSrc: getCollectionImageUrl('Classic Oxford'),
  },
]

const featuredProducts = [
  {
    id: 1,
    name: {
      en: 'Tan Suede Chunky Sneakers',
      he: 'סניקרס זמש חומות'
    },
    href: `/product/4912-2169/dark-brown`,
    imageSrc: getProductImageUrl('Tan Suede Chunky Sneakers'),
    imageAlt: {
      en: 'Tan Suede Chunky Sneakers',
      he: 'סניקרס זמש חומות'
    },
    price: 990,
    //salePrice: 890,
    description: {
      en: 'Step up your style with these premium suede sneakers.<br />A perfect mix of comfort, elegance, and modern edge.',
      he: 'תקחי את הסטייל שלך צעד אחד קדימה עם סניקרס איטלקיות'
    },
  },
  {
    id: 2,
    name: {
      en: 'Chic Ankle Boots',
      he: 'מגפוני שיק'
    },
    href: '/product/4926-2356/off-white',
    imageSrc: getProductImageUrl('Chic Ankle Boots'),
    imageAlt: {
      en: 'Chic Ankle Boots',
      he: 'מגפוני שיק'
    },
    price: 790,
    //salePrice: 690,
    description: {
      en: 'Turn heads with these chic white ankle boots.<br />Sleek, modern, and effortlessly elegant for any occasion.',
      he: 'תסובבי ראשים עם מגפוני עקב יוקרתיות'
    },
  },
  {
    id: 3,
    name: {
      en: 'Suede Cowboy Boots',
      he: 'מגפוני בוקרים זמש'
    },
    href: '/product/4925-2901/dark-brown',
    imageSrc: getProductImageUrl('Suede Cowboy Boots'),
    imageAlt: {
      en: 'Suede Cowboy Boots',
      he:  'מגפוני בוקרים זמש'
    },
    price: 599,
    // salePrice: 479,
    description: {
      en: 'Add a bold western touch to your look with these rich brown suede cowboy boots.',
      he: 'הוסיפי טאץ\' מערבי נועז למראה שלך עם המגפוני בוקרים שלנו'
    },
  },
]

// Hardcoded translations for build-time rendering
const translations = {
  en: {
    brandName: 'Sako Or',
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

export default function Home({ params }: { params: Promise<{ lng: string }> }) {
  const [lng, setLng] = useState<string>('en')
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [subscribedEmail, setSubscribedEmail] = useState('')
  const [emailError, setEmailError] = useState('')
  const [showCountdownPopup, setShowCountdownPopup] = useState(false)
  const [bestSellers, setBestSellers] = useState<Product[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  
  // Initialize language from params
  useEffect(() => {
    params.then(({ lng: language }) => {
      setLng(language)
    })
  }, [params])

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
  const t = translations[lng as keyof typeof translations]

  const heroImageSrc = getImageUrl("/images/hero/main-hero.jpg")
  const heroDesktopVideoSrc = getHeroDesktopVideoUrl()
  const heroMobileVideoSrc = getHeroMobileVideoUrl()

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Clear previous errors
    setEmailError('')
    
    if (!email.trim()) {
      setEmailError(t.emailRequired || 'Email is required')
      return
    }
    
    if (!validateEmail(email.trim())) {
      setEmailError(t.emailInvalid || 'Please enter a valid email address')
      return
    }
    
    setIsSubmitting(true)
    
    try {
      const response = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email.trim() }),
      })
      
      const data = await response.json()
      
      if (data.success) {
        setSubscribedEmail(email.trim())
        setShowSuccessModal(true)
        setEmail('') // Clear the form
        setEmailError('') // Clear any errors
      } else {
        setEmailError(data.error || t.subscriptionError || 'Failed to subscribe. Please try again.')
      }
    } catch (error) {
      console.error('Error subscribing to newsletter:', error)
      setEmailError(t.subscriptionError || 'Failed to subscribe. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

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
        <div className="relative h-full flex items-center justify-center text-center">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <h1 className="text-5xl md:text-7xl font-light text-white mb-6 tracking-tight">
              SAKO OR
            </h1>
            <p className="text-xl md:text-2xl text-white font-light max-w-2xl mx-auto mb-10 whitespace-pre-line">
              {t.heroDescription}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link
                onClick={() => track('explore_collections_hero_button')}
                href={`/${lng}/collection/women/shoes`}
                className="inline-block bg-white/90 hover:bg-white py-4 px-8 text-gray-900 text-lg font-light tracking-wider transition-all duration-300"
              >
                {t.exploreCollections}
              </Link>
              <Link
                onClick={() => track('silvester_sale_hero_button')}
                href={`/${lng}/collection/campaign?slug=silvester-sale`}
                className="inline-block bg-white/90 hover:bg-white py-4 px-11 text-gray-900 text-lg font-light tracking-wider transition-all duration-300"
              >
                {lng === 'he' ? 'סילבסטר סייל' : 'Silvester Sale'}
              </Link>
            </div>
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

      {/* Collections Grid */}
      <div className="max-w-68xl mx-auto px-4 sm:px-6 lg:px-8 py-24" style={{ backgroundColor: '#E1DBD7' }}>
        <div className="text-center mb-16">
          <h2 className="text-3xl font-light text-black mb-4">{t.collectionsTitle}</h2>
          <p className="text-black max-w-2xl mx-auto">
            {t.collectionsDescription}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {collections.map((collection) => (
            <Link
              key={collection.name.en}
              onClick={() => track('view_collections_button')}
              href={`/${lng}${collection.href}`}
              className="group relative h-96 block"
            >
              <Image
                src={collection.imageSrc}
                alt={collection.name[lng as keyof typeof collection.name]}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              />
              <div className="absolute inset-0 bg-gray-900 opacity-40 group-hover:opacity-30 transition-opacity duration-300" />
              <div className="relative h-full flex items-end p-8">
                <div>
                  <h3 className="text-2xl font-light text-white mb-2">{collection.name[lng as keyof typeof collection.name]}</h3>
                  <p className="text-white/80 mb-4">{collection.description[lng as keyof typeof collection.description]}</p>
                  <span className="text-white text-sm tracking-wider underline-offset-2 group-hover:underline">
                    {t.viewCollection} →
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Featured Products */}
      <div style={{ backgroundColor: '#E1DBD7' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-light text-gray-900 mb-4">{t.featuredTitle}</h2>
            <p className="text-gray-500 max-w-2xl mx-auto">
              {t.featuredDescription}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {featuredProducts.map((product) => {
            const salePriceValue =
              'salePrice' in product && typeof product.salePrice === 'number'
                ? product.salePrice
                : null;
            const hasSale = salePriceValue !== null && salePriceValue < product.price;

              return (
                <Link
                  key={product.id}
                  onClick={() => track('view_featured_product_button')}
                  href={`/${lng}/${product.href}`}
                  className="group block"
                >
                  <div className="relative aspect-square bg-gray-100 mb-4 overflow-hidden">
                    <Image
                      src={product.imageSrc}
                      alt={product.imageAlt[lng as keyof typeof product.imageAlt]}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    />
                    <div className="absolute inset-0 bg-gray-900/5 group-hover:bg-gray-900/10 transition-colors duration-300" />
                    {hasSale && (
                      <div className="absolute top-3 left-3 bg-red-600 text-white text-xs uppercase tracking-wider px-3 py-1 rounded-full shadow-md">
                        {t.saleBadge}
                      </div>
                    )}
                  </div>
                  <h3 className="text-lg font-light text-gray-900 mb-1">
                    {product.name[lng as keyof typeof product.name]}
                  </h3>
                  <p
                    className="text-sm text-gray-500 mb-2"
                    dangerouslySetInnerHTML={{ __html: product.description[lng as keyof typeof product.description] }}
                  />
                  {hasSale ? (
                    <div className="flex items-baseline gap-3">
                      <span className="text-base text-gray-500 line-through" aria-label={`Original price ${product.price}₪`}>
                        {product.price}₪
                      </span>
                      <span className="text-lg text-red-600 font-medium" aria-label={`${t.salePriceLabel} ${salePriceValue}₪`}>
                        {salePriceValue}₪
                      </span>
                    </div>
                  ) : (
                    <p className="text-lg text-gray-900">{product.price}₪</p>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Newsletter Section */}
      <div style={{ backgroundColor: '#E1DBD7' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="max-w-xl mx-auto text-center">
            <h2 className="text-3xl font-light text-black mb-4">{t.newsletterTitle}</h2>
            <p className="text-black mb-8">
              {t.newsletterDescription}
            </p>
            <form onSubmit={handleNewsletterSubmit} className="max-w-md mx-auto">
              <div className="flex gap-4">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (emailError) setEmailError('') // Clear error when user types
                  }}
                  placeholder={t.emailPlaceholder}
                  required
                  disabled={isSubmitting}
                  className={`flex-1 px-4 py-3 border text-gray-900 focus:ring-0 disabled:opacity-50 disabled:cursor-not-allowed ${
                    emailError ? 'border-red-500 focus:border-red-500' : 'border-gray-600 focus:border-gray-900'
                  }`}
                />
                <button
                  onClick={() => track('subscribe_to_newsletter_button')}
                  type="submit"
                  disabled={isSubmitting || !email.trim()}
                  className="px-6 py-3 bg-gray-900 text-white hover:bg-gray-800 transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? '...' : t.subscribeButton}
                </button>
              </div>
              {emailError && (
                <p className="mt-2 text-sm text-red-600 text-center">
                  {emailError}
                </p>
              )}
            </form>
          </div>
        </div>
      </div>

      {/* Newsletter Success Modal */}
      <NewsletterSuccessModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        email={subscribedEmail}
        lng={lng}
      />

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