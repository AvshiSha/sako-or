'use client'

import Image from 'next/image'
import Link from 'next/link'
import { track } from '@vercel/analytics'
import {
  getSummerSaleHeroDesktopImageUrl,
  getSummerSaleHeroMobileImageUrl,
} from '@/lib/image-urls'
import HomeHeroLinks from './HomeHeroLinks'

interface HomeHeroProps {
  lng: 'en' | 'he'
}

export default function HomeHero({ lng }: HomeHeroProps) {
  const desktopSrc = getSummerSaleHeroDesktopImageUrl()
  const mobileSrc = getSummerSaleHeroMobileImageUrl()
  const heroAlt =
    lng === 'he'
      ? 'קולקציה חדשה של סכו עור'
      : 'SAKO OR new collection'
  const ariaLabel =
    lng === 'he' ? 'לקולקציה החדשה' : 'Shop new collection'

  return (
    <Link
      href={`/${lng}/collection/campaign?slug=new-collection`}
      onClick={() => track('hero_new_collection')}
      className="relative block aspect-[3/4] md:aspect-[21/9] group"
      aria-label={ariaLabel}
    >
      <div className="absolute inset-0 bg-black md:bg-transparent overflow-hidden">
        <div className="absolute inset-0 hidden md:block">
          <Image
            src={desktopSrc}
            alt={heroAlt}
            fill
            sizes="100vw"
            className="object-cover transition-transform duration-700 group-hover:scale-[1.02]"
            style={{ objectPosition: 'center' }}
            loading="lazy"
          />
        </div>
        <div className="absolute inset-0 md:hidden">
          <Image
            src={mobileSrc}
            alt={heroAlt}
            fill
            sizes="100vw"
            className="object-cover"
            style={{ objectPosition: 'center top' }}
            priority
            fetchPriority="high"
          />
        </div>
      </div>
      <div className="relative h-full z-[5] pointer-events-none">
        <HomeHeroLinks lng={lng} />
      </div>
    </Link>
  )
}
