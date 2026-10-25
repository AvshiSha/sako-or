'use client'

// ListingLink, not next/link, for every href below that points at a listing route:
// prefetching those intermittently renders an empty content area instead of the
// loading skeleton. See ListingLink - do not swap this back. Enforced by eslint.
import ListingLink from '@/app/components/ListingLink'
import {
  getElectionHeroDesktopImageUrl,
  getElectionHeroMobileImageUrl,
} from '@/lib/image-urls'
import { getOptimizedRemoteImageUrl } from '@/lib/optimized-image-url'

interface HomeHeroProps {
  lng: 'en' | 'he'
}

/** Native dimensions of the "Election Sale" hero stills. The desktop cut is
 * 2048x878 (~2.33:1) and the mobile cut is 1152x2048 (exactly 9:16); the
 * aspect-ratio box below is built from these numbers, so object-cover has
 * nothing to crop and the baked-in campaign copy survives at every width.
 *
 * The desktop ratio is the one thing that moved from the video hero it replaces
 * (that was md:aspect-[2/1]). Keeping 2/1 would have meant cropping ~14% off
 * each side of a 2.33:1 still, and "ELECTION SALE" runs to within 5% of this
 * asset's right edge - the headline is the first thing a side crop eats. */
const DESKTOP_HERO_WIDTH = 2048
const DESKTOP_HERO_HEIGHT = 878
const MOBILE_HERO_WIDTH = 1152
const MOBILE_HERO_HEIGHT = 2048

/** Widths offered per breakpoint. Every one is in next.config's `deviceSizes`;
 * the optimizer rejects anything else. Quality must be one of `qualities`. */
const HERO_QUALITY = 85
const DESKTOP_HERO_WIDTHS = [1200, 1920, 2048] as const
const MOBILE_HERO_WIDTHS = [640, 828, 1080] as const

function srcSetFor(src: string, widths: readonly number[]): string {
  return widths
    .map((w) => `${getOptimizedRemoteImageUrl(src, w, HERO_QUALITY)} ${w}w`)
    .join(', ')
}

export default function HomeHero({ lng }: HomeHeroProps) {
  const desktopSrc = getElectionHeroDesktopImageUrl()
  const mobileSrc = getElectionHeroMobileImageUrl()
  const ariaLabel =
    lng === 'he'
      ? 'מבצע הבחירות של SAKO OR - 10% הנחה על כל האתר, קוד ELEC10'
      : 'SAKO OR Election Sale - 10% off everything with code ELEC10'

  return (
    <ListingLink
      href={`/${lng}/collection/campaign/new-collection`}
      className="relative block aspect-[1152/2048] md:aspect-[2048/878] group overflow-hidden"
      aria-label={ariaLabel}
    >
      {/* Both cuts are shot on the same near-white studio ground, so this stands
       * in for the artwork for the frame or two before it decodes rather than
       * flashing a dark box the way the video hero's bg-black did. */}
      <div className="absolute inset-0 bg-[#F2F2F0]">
        {/* <picture>, not the two breakpoint-switched <Image>s that
         * CollectionGridBanner uses, for one reason: this is the LCP element and
         * therefore eager. A hidden-but-eager <img> is still fetched, so that
         * pattern would pull both cuts down on every first paint - it only
         * avoids the double fetch because its banners are lazy and a lazy image
         * inside display:none never loads. <source media> picks exactly one.
         *
         * The optimizer is not given up to get that: every URL here is a
         * /_next/image request (see getOptimizedRemoteImageUrl), so these are
         * still served as AVIF/WebP at per-breakpoint widths. */}
        <picture>
          <source
            media="(min-width: 768px)"
            srcSet={srcSetFor(desktopSrc, DESKTOP_HERO_WIDTHS)}
            sizes="100vw"
            width={DESKTOP_HERO_WIDTH}
            height={DESKTOP_HERO_HEIGHT}
          />
          <img
            src={getOptimizedRemoteImageUrl(mobileSrc, 1080, HERO_QUALITY)}
            srcSet={srcSetFor(mobileSrc, MOBILE_HERO_WIDTHS)}
            sizes="100vw"
            // Intrinsic size of the mobile cut, which is the <img>'s own source.
            // The box above already fixes the layout at both breakpoints, so
            // these are belt-and-braces against a missing-CSS first paint.
            width={MOBILE_HERO_WIDTH}
            height={MOBILE_HERO_HEIGHT}
            alt=""
            // The campaign copy is inside the artwork, and the link that wraps it
            // carries the aria-label, so an alt here would read the offer twice.
            aria-hidden="true"
            fetchPriority="high"
            decoding="async"
            className="h-full w-full object-cover object-center"
          />
        </picture>
      </div>
    </ListingLink>
  )
}
