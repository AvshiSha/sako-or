import type { Metadata } from 'next'
import { Suspense } from 'react'

import { buildMetadata } from '@/lib/seo'
import {
  getHeroImageUrl,
  getSummerSaleHeroDesktopImageUrl,
  getSummerSaleHeroMobileImageUrl,
} from '@/lib/image-urls'
import { getHomeHeroMobilePosterUrl } from '@/lib/optimized-image-url'
import { languages } from '@/i18n/settings'

import HomeHero from '@/app/components/HomeHero'

import HomeProducts, { HomeProductsFallback } from './HomeProducts'

const homeDescriptions = {
  he: 'סכו עור - SAKO OR – מותג ישראלי לנעלי נשים, תיקים ואקססוריז מעור איכותי בעבודת יד. קולקציות עדכניות ומשלוחים מהירים לכל הארץ.',
  en: 'SAKO OR – women’s leather shoes, bags, and premium accessories. Updated collections, all-day comfort, and fast shipping.',
} as const

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lng: string }>
}): Promise<Metadata> {
  const { lng } = await params
  const locale = (lng === 'he' ? 'he' : 'en') as 'he' | 'en'

  const title = locale === 'he' ? 'סכו עור | נעלי נשים, תיקים ואקססוריז מעור' : 'SAKO OR | Leather shoes, bags & accessories'
  const description = homeDescriptions[locale]
  const url = `/${lng}`

  return buildMetadata({
    title,
    description,
    url,
    image: getHeroImageUrl(),
    type: 'website',
    locale,
    alternateLocales: languages
      .filter((l) => l !== locale)
      .map((altLng) => ({
        locale: altLng,
        url: `/${altLng}`,
      })),
  })
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ lng: string }>
}) {
  const { lng } = await params
  const locale = (lng === 'he' ? 'he' : 'en') as 'en' | 'he'
  const heroMobileSrc = getSummerSaleHeroMobileImageUrl()
  const heroDesktopSrc = getSummerSaleHeroDesktopImageUrl()

  return (
    <>
      <link
        rel="preload"
        as="image"
        href={getHomeHeroMobilePosterUrl(heroMobileSrc)}
        media="(max-width: 768px)"
        fetchPriority="high"
      />
      <link
        rel="preload"
        as="image"
        href={heroDesktopSrc}
        media="(min-width: 769px)"
        fetchPriority="high"
      />
      <HomeHero lng={locale} />
      <Suspense fallback={<HomeProductsFallback />}>
        <HomeProducts lng={locale} />
      </Suspense>
    </>
  )
}
