import type { Metadata } from 'next'
import { buildMetadata } from '@/lib/seo'
import { getImageUrl } from '@/lib/image-urls'
import { languages } from '@/i18n/settings'
import HomeClient from './HomeClient'

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
    image: getImageUrl('/images/hero/main-hero.jpg'),
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

export default async function HomePage() {
  return <HomeClient />
}