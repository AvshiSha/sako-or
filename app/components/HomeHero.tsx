'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { track } from '@vercel/analytics'
import {
  getHomeHeroMobileVideoUrl,
  getHomeHeroDesktopVideoUrl,
  getSummerSaleHeroDesktopImageUrl,
  getSummerSaleHeroMobileImageUrl,
} from '@/lib/image-urls'
import {
  getDesktopVideoPosterUrl,
  getHomeHeroMobilePosterUrl,
} from '@/lib/optimized-image-url'
import HomeHeroLinks from './HomeHeroLinks'

interface HomeHeroProps {
  lng: 'en' | 'he'
}

/** Native dimensions of the mobile hero MP4 (1080×1920, 9:16). */
const MOBILE_HERO_VIDEO_WIDTH = 1080
const MOBILE_HERO_VIDEO_HEIGHT = 1920

/** Native dimensions of the desktop hero MP4 (1920×823, ~21:9). */
const DESKTOP_HERO_VIDEO_WIDTH = 1920
const DESKTOP_HERO_VIDEO_HEIGHT = 823

function HomeHeroVideo({
  videoSrc,
  posterSrc,
  width,
  height,
  getPosterUrl,
  showPlayButton = true,
}: {
  videoSrc: string
  posterSrc: string
  width: number
  height: number
  getPosterUrl: (src: string) => string
  showPlayButton?: boolean
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isInView, setIsInView] = useState(false)
  const [showPlayButtonOverlay, setShowPlayButtonOverlay] = useState(false)
  const posterUrl = useMemo(() => getPosterUrl(posterSrc), [getPosterUrl, posterSrc])

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
        className="h-full w-full object-cover object-center transition-transform duration-700 group-hover:scale-[1.02]"
        width={width}
        height={height}
        muted
        loop
        playsInline
        preload={isInView ? 'metadata' : 'none'}
        poster={posterUrl}
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
  const desktopPosterSrc = getSummerSaleHeroDesktopImageUrl()
  const mobilePosterSrc = getSummerSaleHeroMobileImageUrl()
  const mobileVideoSrc = getHomeHeroMobileVideoUrl()
  const desktopVideoSrc = getHomeHeroDesktopVideoUrl()
  const ariaLabel =
    lng === 'he' ? 'לקולקציה החדשה' : 'Shop new collection'

  return (
    <Link
      href={`/${lng}/collection/campaign?slug=new-collection`}
      onClick={() => track('hero_new_collection')}
      className="relative block aspect-[9/16] md:aspect-[21/9] group"
      aria-label={ariaLabel}
    >
      <div className="absolute inset-0 bg-black md:bg-transparent overflow-hidden">
        <div className="absolute inset-0 hidden md:block">
          <HomeHeroVideo
            videoSrc={desktopVideoSrc}
            posterSrc={desktopPosterSrc}
            width={DESKTOP_HERO_VIDEO_WIDTH}
            height={DESKTOP_HERO_VIDEO_HEIGHT}
            getPosterUrl={getDesktopVideoPosterUrl}
            showPlayButton={false}
          />
        </div>
        <div className="absolute inset-0 md:hidden">
          <HomeHeroVideo
            videoSrc={mobileVideoSrc}
            posterSrc={mobilePosterSrc}
            width={MOBILE_HERO_VIDEO_WIDTH}
            height={MOBILE_HERO_VIDEO_HEIGHT}
            getPosterUrl={getHomeHeroMobilePosterUrl}
          />
        </div>
      </div>
      <div className="relative h-full z-[5] pointer-events-none">
        <HomeHeroLinks lng={lng} />
      </div>
    </Link>
  )
}
