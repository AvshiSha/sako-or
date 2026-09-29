'use client'

import Image from 'next/image'
import Link from 'next/link'
import type { HomeCollectionBanner } from '@/lib/home-collections'

/**
 * Home collection banners, design system 438:3244.
 *
 * Full-bleed and unlabelled: the frame has no section heading and no container -
 * the banners run to the viewport edge, divided by a 1px gutter like the
 * collection grid. One tall banner beside a stacked pair.
 */

interface ShopByCollectionProps {
  banners: HomeCollectionBanner[]
  lng: 'en' | 'he'
}

function CollectionBannerCard({
  banner,
  lng,
  index,
  variant,
  priority,
}: {
  banner: HomeCollectionBanner
  lng: 'en' | 'he'
  index: number
  variant: 'tall' | 'half'
  priority: boolean
}) {
  const title = lng === 'he' ? banner.title.he : banner.title.en

  return (
    <Link
      href={`/${lng}${banner.href}`}
      className="group relative block overflow-hidden bg-surface-secondary"
      aria-label={title}
    >
      {/* 863.5x1149 and 863.5x574 in the frame. */}
      <div className={variant === 'tall' ? 'aspect-[3/2] lg:aspect-[863/1149]' : 'aspect-[3/2]'}>
        <Image
          src={banner.image}
          alt={title}
          fill
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          priority={priority}
          loading={priority ? undefined : 'lazy'}
        />
      </div>

      {/* Dark wash rising from the foot and gone by halfway (438:3247), so the
          white type stays legible without flattening the whole image. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 to-transparent to-50%"
      />

      {/* dir="ltr" pins the composition: the frame sets the index top-right and the
          heading bottom-right, over the emptier side of every shot. Left to mirror,
          RTL would swing both across the product. The title keeps dir="auto" so a
          Hebrew name still sets right-to-left inside its right-aligned block. */}
      <div
        dir="ltr"
        className="pointer-events-none absolute inset-0 flex flex-col items-end justify-between p-[16px] lg:p-[30px]"
      >
        {/* Typography/Heading/Index — Black 52/52 at 65%. */}
        <span className="font-ploni text-[32px] font-black leading-none text-text-inverse opacity-65 lg:text-[52px] lg:leading-[52px]">
          {String(index).padStart(2, '0')}
        </span>

        <span className="flex flex-col items-end gap-[10px]">
          {/* Typography/Heading/H3 — Black 96/76. */}
          <span
            dir="auto"
            className="text-right font-ploni text-[40px] font-black uppercase leading-[34px] text-text-inverse lg:text-[96px] lg:leading-[76px]"
          >
            {title}
          </span>
          <span className="flex items-center gap-[10px]">
            {/* Same 7px corner-turned square the About band and the collection bar
                use - a geometric primitive, drawn in CSS rather than fetched. */}
            <i
              aria-hidden="true"
              className="block size-[7px] shrink-0 rotate-45 border-b border-l border-text-inverse"
            />
            <span className="font-ploni text-[9px] tracking-[0.72px] text-text-inverse">
              {banner.cta}
            </span>
          </span>
        </span>
      </div>
    </Link>
  )
}

export default function ShopByCollection({ banners, lng }: ShopByCollectionProps) {
  if (!banners.length) {
    return null
  }

  // The frame's arrangement is one full-height banner beside two stacked halves.
  // With any other count the grid simply stacks them, rather than leaving a hole.
  const [lead, ...rest] = banners
  const stacked = rest.slice(0, 2)
  const overflow = rest.slice(2)

  return (
    <section
      className="w-full"
      aria-label={lng === 'he' ? 'קולקציות' : 'Shop by collection'}
    >
      <div className="grid grid-cols-1 gap-px lg:grid-cols-2">
        <CollectionBannerCard banner={lead} lng={lng} index={1} variant="tall" priority />

        {stacked.length > 0 && (
          <div className="grid gap-px">
            {stacked.map((banner, i) => (
              <CollectionBannerCard
                key={banner.id}
                banner={banner}
                lng={lng}
                index={i + 2}
                variant="half"
                priority={false}
              />
            ))}
          </div>
        )}

        {overflow.map((banner, i) => (
          <CollectionBannerCard
            key={banner.id}
            banner={banner}
            lng={lng}
            index={i + 2 + stacked.length}
            variant="half"
            priority={false}
          />
        ))}
      </div>
    </section>
  )
}
