'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { getImageUrl, getCollectionImageUrl, getProductImageUrl } from '@/lib/image-urls'
import NewsletterSuccessModal from '@/app/components/NewsletterSuccessModal'

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
    href: '/collection/high-heels',
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
    href: '/collection/boots',
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
    href: '/collection/oxford',
    imageSrc: getCollectionImageUrl('Classic Oxford'),
  },
]

const featuredProducts = [
  {
    id: 1,
    name: {
      en: 'Italian Leather Stilettos',
      he: 'נעלי סטילטו עור איטלקי'
    },
    href: '/collection/high-heels/italian-stilettos',
    imageSrc: getProductImageUrl('Italian Leather Stilettos'),
    imageAlt: {
      en: 'Handcrafted Italian leather stilettos',
      he: 'נעלי סטילטו עור איטלקי בעבודת יד'
    },
    price: {
      en: '$395',
      he: '1099₪'
    },
    description: {
      en: 'Handcrafted in Italy with premium leather',
      he: 'עשויות בעבודת יד באיטליה מעור פרימיום'
    },
  },
  {
    id: 2,
    name: {
      en: 'Crystal Embellished Pumps',
      he: 'נעלי עקב מעוטרות קריסטלים'
    },
    href: '/collection/high-heels/crystal-pumps',
    imageSrc: getProductImageUrl('Crystal Embellished Pumps'),
    imageAlt: {
      en: 'Elegant pumps with crystal embellishments',
      he: 'נעלי עקב אלגנטיות עם עיטורי קריסטל'
    },
    price: {
      en: '$450',
      he: '1199₪'
    },
    description: {
      en: 'Adorned with Swarovski crystals',
      he: 'מעוטרות בקריסטלי סברובסקי'
    },
  },
  {
    id: 3,
    name: {
      en: 'Suede Chelsea Boots',
      he: 'מגפי צ\'לסי אופנתיות'
    },
    href: '/collection/boots/suede-chelsea',
    imageSrc: getProductImageUrl('Suede Chelsea Boots'),
    imageAlt: {
      en: 'Premium suede chelsea boots',
      he:  'מגפי צ\'לסי אופנתיות'
    },
    price: {
      en:'$375',
      he: '999₪'
    },
    description: {
      en: 'Luxurious suede with artisanal craftsmanship',
      he: 'מגפי צ\'לסי באיכות עוצרת נשימה'
    },
  },
]

// Hardcoded translations for build-time rendering
const translations = {
  en: {
    brandName: 'Sako Or',
    heroDescription: 'Discover our curated collection of premium footwear, sourced from Europe\'s finest artisans and China\'s most prestigious manufacturers.',
    exploreCollections: 'Explore Collections',
    collectionsTitle: 'Curated Collections',
    collectionsDescription: 'Each piece in our collection represents the perfect harmony of design, comfort, and craftsmanship',
    viewCollection: 'View Collection',
    featuredTitle: 'Featured Pieces',
    featuredDescription: 'Discover our most coveted designs, each telling a unique story of luxury and sophistication',
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
    heroDescription: 'גלה את האוסף המוקפד שלנו של נעליים יוקרתיות, שמקורן מהאומנים הטובים ביותר באירופה והיצרנים היוקרתיים ביותר בסין',
    exploreCollections: 'לקולקציה החדשה',
    collectionsTitle: 'אוספים מוקפדים',
    collectionsDescription: 'כל חלק באוסף שלנו מייצג הרמוניה מושלמת של עיצוב, נוחות ואומנות',
    viewCollection: 'צפה באוסף',
    featuredTitle: 'יצירות מובילות',
    featuredDescription: 'גלה את העיצובים הנחשקים ביותר שלנו, כל אחד מספר סיפור ייחודי של יוקרה ותחכום',
    newsletterTitle: 'הצטרף לעולמנו',
    newsletterDescription: 'הירשם לקבלת עדכונים בלעדיים, גישה מוקדמת לאוספים חדשים והמלצות סגנון מותאמות אישית.',
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
  
  // Initialize language from params
  React.useEffect(() => {
    params.then(({ lng: language }) => {
      setLng(language)
    })
  }, [params])
  
  const isRTL = lng === 'he'
  
  // Get translations for current language
  const t = translations[lng as keyof typeof translations]

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
    <div className={`pt-16 ${isRTL ? 'text-right' : 'text-left'}`} style={{ backgroundColor: '#F6F3ED' }}>
      {/* Hero section */}
      <div className="relative h-screen">
        <div className="absolute inset-0">
          <Image
            src={getImageUrl("/images/hero/main-hero.jpg")}
            alt="Luxury footwear collection"
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-neutral-900 opacity-60" />
        </div>
        <div className="relative h-full flex items-center justify-center text-center">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <h1 className="text-5xl md:text-7xl font-light text-white mb-6 tracking-tight">
              Sako-Or
            </h1>
            <p className="text-xl md:text-2xl text-white font-light max-w-2xl mx-auto mb-10">
              {t.heroDescription}
            </p>
            <Link
              href={`/${lng}/collection`}
              className="inline-block bg-white/90 hover:bg-white py-4 px-8 text-gray-900 text-lg font-light tracking-wider transition-all duration-300"
            >
              {t.exploreCollections}
            </Link>
          </div>
        </div>
      </div>

      {/* Collections Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-light text-gray-900 mb-4">{t.collectionsTitle}</h2>
          <p className="text-gray-500 max-w-2xl mx-auto">
            {t.collectionsDescription}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {collections.map((collection) => (
            <div
              key={collection.name.en}
              className="group relative h-96"
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
                  <Link
                    href={`/${lng}${collection.href}`}
                    className="text-white text-sm tracking-wider hover:underline"
                  >
                    {t.viewCollection} →
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Featured Products */}
      <div className="bg-neutral-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-light text-gray-900 mb-4">{t.featuredTitle}</h2>
            <p className="text-gray-500 max-w-2xl mx-auto">
              {t.featuredDescription}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {featuredProducts.map((product) => (
              <div
                key={product.id}
                className="group"
              >
                <div className="relative aspect-square bg-gray-100 mb-4">
                  <Image
                    src={product.imageSrc}
                    alt={product.imageAlt[lng as keyof typeof product.imageAlt]}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  />
                  <div className="absolute inset-0 bg-gray-900/5 group-hover:bg-gray-900/10 transition-colors duration-300" />
                </div>
                <h3 className="text-lg font-light text-gray-900 mb-1">
                  <Link href={`/${lng}${product.href}`}>{product.name[lng as keyof typeof product.name]}</Link>
                </h3>
                <p className="text-sm text-gray-500 mb-2">{product.description[lng as keyof typeof product.description]}</p>
                <p className="text-lg text-gray-900">{product.price[lng as keyof typeof product.price]}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Newsletter Section */}
      <div style={{ backgroundColor: '#f6f3ed' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="max-w-xl mx-auto text-center">
            <h2 className="text-3xl font-light text-gray-900 mb-4">{t.newsletterTitle}</h2>
            <p className="text-gray-500 mb-8">
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
    </div>
  )
} 