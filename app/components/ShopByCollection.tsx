'use client'

import Image from 'next/image'
// ListingLink, not next/link, for every href below that points at a listing route:
// prefetching those intermittently renders an empty content area instead of the
// loading skeleton. See ListingLink - do not swap this back. Enforced by eslint.
import ListingLink from '@/app/components/ListingLink'
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
  variant,
  priority,
}: {
  banner: HomeCollectionBanner
  lng: 'en' | 'he'
  variant: 'tall' | 'half'
  priority: boolean
}) {
  const title = lng === 'he' ? banner.title.he : banner.title.en

  return (
    <ListingLink
      href={`/${lng}${banner.href}`}
      className="group relative block overflow-hidden bg-surface-secondary"
      aria-label={title}
    >
      {/* The tall slot takes the mobile frame's 390x544 (438:3428) so it reads big
          on a phone. The two halves deliberately keep their landscape 3:2 instead -
          438:3427 gives every mobile banner the same 544px height, but three
          equally tall blocks in a row looked heavier than the pair does short.
          Desktop is the frame's 863.5x1149 and 863.5x574 either way. */}
      <div
        className={
          variant === 'tall'
            ? 'aspect-[390/544] lg:aspect-[863/1149]'
            : 'aspect-[3/2] lg:aspect-[863/574]'
        }
      >
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
      {/* justify-end, not justify-between: the frame's index numeral (438:3249) is
          dropped by decision, so the heading block is all that is left to place. */}
      <div
        dir="ltr"
        className="pointer-events-none absolute inset-0 flex flex-col items-end justify-end p-[16px] lg:p-[30px]"
      >
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
    </ListingLink>
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
      {/* No gutter on mobile: 438:3427 stacks the banners at a 544px pitch against
          544px banners, i.e. flush. The 1px division is a desktop detail, where the
          two columns need separating. */}
      <div className="grid grid-cols-1 gap-0 lg:grid-cols-2 lg:gap-px">
        <CollectionBannerCard banner={lead} lng={lng} variant="tall" priority />

        {stacked.length > 0 && (
          <div className="grid gap-0 lg:gap-px">
            {stacked.map((banner) => (
              <CollectionBannerCard
                key={banner.id}
                banner={banner}
                lng={lng}
                variant="half"
                priority={false}
              />
            ))}
          </div>
        )}

        {overflow.map((banner) => (
          <CollectionBannerCard
            key={banner.id}
            banner={banner}
            lng={lng}
            variant="half"
            priority={false}
          />
        ))}
      </div>
    </section>
  )
}
