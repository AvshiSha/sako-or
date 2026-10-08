'use client'

import React from 'react'
import dynamic from 'next/dynamic'
import { useParams, usePathname } from 'next/navigation'

import HomeAboutSection from '@/app/components/HomeAboutSection'
import type { HomeCollectionBanner } from '@/lib/home-collections'

const ShopByCollection = dynamic(() => import('@/app/components/ShopByCollection'), {
  ssr: true,
})

interface HomeClientProps {
  collectionBanners?: HomeCollectionBanner[]
}

/**
 * The two home sections that need no server data: the About band and Shop by
 * Collection. Both are presentational and the banners are a module constant, so
 * this renders outside the page's Suspense boundary and reaches the browser in
 * the first flush. Best sellers - the only part that waits on a fetch - live in
 * HomeProducts behind that boundary.
 */
export default function HomeClient({
  collectionBanners = [],
}: HomeClientProps) {
  const params = useParams()
  const pathname = usePathname()

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

  // 438:3234 ships placeholder copy ("טקסט על החנות"). The heading and standfirst
  // are taken from the About page's own strings instead, so the band says
  // something true and matches the page it links to.
  const about = {
    eyebrow: 'ABOUT US / 01',
    heading: lng === 'he' ? 'אודות סכו עור' : 'About SAKO-OR',
    body:
      lng === 'he'
        ? 'שם שמייצג איכות, סטייל ומסורת של למעלה מ-50 שנה בתחום האופנה.'
        : 'A name that represents quality, style, and tradition of over 50 years in the fashion industry.',
    linkLabel: lng === 'he' ? 'לקריאה' : 'Read more',
  }

  return (
    <div className={isRTL ? 'text-right bg-surface-secondary' : 'text-left bg-surface-secondary'}>
      <HomeAboutSection
        lng={lng}
        eyebrow={about.eyebrow}
        heading={about.heading}
        body={about.body}
        linkLabel={about.linkLabel}
        href="/about"
      />
      <ShopByCollection banners={collectionBanners} lng={lng} />
    </div>
  )
}
