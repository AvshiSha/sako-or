import Link from 'next/link'
import Image from 'next/image'
import {
  getTwoFor600HeroDesktopImageUrl,
  getTwoFor600HeroMobileImageUrl,
} from '@/lib/image-urls'

interface HomeHeroProps {
  lng: 'en' | 'he'
}

/** Native dimensions of the "Two for 600" banners - used for intrinsic sizing
 * so the full graphic (logo, headline, copy) always renders uncropped instead
 * of being cut by a forced aspect-ratio container. */
const DESKTOP_HERO_WIDTH = 1366
const DESKTOP_HERO_HEIGHT = 768
const MOBILE_HERO_WIDTH = 1080
const MOBILE_HERO_HEIGHT = 1920

export default function HomeHero({ lng }: HomeHeroProps) {
  const desktopSrc = getTwoFor600HeroDesktopImageUrl()
  const mobileSrc = getTwoFor600HeroMobileImageUrl()
  const ariaLabel = lng === 'he' ? 'שני זוגות ב-600' : 'Two for 600'

  return (
    <Link
      href={`/${lng}/collection/campaign?slug=bogo600`}
      className="relative block group overflow-hidden"
      aria-label={ariaLabel}
    >
      <Image
        src={desktopSrc}
        alt={ariaLabel}
        width={DESKTOP_HERO_WIDTH}
        height={DESKTOP_HERO_HEIGHT}
        sizes="100vw"
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
