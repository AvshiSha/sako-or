'use client'

// ListingLink, not next/link, for every href below that points at a listing route:
// prefetching those intermittently renders an empty content area instead of the
// loading skeleton. See ListingLink - do not swap this back. Enforced by eslint.
import ListingLink from '@/app/components/ListingLink'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getWinter27DesktopPosterUrl,
  getHomeHeroDesktopVideoUrl,
  getWinter27MobilePosterUrl,
  getHomeHeroMobileVideoUrl,
} from '@/lib/image-urls'
import { getOptimizedRemoteImageUrl } from '@/lib/optimized-image-url'

interface HomeHeroProps {
  lng: 'en' | 'he'
}

/** Native dimensions of the "Winter 27" hero MP4s, read off the files: the
 * mobile cut is 1080x1920 (exactly 9:16, 13.1s) and the desktop cut is
 * 1920x1080 (exactly 16:9, 14.1s). The aspect-ratio boxes below are built from
 * these numbers.
 *
 * Mobile uses the native 9:16, so object-cover crops nothing at all.
 *
 * Desktop deliberately does NOT use the native 16:9. A 16:9 box is 810px tall
 * at a 1440px viewport - taller than the fold - so it keeps the 2/1 banner this
 * hero slot has used since the previous video hero. object-cover then trims
 * ~5.5% off the top and bottom and nothing off the sides, which is safe for
 * this footage: the "SAKO OR | WINTER 27" lockup is at the left edge and sits
 * vertically centred for the whole 14s, so a vertical crop cannot reach it.
 * Switching to zero-crop is a one-liner - make the box aspect-[16/9]. */
const DESKTOP_HERO_VIDEO_WIDTH = 1920
const DESKTOP_HERO_VIDEO_HEIGHT = 1080
const MOBILE_HERO_VIDEO_WIDTH = 1080
const MOBILE_HERO_VIDEO_HEIGHT = 1920

/** Poster widths per breakpoint. Every one is in next.config's `deviceSizes`
 * and the quality is one of its `qualities`; the optimizer 400s on anything
 * else. Capped at each poster's own native width so nothing is upscaled. */
const POSTER_QUALITY = 85
const DESKTOP_POSTER_WIDTHS = [1200, 1920] as const
const MOBILE_POSTER_WIDTHS = [640, 828, 1080] as const

function posterSrcSet(src: string, widths: readonly number[]): string {
  return widths
    .map((w) => `${getOptimizedRemoteImageUrl(src, w, POSTER_QUALITY)} ${w}w`)
    .join(', ')
}

function HomeHeroVideo({
  videoSrc,
  width,
  height,
  onPlaying,
}: {
  videoSrc: string
  width: number
  height: number
  onPlaying: () => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isInView, setIsInView] = useState(false)

  // This is what keeps the page to one MP4: the off-breakpoint cut renders
  // inside a `hidden`/`md:hidden` wrapper, a display:none element never
  // intersects, so `isInView` stays false there - and while it is false the
  // element carries preload="none" and is never asked to play, so the browser
  // issues no request for it at all. Only the cut for the current breakpoint
  // is ever fetched.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => setIsInView(entry.isIntersecting))
      },
      { threshold: 0.25, rootMargin: '0px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    if (!isInView) {
      // Off-screen or off-breakpoint: stop spending decode/battery on it.
      video.pause()
      return
    }

    // Set muted on the element as well as in JSX. React assigns `muted` as a
    // property, and Safari gates autoplay on the *attribute* being present at
    // the moment play() is called - without this the promise rejects on iOS and
    // the hero sits on a frozen first frame.
    video.muted = true
    video.defaultMuted = true

    // Someone who asked their OS to reduce motion keeps the poster and the
    // 2.5MB MP4 is never fetched at all. The poster is this cut's own opening
    // frame, so that still reads as a finished hero rather than a gap. Nothing
    // visible changes for everyone else, and there is no on-screen control
    // either way.
    const reduceMotion = window.matchMedia?.(
      '(prefers-reduced-motion: reduce)'
    )?.matches
    if (reduceMotion) return

    // Autoplay can still be refused (iOS Low Power Mode is the common one).
    // There is deliberately no play-button fallback: the brief asks for no
    // visible controls, and an overlay button would also swallow taps meant for
    // the campaign link that wraps this. A refused autoplay leaves the poster
    // up, which is the opening frame, so it reads as a still hero.
    void video.play().catch(() => {})
  }, [isInView])

  return (
    <div ref={containerRef} className="absolute inset-0">
      <video
        ref={videoRef}
        className="h-full w-full object-cover object-center"
        width={width}
        height={height}
        // No `poster` attribute, deliberately. A poster is fetched even when
        // the <video> sits inside a display:none wrapper - measured: both
        // breakpoints' posters were downloaded on every load - so a per-cut
        // poster here would always pull one image nobody sees. The poster is
        // the <picture> in HomeHero instead, where <source media> picks exactly
        // one. See the note there.
        muted
        loop
        playsInline
        preload={isInView ? 'auto' : 'none'}
        // No `controls`: the hero is a link, not a player.
        disablePictureInPicture
        aria-hidden="true"
        tabIndex={-1}
        onPlaying={onPlaying}
      >
        <source src={videoSrc} type="video/mp4" />
      </video>
    </div>
  )
}

export default function HomeHero({ lng }: HomeHeroProps) {
  const desktopVideoSrc = getHomeHeroDesktopVideoUrl()
  const mobileVideoSrc = getHomeHeroMobileVideoUrl()
  const desktopPosterSrc = getWinter27DesktopPosterUrl()
  const mobilePosterSrc = getWinter27MobilePosterUrl()

  // Lifted out of HomeHeroVideo because the poster is a sibling of both cuts
  // rather than a child of either. Only the on-breakpoint cut is ever played,
  // so whichever one fires this is by definition the visible one.
  const [isPlaying, setIsPlaying] = useState(false)
  const handlePlaying = useCallback(() => setIsPlaying(true), [])

  const ariaLabel =
    lng === 'he' ? 'קולקציית החורף של SAKO OR 27' : 'SAKO OR Winter 27'

  return (
    <ListingLink
      href={`/${lng}/collection/campaign/new-collection`}
      className="relative block aspect-[9/16] md:aspect-[2/1] group overflow-hidden"
      aria-label={ariaLabel}
    >
      {/* Only visible for the moment before the poster decodes, but still worth
       * matching: both cuts are shot on a mid-grey studio set (sampled: walls
       * around #a5afb8, vignetted edges around #6f6e7a). Not the bg-black the
       * previous video hero used - these cuts are light, and black flashed -
       * and not the near-white the Election Sale stills used, which flashed
       * just as hard the other way. */}
      <div className="absolute inset-0 bg-[#8a8992]">
        <div className="absolute inset-0 hidden md:block">
          <HomeHeroVideo
            videoSrc={desktopVideoSrc}
            width={DESKTOP_HERO_VIDEO_WIDTH}
            height={DESKTOP_HERO_VIDEO_HEIGHT}
            onPlaying={handlePlaying}
          />
        </div>
        <div className="absolute inset-0 md:hidden">
          <HomeHeroVideo
            videoSrc={mobileVideoSrc}
            width={MOBILE_HERO_VIDEO_WIDTH}
            height={MOBILE_HERO_VIDEO_HEIGHT}
            onPlaying={handlePlaying}
          />
        </div>

        {/* The poster, as a <picture> OVER the videos rather than a `poster`
         * attribute on each of them. Two things fall out of that:
         *
         * 1. Exactly one image is fetched. <source media> resolves to a single
         *    URL, where two `poster` attributes inside breakpoint wrappers both
         *    download (display:none does not stop a poster). This also has to
         *    live outside those wrappers - an eager <img> inside a hidden
         *    container is still fetched, which is the same trap.
         * 2. It is server-rendered and eager, so it paints on first paint
         *    rather than waiting for hydration and the IntersectionObserver.
         *
         * Each source is its own cut's frame 0, so when this is swapped out the
         * picture underneath is the same picture - the handover is invisible
         * rather than a cut between two different images. It is removed on the
         * `playing` event, and kept mounted (opacity, pointer-events-none) so
         * the swap is a compositor change and cannot reflow the hero. */}
        <picture>
          <source
            media="(min-width: 768px)"
            srcSet={posterSrcSet(desktopPosterSrc, DESKTOP_POSTER_WIDTHS)}
            sizes="100vw"
            width={DESKTOP_HERO_VIDEO_WIDTH}
            height={DESKTOP_HERO_VIDEO_HEIGHT}
          />
          <img
            src={getOptimizedRemoteImageUrl(
              mobilePosterSrc,
              MOBILE_POSTER_WIDTHS[MOBILE_POSTER_WIDTHS.length - 1],
              POSTER_QUALITY
            )}
            srcSet={posterSrcSet(mobilePosterSrc, MOBILE_POSTER_WIDTHS)}
            sizes="100vw"
            width={MOBILE_HERO_VIDEO_WIDTH}
            height={MOBILE_HERO_VIDEO_HEIGHT}
            alt=""
            // The campaign copy is inside the artwork and the link that wraps
            // this carries the aria-label, so an alt here would say it twice.
            aria-hidden="true"
            fetchPriority="high"
            decoding="async"
            className={`pointer-events-none absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-150 ${
              isPlaying ? 'opacity-0' : 'opacity-100'
            }`}
          />
        </picture>
      </div>
    </ListingLink>
  )
}
