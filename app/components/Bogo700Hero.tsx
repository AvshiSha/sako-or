import Link from 'next/link'
import Image from 'next/image'
import {
  getBogo700HeroDesktopImageUrl,
  getBogo700HeroMobileImageUrl,
} from '@/lib/image-urls'

interface Bogo700HeroProps {
  lng: 'en' | 'he'
}

/** Same intrinsic dimensions as the first hero banner (HomeHero) so both
 * banners share the same aspect ratio. */
const DESKTOP_HERO_WIDTH = 1366
const DESKTOP_HERO_HEIGHT = 768
const MOBILE_HERO_WIDTH = 1080
const MOBILE_HERO_HEIGHT = 1920

export default function Bogo700Hero({ lng }: Bogo700HeroProps) {
  const desktopSrc = getBogo700HeroDesktopImageUrl()
  const mobileSrc = getBogo700HeroMobileImageUrl()
  const ariaLabel = lng === 'he' ? '2 ב-700' : '2 for 700'

  return (
    <Link
      href={`/${lng}/collection/campaign?slug=bogo700`}
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
      />
      <Image
        src={mobileSrc}
        alt={ariaLabel}
        width={MOBILE_HERO_WIDTH}
        height={MOBILE_HERO_HEIGHT}
        sizes="100vw"
        className="md:hidden w-full h-auto transition-transform duration-700 group-hover:scale-[1.02]"
      />
    </Link>
  )
}
