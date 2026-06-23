'use client'

import React from 'react'
import dynamic from 'next/dynamic'
import { useParams, usePathname } from 'next/navigation'

import ProductCarousel from '@/app/components/ProductCarousel'
import type { HomeShoeCategory } from '@/lib/home-categories'
import type { HomeCollectionBanner } from '@/lib/home-collections'
import type { Product } from '@/lib/product-types'

const ShopByCategory = dynamic(() => import('@/app/components/ShopByCategory'), {
  ssr: true,
})

const ShopByCollection = dynamic(() => import('@/app/components/ShopByCollection'), {
  ssr: true,
})

interface HomeClientProps {
  initialBestSellers?: Product[]
  initialCategories?: HomeShoeCategory[]
  collectionBanners?: HomeCollectionBanner[]
}

export default function HomeClient({
  initialBestSellers = [],
  initialCategories = [],
  collectionBanners = [],
}: HomeClientProps) {
  const params = useParams()
  const pathname = usePathname()
  const bestSellers = initialBestSellers

  const lng = React.useMemo((): 'en' | 'he' => {
    if (pathname) {
      const pathSegments = pathname.split('/').filter(Boolean)
      const langFromPath = pathSegments[0]
      if (langFromPath === 'he' || langFromPath === 'en') {
        return langFromPath
      }
    }
    if (params?.lng && (params.lng === 'he' || params.lng === 'en')) {
      return params.lng as 'en' | 'he'
    }
    return 'en'
  }, [pathname, params?.lng])

  const isRTL = lng === 'he'
  const bestSellersTitle = lng === 'he' ? 'הנמכרים ביותר' : 'Best Sellers'

  return (
    <div className={isRTL ? 'text-right bg-white' : 'text-left bg-white'}>
      <ShopByCategory categories={initialCategories} lng={lng} />
      <ShopByCollection banners={collectionBanners} lng={lng} />
      {bestSellers.length > 0 && (
        <ProductCarousel
          products={bestSellers}
          title={bestSellersTitle}
          language={lng}
        />
      )}
    </div>
  )
}
