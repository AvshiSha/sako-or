'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

import type { CollectionBanner } from '@/lib/collection-banners'
import { PRODUCT_CARD_IMAGE_ASPECT, PRODUCT_CARD_INFO_MIN_H } from '@/lib/product-card-layout'

/**
 * A merchandising banner occupying one card slot in the product grid.
 *
 * Height is composed from the card's own layout tokens rather than restated, so a
 * row containing a banner measures exactly like a row of cards. That matters more
 * than it looks: the grid has no gutters, the virtualiser measures row heights,
 * and COLLECTION_GRID_CRITICAL_CSS reserves a min-height per slot - a banner even
 * a few pixels off reopens the white line between rows at some viewport widths.
 *
 * Borders match too (border-l / border-b in sako-black). With zero gutters the
 * cards' own borders are the only thing ruling the grid, so a banner without them
 * would punch a hole in it.
 */
export default function CollectionGridBanner({
  banner,
  lng,
}: {
  banner: CollectionBanner
  lng: 'en' | 'he'
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [reduceMotion, setReduceMotion] = useState(false)

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReduceMotion(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  // Play only while on screen. The grid is virtualised, so off-screen banners are
  // not mounted at all - this covers the ones mounted but scrolled past, which
  // would otherwise keep a decoder running for the length of the listing.
  useEffect(() => {
    const video = videoRef.current
    if (!video || banner.media.type !== 'video' || reduceMotion) return
    if (typeof IntersectionObserver === 'undefined') return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          void video.play().catch(() => {
            /* autoplay refused - the poster stands in, which is an acceptable result */
          })
        } else {
          video.pause()
        }
      },
      { threshold: 0.25 }
    )

    observer.observe(video)
    return () => observer.disconnect()
  }, [banner.media.type, reduceMotion])

  const isVideo = banner.media.type === 'video'

  return (
    <Link
      href={`/${lng}${banner.href}`}
      aria-label={banner.alt}
      className="group relative block overflow-hidden border-b border-l border-sako-black bg-surface-secondary"
      data-collection-banner={banner.id}
    >
      {/* These two spacers define the height and nothing else - the same aspect and
          the same info-block minimum a card uses. Composed from the shared tokens
          so the banner follows automatically if the card's proportions change. */}
      <div aria-hidden="true" className={PRODUCT_CARD_IMAGE_ASPECT} />
      <div aria-hidden="true" className={PRODUCT_CARD_INFO_MIN_H} />

      <div className="absolute inset-0">
        {isVideo ? (
          <video
            ref={videoRef}
            // preload="none" keeps the video out of the initial payload; the poster
            // carries the first paint. Reduced motion stops at the poster entirely.
            src={reduceMotion ? undefined : banner.media.src}
            poster={banner.media.type === 'video' ? banner.media.poster : undefined}
            muted
            loop
            playsInline
            preload="none"
            aria-hidden="true"
            className="h-full w-full object-cover"
          />
        ) : banner.media.type === 'image' && banner.media.srcMobile ? (
          /* Art direction, not responsive sizing. The slot is ~1.84 tall on
             mobile and ~1.38 on desktop - a third apart - so one image
             object-covered into both loses a quarter of itself at one of them.
             Two <Image>s switched on the same lg breakpoint as the grid is the
             pattern Next documents for this; <picture> would cost the
             optimizer, and swapping src in JS would flash on hydration.
             Only the matching one is ever on screen, and both are lazy. */
          <>
            <Image
              src={banner.media.srcMobile}
              alt=""
              fill
              sizes="50vw"
              className="object-cover transition-transform duration-500 group-hover:scale-[1.03] lg:hidden"
              loading="lazy"
            />
            <Image
              src={banner.media.src}
              alt=""
              fill
              sizes="25vw"
              className="hidden object-cover transition-transform duration-500 group-hover:scale-[1.03] lg:block"
              loading="lazy"
            />
          </>
        ) : (
          <Image
            src={banner.media.src}
            alt=""
            fill
            // Matches the card grid: two columns below lg, four above.
            sizes="(min-width: 1024px) 25vw, 50vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            loading="lazy"
          />
        )}
      </div>
    </Link>
  )
}
