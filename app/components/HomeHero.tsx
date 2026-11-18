'use client'

// ListingLink, not next/link, for every href below that points at a listing route:
// prefetching those intermittently renders an empty content area instead of the
// loading skeleton. See ListingLink - do not swap this back. Enforced by eslint.
import ListingLink from '@/app/components/ListingLink'
import {
  getBlackFridayHeroDesktopImageUrl,
  getBlackFridayHeroMobileImageUrl,
} from '@/lib/image-urls'
import { getOptimizedRemoteImageUrl } from '@/lib/optimized-image-url'

interface HomeHeroProps {
  lng: 'en' | 'he'
}

/** Native dimensions of the "Black Week" hero stills, read off the files: the
 * desktop cut is 1915x821 (~2.33:1) and the mobile cut is 941x1672 (~9:16).
 * The aspect-ratio boxes below are built from exactly these, so object-cover
 * has nothing to crop at either breakpoint.
 *
 * That is a requirement here rather than tidiness. The "Black Week" headline
 * spans roughly 14%-88% of the mobile cut's width and the "Shop now" pill sits
 * near its bottom edge, so any box that is not the native ratio eats one of
 * them. Same on desktop: the headline starts ~11% in from the left. Rounding
 * these to 9/16 and 7/3 was measured and rejected for that reason.
 *
 * This replaces the Winter 27 video hero. The two MP4s and their posters are
 * still in the bucket and still exported from lib/image-urls - restoring them
 * is a revert of this file, nothing else. */
const DESKTOP_HERO_WIDTH = 1915
const DESKTOP_HERO_HEIGHT = 821
const MOBILE_HERO_WIDTH = 941
const MOBILE_HERO_HEIGHT = 1672

/** Widths offered per breakpoint. Every one is in next.config's `deviceSizes`
 * and the quality is one of its `qualities`; the optimizer 400s on anything
 * else. Each list is also capped at its own cut's native width so nothing is
 * upscaled from the source: 1920 is within 0.3% of the desktop cut's 1915, and
 * the mobile list stops at 828 because the next step up, 1080, is 15% wider
 * than the 941px source and would cost bytes without adding detail. */
const HERO_QUALITY = 85
const DESKTOP_HERO_WIDTHS = [1200, 1920] as const
const MOBILE_HERO_WIDTHS = [640, 828] as const

function srcSetFor(src: string, widths: readonly number[]): string {
  return widths
    .map((w) => `${getOptimizedRemoteImageUrl(src, w, HERO_QUALITY)} ${w}w`)
    .join(', ')
}

export default function HomeHero({ lng }: HomeHeroProps) {
  const desktopSrc = getBlackFridayHeroDesktopImageUrl()
  const mobileSrc = getBlackFridayHeroMobileImageUrl()

  const ariaLabel =
    lng === 'he'
      ? 'BLACK WEEK של SAKO OR - לצפייה במבצעים'
      : 'SAKO OR Black Week - shop the sale'

  return (
    <ListingLink
      href={`/${lng}/collection/campaign/black-friday`}
      className="relative block aspect-[941/1672] md:aspect-[1915/821] group overflow-hidden"
      aria-label={ariaLabel}
    >
      {/* Stands in for the artwork for the frame or two before it decodes.
       * Sampled off the two cuts themselves - both are shot on the same warm
       * concrete ground, mean #896551 (desktop) / #784836 (mobile) - so this
       * sits between them. Not bg-black: these are warm mid-tone images and a
       * black box flashed hard under them, the same way near-white did under
       * the Election stills. */}
      <div className="absolute inset-0 bg-[#806048]">
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
            src={getOptimizedRemoteImageUrl(
              mobileSrc,
              MOBILE_HERO_WIDTHS[MOBILE_HERO_WIDTHS.length - 1],
              HERO_QUALITY
            )}
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
