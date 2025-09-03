import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { getImageUrl, getCollectionImageUrl, getProductImageUrl } from '@/lib/image-urls'

const collections = [
  {
    name: 'Luxury Heels',
    description: 'Elevate your style with our curated collection of designer heels',
    href: '/collection/high-heels',
    imageSrc: getCollectionImageUrl('Luxury Heels'),
  },
  {
    name: 'Designer Boots',
    description: 'Sophisticated boots for the modern fashion connoisseur',
    href: '/collection/boots',
    imageSrc: getCollectionImageUrl('Designer Boots'),
  },
  {
    name: 'Classic Oxford',
    description: 'Timeless elegance meets contemporary design',
    href: '/collection/oxford',
    imageSrc: getCollectionImageUrl('Classic Oxford'),
  },
]

const featuredProducts = [
  {
    id: 1,
    name: 'Italian Leather Stilettos',
    href: '/collection/high-heels/italian-stilettos',
    imageSrc: getProductImageUrl('Italian Leather Stilettos'),
    imageAlt: 'Handcrafted Italian leather stilettos',
    price: '$395',
    description: 'Handcrafted in Italy with premium leather',
  },
  {
    id: 2,
    name: 'Crystal Embellished Pumps',
    href: '/collection/high-heels/crystal-pumps',
    imageSrc: getProductImageUrl('Crystal Embellished Pumps'),
    imageAlt: 'Elegant pumps with crystal embellishments',
    price: '$450',
    description: 'Adorned with Swarovski crystals',
  },
  {
    id: 3,
    name: 'Suede Chelsea Boots',
    href: '/collection/boots/suede-chelsea',
    imageSrc: getProductImageUrl('Suede Chelsea Boots'),
    imageAlt: 'Premium suede chelsea boots',
    price: '$375',
    description: 'Luxurious suede with artisanal craftsmanship',
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
    subscribeButton: 'Subscribe'
  },
  he: {
    brandName: 'סאקו אור',
    heroDescription: 'גלה את האוסף המוקפד שלנו של נעליים יוקרתיות, שמקורן מהאומנים הטובים ביותר באירופה והיצרנים היוקרתיים ביותר בסין.',
    exploreCollections: 'חקור אוספים',
    collectionsTitle: 'אוספים מוקפדים',
    collectionsDescription: 'כל חלק באוסף שלנו מייצג הרמוניה מושלמת של עיצוב, נוחות ואומנות',
    viewCollection: 'צפה באוסף',
    featuredTitle: 'יצירות מובילות',
    featuredDescription: 'גלה את העיצובים הנחשקים ביותר שלנו, כל אחד מספר סיפור ייחודי של יוקרה ותחכום',
    newsletterTitle: 'הצטרף לעולמנו',
    newsletterDescription: 'הירשם לקבלת עדכונים בלעדיים, גישה מוקדמת לאוספים חדשים והמלצות סגנון מותאמות אישית.',
    emailPlaceholder: 'הזן את האימייל שלך',
    subscribeButton: 'הירשם'
  }
}

export default async function Home({ params }: { params: Promise<{ lng: string }> }) {
  const { lng } = await params
  const isRTL = lng === 'he'
  
  // Get translations for current language
  const t = translations[lng as keyof typeof translations]

  return (
    <div className={`bg-white pt-16 ${isRTL ? 'text-right' : 'text-left'}`}>
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
              {t.brandName}
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
              key={collection.name}
              className="group relative h-96"
            >
              <Image
                src={collection.imageSrc}
                alt={collection.name}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              />
              <div className="absolute inset-0 bg-gray-900 opacity-40 group-hover:opacity-30 transition-opacity duration-300" />
              <div className="relative h-full flex items-end p-8">
                <div>
                  <h3 className="text-2xl font-light text-white mb-2">{collection.name}</h3>
                  <p className="text-white/80 mb-4">{collection.description}</p>
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
                    alt={product.imageAlt}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  />
                  <div className="absolute inset-0 bg-gray-900/5 group-hover:bg-gray-900/10 transition-colors duration-300" />
                </div>
                <h3 className="text-lg font-light text-gray-900 mb-1">
                  <Link href={`/${lng}${product.href}`}>{product.name}</Link>
                </h3>
                <p className="text-sm text-gray-500 mb-2">{product.description}</p>
                <p className="text-lg text-gray-900">{product.price}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Newsletter Section */}
      <div className="bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="max-w-xl mx-auto text-center">
            <h2 className="text-3xl font-light text-gray-900 mb-4">{t.newsletterTitle}</h2>
            <p className="text-gray-500 mb-8">
              {t.newsletterDescription}
            </p>
            <form className="flex gap-4 max-w-md mx-auto">
              <input
                type="email"
                placeholder={t.emailPlaceholder}
                className="flex-1 px-4 py-3 border border-gray-300 focus:border-gray-900 focus:ring-0"
              />
              <button
                type="submit"
                className="px-6 py-3 bg-gray-900 text-white hover:bg-gray-800 transition-colors duration-300"
              >
                {t.subscribeButton}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
} 