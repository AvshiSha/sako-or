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
      <div className="absolute inset-0 flex md:block items-center justify-center bg-black md:bg-transparent md:overflow-hidden">
        <Image
          src={desktopSrc}
          alt=""
          fill
          sizes="(min-width: 768px) 100vw, 0px"
          className="hidden md:block object-cover"
          style={{ objectPosition: 'center' }}
          priority
          fetchPriority="high"
          aria-hidden="true"
        />
        <Image
          src={mobileSrc}
          alt=""
          fill
          sizes="(max-width: 768px) 100vw, 0px"
          className="block md:hidden object-cover"
          style={{ objectPosition: 'center top' }}
          priority
          fetchPriority="high"
          aria-hidden="true"
        />
      </div>
      <div className="relative h-full z-[5]">
        <HomeHeroLinks lng={lng} />
      </div>
    </div>
  )
}
