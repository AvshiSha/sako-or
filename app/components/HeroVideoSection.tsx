'use client'

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import Image from 'next/image'
import {
  getDesktopVideoPosterUrl,
  getMobileVideoPosterUrl,
} from '@/lib/optimized-image-url'

/** Hero video block: poster, programmatic play, tap-to-play when blocked, and play only when in view. */
export default function HeroVideoSection({
  desktopSrc,
  mobileSrc,
  posterSrc,
  children,
  overlayOpacity = 'bg-neutral-900/60',
  desktopObjectPosition = 'center',
  mobileObjectPosition = 'center',
  priority = false,
}: {
  desktopSrc: string
  mobileSrc: string
  posterSrc: string
  children?: React.ReactNode
  overlayOpacity?: string
  desktopObjectPosition?: string
  mobileObjectPosition?: string
  priority?: boolean
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const desktopRef = useRef<HTMLVideoElement>(null)
  const mobileRef = useRef<HTMLVideoElement>(null)
  const isMountedRef = useRef(true)
  const [showPlayButton, setShowPlayButton] = useState(false)
  const [isInView, setIsInView] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const safeSetShowPlayButton = useCallback((value: boolean) => {
    if (isMountedRef.current) {
      setShowPlayButton(value)
    }
  }, [])

  const isVideoSrc = useCallback((src: string) => src.toLowerCase().includes('.mp4'), [])
  const hasDesktopVideo = isVideoSrc(desktopSrc)
  const hasMobileVideo = isVideoSrc(mobileSrc)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setIsInView(entry.isIntersecting)
        })
      },
      { threshold: 0.25, rootMargin: '0px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  const playCurrent = useCallback(async () => {
    const video = isMobile ? mobileRef.current : desktopRef.current
    if (!video) return
    try {
      await video.play()
      safeSetShowPlayButton(false)
    } catch {
      safeSetShowPlayButton(true)
    }
  }, [isMobile, safeSetShowPlayButton])

  useEffect(() => {
    if (!hasDesktopVideo && !hasMobileVideo) return
    if (!isInView) {
      desktopRef.current?.pause()
      mobileRef.current?.pause()
      return
    }
    const video = isMobile ? mobileRef.current : desktopRef.current
    if (!video) return

    let cancelled = false
    const playPromise = video.play()
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        if (!cancelled) {
          safeSetShowPlayButton(true)
        }
      })
    }

    return () => {
      cancelled = true
    }
  }, [isInView, isMobile, hasDesktopVideo, hasMobileVideo, safeSetShowPlayButton])

  useEffect(() => {
    if (!hasDesktopVideo && !hasMobileVideo) return
    const video = isMobile ? mobileRef.current : desktopRef.current
    if (!video) return
    const onPlaying = () => safeSetShowPlayButton(false)
    video.addEventListener('playing', onPlaying)
    return () => video.removeEventListener('playing', onPlaying)
  }, [isMobile, hasDesktopVideo, hasMobileVideo, safeSetShowPlayButton])

  const videoPreload = isInView ? 'metadata' : 'none'
  const mobilePoster = useMemo(() => getMobileVideoPosterUrl(posterSrc), [posterSrc])
  const desktopPoster = useMemo(() => getDesktopVideoPosterUrl(posterSrc), [posterSrc])

  return (
    <div ref={containerRef} className="relative aspect-[3/4] md:aspect-[21/9]">
      <div
        className={`absolute inset-0 flex md:block items-center justify-center bg-black md:bg-transparent md:overflow-hidden ${
          showPlayButton ? 'z-10' : 'z-0'
        }`}
      >
        {hasDesktopVideo ? (
          <video
            ref={desktopRef}
            className="hidden md:block h-full w-full object-cover"
            style={{ objectPosition: desktopObjectPosition }}
            width={1920}
            height={823}
            muted
            loop
            playsInline
            preload={videoPreload}
            poster={desktopPoster}
            aria-hidden="true"
          >
            <source src={desktopSrc} type="video/mp4" />
          </video>
        ) : (
          <Image
            src={desktopSrc || posterSrc}
            alt=""
            fill
            sizes="(min-width: 768px) 100vw, 0px"
            className="hidden md:block object-cover"
            style={{ objectPosition: desktopObjectPosition }}
            priority={priority}
            fetchPriority={priority ? 'high' : undefined}
            loading={priority ? undefined : 'lazy'}
            aria-hidden="true"
          />
        )}

        {hasMobileVideo ? (
          <video
            ref={mobileRef}
            className="block md:hidden h-full w-full object-cover"
            style={{ objectPosition: mobileObjectPosition }}
            width={768}
            height={1024}
            muted
            loop
            playsInline
            preload={videoPreload}
            poster={mobilePoster}
            aria-hidden="true"
          >
            <source src={mobileSrc} type="video/mp4" />
          </video>
        ) : (
          <Image
            src={mobileSrc || posterSrc}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 0px"
            className="block md:hidden object-cover"
            style={{ objectPosition: mobileObjectPosition }}
            priority={priority}
            fetchPriority={priority ? 'high' : undefined}
            loading={priority ? undefined : 'lazy'}
            aria-hidden="true"
          />
        )}

        {showPlayButton && (hasDesktopVideo || hasMobileVideo) && (
          <button
            type="button"
            onClick={playCurrent}
            className="md:hidden absolute inset-0 flex items-center justify-center z-10 bg-black/30 focus:outline-none focus:ring-2 focus:ring-white/50 rounded-none"
            aria-label="Play video"
          >
            <span className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
              <svg className="w-8 h-8 text-neutral-900 ml-1" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M8 5v14l11-7L8 5z" />
              </svg>
            </span>
          </button>
        )}
        <div className={`absolute inset-0 ${overlayOpacity}`} aria-hidden="true" />
      </div>
      <div className="relative h-full z-[5]">{children}</div>
    </div>
  )
}
