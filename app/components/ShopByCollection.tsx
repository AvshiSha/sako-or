'use client'

import Image from 'next/image'
import Link from 'next/link'
import type { HomeCollectionBanner } from '@/lib/home-collections'

interface ShopByCollectionProps {
  banners: HomeCollectionBanner[]
  lng: 'en' | 'he'
}

function CollectionBannerCard({
  banner,
  lng,
}: {
  banner: HomeCollectionBanner
  lng: 'en' | 'he'
}) {
  const title = lng === 'he' ? banner.title.he : banner.title.en
  const shopNow = lng === 'he' ? 'Shop now' : 'Shop now'

  return (
    <Link
      href={`/${lng}${banner.href}`}
      className="group relative block w-full overflow-hidden"
      aria-label={title}
    >
      <div className="relative w-full aspect-[3/4] bg-neutral-200">
        <Image
          src={banner.image}
          alt={title}
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
          loading="lazy"
        />
        <div
          className="absolute inset-0 bg-neutral-900/40 transition-colors duration-300 group-hover:bg-neutral-900/50"
          aria-hidden="true"
        />
        <div className="pointer-events-none absolute bottom-0 left-0 p-6 md:p-8 text-left flex flex-col gap-0.5">
          <div className="text-white text-2xl md:text-3xl font-semibold tracking-tight uppercase leading-tight">
            {title}
          </div>
          <div className="text-white/90 text-sm md:text-base font-light tracking-wide underline decoration-white/80 underline-offset-4 group-hover:text-white leading-tight">
            {shopNow}
          </div>
        </div>
      </div>
    </Link>
  )
}

export default function ShopByCollection({ banners, lng }: ShopByCollectionProps) {
  if (!banners.length) {
    return null
  }

  const sectionTitle = lng === 'he' ? 'SHOP BY COLLECTION' : 'SHOP BY COLLECTION'
  const sectionLabel = lng === 'he' ? 'Shop by collection' : 'Shop by collection'

  return (
    <section
      className="w-full bg-white"
      aria-label={sectionLabel}
    >
      <div className="max-w-[90rem] lg:max-w-[90%] xl:max-w-[90%] mx-auto px-1 sm:px-4 lg:px-4 pt-8 md:pt-12 pb-4 md:pb-6">
        <h2 className="text-xl md:text-2xl font-bold text-black mb-4 text-center uppercase tracking-wide">
          {sectionTitle}
        </h2>
        <div className="border-b border-gray-200 mb-4" />

        <div className="flex flex-col gap-2 md:grid md:grid-cols-3 md:gap-2 lg:gap-3">
          {banners.map((banner) => (
            <CollectionBannerCard key={banner.id} banner={banner} lng={lng} />
          ))}
        </div>
      </div>
    </section>
  )
}
