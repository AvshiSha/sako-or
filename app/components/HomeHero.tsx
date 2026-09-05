import Link from 'next/link'
import Image from 'next/image'
import {
  getRoshHashanaHeroDesktopImageUrl,
  getRoshHashanaHeroMobileImageUrl,
} from '@/lib/image-urls'

interface HomeHeroProps {
  lng: 'en' | 'he'
}

/** Native dimensions of the Rosh Hashana banners - used for intrinsic sizing
 * so the full graphic (logo, headline, copy) always renders uncropped instead
 * of being cut by a forced aspect-ratio container. These must match the real
 * files: the ratios differ per breakpoint (2.33 desktop, 0.75 mobile), and a
 * wrong ratio here reserves the wrong height and shifts the page on load. */
const DESKTOP_HERO_WIDTH = 1916
const DESKTOP_HERO_HEIGHT = 821
const MOBILE_HERO_WIDTH = 1080
const MOBILE_HERO_HEIGHT = 1440

export default function HomeHero({ lng }: HomeHeroProps) {
  const desktopSrc = getRoshHashanaHeroDesktopImageUrl()
  const mobileSrc = getRoshHashanaHeroMobileImageUrl()
  const ariaLabel = lng === 'he' ? 'מבצע ראש השנה' : 'Rosh Hashana sale'

  return (
    <Link
      href={`/${lng}/collection/women/outlet`}
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
