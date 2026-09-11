import Link from 'next/link'
import Image from 'next/image'
import {
  getNewDropHeroDesktopImageUrl,
  getNewDropHeroMobileImageUrl,
} from '@/lib/image-urls'

interface HomeHeroProps {
  lng: 'en' | 'he'
}

/** Native dimensions of the "New Drop" banners - used for intrinsic sizing
 * so the full graphic (logo, headline, copy) always renders uncropped instead
 * of being cut by a forced aspect-ratio container. The desktop banner ships at
 * 2x (2732x1536) so it stays sharp on retina displays at full-bleed width. */
const DESKTOP_HERO_WIDTH = 2732
const DESKTOP_HERO_HEIGHT = 1536
const MOBILE_HERO_WIDTH = 1080
const MOBILE_HERO_HEIGHT = 1920

export default function HomeHero({ lng }: HomeHeroProps) {
  const desktopSrc = getNewDropHeroDesktopImageUrl()
  const mobileSrc = getNewDropHeroMobileImageUrl()
  const ariaLabel = lng === 'he' ? 'הדרופ החדש' : 'New drop'

  return (
    <Link
      href={`/${lng}/collection/campaign?slug=new-collection`}
      className="relative block group overflow-hidden"
      aria-label={ariaLabel}
    >
      <Image
        src={desktopSrc}
        alt={ariaLabel}
        width={DESKTOP_HERO_WIDTH}
        height={DESKTOP_HERO_HEIGHT}
        sizes="100vw"
        quality={100}
        className="hidden md:block w-full h-auto transition-transform duration-700 group-hover:scale-[1.02]"
        priority
        fetchPriority="high"
      />
      <Image
        src={mobileSrc}
        alt={ariaLabel}
        width={MOBILE_HERO_WIDTH}
        height={MOBILE_HERO_HEIGHT}
        sizes="100vw"
        className="md:hidden w-full h-auto transition-transform duration-700 group-hover:scale-[1.02]"
        priority
        fetchPriority="high"
      />
    </Link>
  )
}
