'use client'

import React, { useState, useEffect } from 'react'
import { track } from '@vercel/analytics';
import Image from 'next/image'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { getImageUrl, getHeroDesktopVideoUrl, getHeroMobileVideoUrl } from '@/lib/image-urls'
import NewsletterSuccessModal from '@/app/components/NewsletterSuccessModal'
import CountdownPopup from '@/app/components/CountdownPopup'
import ProductCarousel from '@/app/components/ProductCarousel'
import { productService } from '@/lib/firebase'
import { Product } from '@/lib/firebase'


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

export default function Home() {
  const params = useParams()
  const lng = (params?.lng as string) || 'en'
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [subscribedEmail, setSubscribedEmail] = useState('')
  const [emailError, setEmailError] = useState('')
  const [showCountdownPopup, setShowCountdownPopup] = useState(false)
  const [bestSellers, setBestSellers] = useState<Product[]>([])
  const [sakoOrProducts, setSakoOrProducts] = useState<Product[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [loadingSakoOrProducts, setLoadingSakoOrProducts] = useState(true)

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
            <source src={heroMobileVideoSrc} type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-neutral-900/60" aria-hidden="true" />
        </div>
        {/* <div className="relative h-full flex items-center justify-center text-center">
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
        </div> */}
      </div>

      {/* Product Carousel - SAKO-OR Products - Second */}
      {!loadingSakoOrProducts && sakoOrProducts.length > 0 && (
        <ProductCarousel
          products={sakoOrProducts}
          title={lng === 'he' ? 'Only at SAKO OR' : 'Only at SAKO OR'}
          language={lng as 'en' | 'he'}
        />
      )}

      {/* Newsletter Section */}
      <div style={{ backgroundColor: '#E1DBD7' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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