'use client'

// Not next/link, and not an oversight: these hrefs point at the listing routes,
// where prefetching intermittently renders an empty content area instead of the
// loading skeleton. See ListingLink - do not swap this back.
import Link from '@/app/components/ListingLink'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getHomeHeroDesktopVideoUrl,
  getHomeHeroMobileVideoUrl,
} from '@/lib/image-urls'

interface HomeHeroProps {
  lng: 'en' | 'he'
}

/** Native dimensions of the "Winter Edition 2026" hero MP4s. The desktop cut is
 * 2206x946 (~21:9) and the mobile cut is 1080x1920 (9:16); the aspect-ratio
 * containers below match these exactly so object-cover never crops the
 * baked-in campaign copy. */
const DESKTOP_HERO_VIDEO_WIDTH = 2206
const DESKTOP_HERO_VIDEO_HEIGHT = 946
const MOBILE_HERO_VIDEO_WIDTH = 1080
const MOBILE_HERO_VIDEO_HEIGHT = 1920

function HomeHeroVideo({
  videoSrc,
  width,
  height,
  showPlayButton = true,
}: {
  videoSrc: string
  width: number
  height: number
  showPlayButton?: boolean
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isInView, setIsInView] = useState(false)
  const [showPlayButtonOverlay, setShowPlayButtonOverlay] = useState(false)

  // The off-breakpoint cut is inside a `hidden`/`md:hidden` wrapper, so it never
  // intersects and therefore never preloads or plays - only one MP4 is fetched.
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

  const playVideo = useCallback(async () => {
    const video = videoRef.current
    if (!video) return
    try {
      await video.play()
      setShowPlayButtonOverlay(false)
    } catch {
      setShowPlayButtonOverlay(true)
    }
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    if (!isInView) {
      video.pause()
      return
    }

    const playPromise = video.play()
    if (playPromise !== undefined) {
      playPromise.catch(() => setShowPlayButtonOverlay(true))
    }
  }, [isInView])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const onPlaying = () => setShowPlayButtonOverlay(false)
    video.addEventListener('playing', onPlaying)
    return () => video.removeEventListener('playing', onPlaying)
  }, [])

  return (
    <div ref={containerRef} className="absolute inset-0">
      <video
        ref={videoRef}
        className="h-full w-full object-cover object-center"
        width={width}
        height={height}
        muted
        loop
        playsInline
        preload={isInView ? 'metadata' : 'none'}
        aria-hidden="true"
      >
        <source src={videoSrc} type="video/mp4" />
      </video>
      {showPlayButton && showPlayButtonOverlay && (
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            void playVideo()
          }}
          className="absolute inset-0 flex items-center justify-center z-10 bg-black/30 focus:outline-none focus:ring-2 focus:ring-white/50"
          aria-label="Play video"
        >
          <span className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
            <svg
              className="w-8 h-8 text-neutral-900 ml-1"
              fill="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M8 5v14l11-7L8 5z" />
            </svg>
          </span>
        </button>
      )}
    </div>
  )
}

export default function HomeHero({ lng }: HomeHeroProps) {
  const desktopVideoSrc = getHomeHeroDesktopVideoUrl()
  const mobileVideoSrc = getHomeHeroMobileVideoUrl()
  const ariaLabel =
    lng === 'he' ? 'קולקציית החורף של SAKO 2026' : 'SAKO Winter Edition 2026'

  return (
    <Link
      href={`/${lng}/collection/campaign/new-collection`}
      // Mobile keeps 9/16. Desktop moves from 21/9 to 2/1 - roughly 17% taller - so
      // the hero reads as a fuller banner behind the transparent header.
      className="relative block aspect-[9/16] md:aspect-[2/1] group overflow-hidden"
      aria-label={ariaLabel}
    >
      {/* Both cuts open on a near-black frame, so bg-black doubles as the poster
       * and avoids a flash of a mismatched still before the first frame paints. */}
      <div className="absolute inset-0 bg-black">
        <div className="absolute inset-0 hidden md:block">
          <HomeHeroVideo
            videoSrc={desktopVideoSrc}
            width={DESKTOP_HERO_VIDEO_WIDTH}
            height={DESKTOP_HERO_VIDEO_HEIGHT}
            showPlayButton={false}
          />
        </div>
        <div className="absolute inset-0 md:hidden">
          <HomeHeroVideo
            videoSrc={mobileVideoSrc}
            width={MOBILE_HERO_VIDEO_WIDTH}
            height={MOBILE_HERO_VIDEO_HEIGHT}
          />
        </div>
      </div>
    </Link>
  )
}
