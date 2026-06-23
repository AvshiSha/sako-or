import Image from 'next/image'
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

  return (
    <div className="relative aspect-[3/4] md:aspect-[21/9]">
      <div className="absolute inset-0 bg-black md:bg-transparent overflow-hidden">
        <div className="absolute inset-0 hidden md:block">
          <Image
            src={desktopSrc}
            alt=""
            fill
            sizes="100vw"
            className="object-cover"
            style={{ objectPosition: 'center' }}
            loading="lazy"
            aria-hidden="true"
          />
        </div>
        <div className="absolute inset-0 md:hidden">
          <Image
            src={mobileSrc}
            alt=""
            fill
            sizes="100vw"
            className="object-cover"
            style={{ objectPosition: 'center top' }}
            priority
            fetchPriority="high"
            aria-hidden="true"
          />
        </div>
      </div>
      <div className="relative h-full z-[5]">
        <HomeHeroLinks lng={lng} />
      </div>
    </div>
  )
}
