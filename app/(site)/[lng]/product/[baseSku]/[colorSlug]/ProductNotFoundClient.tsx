'use client'

import { useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ShoppingBag } from 'lucide-react'
import type { Product } from '@/lib/firebase'
import SearchBar from '@/app/components/SearchBar'
import ProductCarousel from '@/app/components/ProductCarousel'

interface Props {
  products: Product[]
}

const copy = {
  en: {
    headline: 'This product is no longer available',
    description:
      'It may have been removed from our catalog or the link is no longer valid.',
    continueShopping: 'Continue Shopping',
    HomePage: 'Back to Home Page',
    searchLabel: 'Search for something else',
    carouselTitle: 'Best Sellers',
  },
  he: {
    headline: 'המוצר הזה אינו זמין יותר',
    description: 'ייתכן שהוא הוסר מהקטלוג שלנו או שהקישור אינו תקף יותר.',
    continueShopping: 'המשך קנייה',
    HomePage: 'לדף הבית',
    searchLabel: 'חפשו מוצר אחר',
    carouselTitle: 'הנמכרים ביותר',
  },
}

export default function ProductNotFoundClient({ products }: Props) {
  const params = useParams()
  const lng = (params?.lng as string) || 'en'
  const baseSku = (params?.baseSku as string) || ''
  const isRTL = lng === 'he'
  const t = isRTL ? copy.he : copy.en

  // Analytics: fire once on mount
  useEffect(() => {
    window.dataLayer = window.dataLayer || []
    window.dataLayer.push({
      event: 'product_not_found',
      requested_url: window.location.href,
      referrer: document.referrer || null,
      sku: baseSku || null,
      timestamp: new Date().toISOString(),
    })
  }, [baseSku])

  return (
    <div className="min-h-screen bg-white" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* ── Hero ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-6 pt-16 md:pt-24 pb-14">
        <div className="max-w-xl mx-auto text-center">

          {/* Icon */}
          <div className="w-16 h-16 mx-auto mb-7 rounded-full bg-[#856D55]/10 flex items-center justify-center">
            <ShoppingBag className="w-8 h-8 text-[#856D55]" strokeWidth={1.5} />
          </div>

          {/* Headline */}
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-4 leading-snug">
            {t.headline}
          </h1>

          {/* Description */}
          <p className="text-base sm:text-lg text-gray-500 mb-10 leading-relaxed">
            {t.description}
          </p>

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-12">
            <Link
              href={`/${lng}/collection`}
              className="inline-flex items-center justify-center px-8 py-3 bg-[#856D55] text-white text-sm font-semibold tracking-wide rounded-md hover:bg-[#6d5a47] transition-colors"
            >
              {t.continueShopping}
            </Link>
            <Link
              href={`/${lng}`}
              className="inline-flex items-center justify-center px-8 py-3 border border-[#856D55] text-[#856D55] text-sm font-semibold tracking-wide rounded-md hover:bg-[#856D55]/5 transition-colors"
            >
              {t.HomePage}
            </Link>
          </div>

          {/* Search */}
          <div className="max-w-lg mx-auto">
            <p className="text-sm text-gray-400 mb-2.5">{t.searchLabel}</p>
            <SearchBar language={lng} variant="inline" />
          </div>
        </div>
      </section>

      {/* ── Divider ── */}
      <div className="border-t border-gray-100" />

      {/* ── Best Sellers Carousel ── */}
      {products.length > 0 && (
        <ProductCarousel
          products={products}
          title={t.carouselTitle}
          language={lng as 'en' | 'he'}
        />
      )}
    </div>
  )
}
