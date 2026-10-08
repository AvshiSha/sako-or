import type { Metadata } from 'next'
import { Suspense } from 'react'

import { buildMetadata } from '@/lib/seo'
import { getHeroImageUrl } from '@/lib/image-urls'
import { languages } from '@/i18n/settings'

import HomeHero from '@/app/components/HomeHero'
import { NAV_BAR_PULL_UP } from '@/lib/header-layout'

import HomeClient from './HomeClient'
import HomeProducts, { HomeProductsFallback } from './HomeProducts'
import { HOME_COLLECTION_BANNERS } from '@/lib/home-collections'

const homeDescriptions = {
  he: 'סכו עור - SAKO OR – מותג ישראלי לנעלי נשים, תיקים ואקססוריז מעור איכותי בעבודת יד. קולקציות עדכניות ומשלוחים מהירים לכל הארץ.',
  en: 'SAKO OR – women’s leather shoes, bags, and premium accessories. Updated collections, all-day comfort, and fast shipping.',
} as const

/**
 * The page's top-level heading, for assistive tech and crawlers only.
 *
 * The design opens on a full-bleed video hero whose campaign copy is baked into
 * the MP4, so there is no text node in it to promote - the homepage shipped with
 * no <h1> at all, and its first heading was an h2 ("אודות סכו עור"). This keeps
 * the visible design exactly as drawn while giving the document a correct
 * heading hierarchy, which is the same trade-off the blog index makes
 * (`news/page.tsx`).
 *
 * Deliberately not the hero's own aria-label ("קולקציית החורף של SAKO 2026"):
 * that names one campaign, and it would go stale the next time the hero changes.
 * This names the page.
 */
const homeHeadings = {
  he: 'סכו עור – נעלי נשים, תיקים ואקססוריז מעור',
  en: 'SAKO OR – women’s leather shoes, bags and accessories',
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

  return (
    <>
      {/* sr-only: see homeHeadings. Must stay first in document order so the
          heading outline opens on the h1 rather than on a section h2. */}
      <h1 className="sr-only">{homeHeadings[locale]}</h1>
      {/* Pulled up behind the nav bar so the header's Transparent variant reveals the
          hero rather than the page ground. Without this the bar reads as plain white
          at rest and only flashes transparent as the hero scrolls past it. */}
      <div className={NAV_BAR_PULL_UP}>
        <HomeHero lng={locale} />
      </div>
      {/* Outside the boundary on purpose: neither of these waits on anything -
          HOME_COLLECTION_BANNERS is a module constant and both components are
          presentational - so they belong in the first flush rather than behind a
          fallback that has to guess their height. Between them they are 73% of the
          page below the hero. */}
      <HomeClient collectionBanners={HOME_COLLECTION_BANNERS} />
      <Suspense fallback={<HomeProductsFallback lng={locale} />}>
        <HomeProducts lng={locale} />
      </Suspense>
    </>
  )
}
