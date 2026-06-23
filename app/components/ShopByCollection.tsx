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
  const shopNow = lng === 'he' ? 'לצפייה' : 'Shop now'

  return (
    <Link
      href={`/${lng}${banner.href}`}
      className="group relative block overflow-hidden"
      aria-label={title}
    >
      <div className="relative w-full aspect-[3/4] bg-neutral-200">
        <Image
          src={banner.image}
          alt={title}
          fill
          sizes="100vw"
          className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
          loading="lazy"
        />
        <div
          className="absolute inset-0 bg-neutral-900/40 transition-colors duration-300 group-hover:bg-neutral-900/50"
          aria-hidden="true"
        />
        <div
          className={`pointer-events-none absolute inset-x-0 bottom-0 p-6 md:p-8 ${
            lng === 'he' ? 'text-right' : 'text-left'
          }`}
        >
          <div className="text-white text-2xl md:text-3xl font-semibold tracking-tight uppercase">
            {title}
          </div>
          <div className="mt-2 text-white/90 text-base md:text-lg font-light tracking-wide underline decoration-white/80 underline-offset-4 group-hover:text-white">
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

  const sectionTitle = lng === 'he' ? 'קנו לפי קולקציה' : 'SHOP BY COLLECTION'
  const sectionLabel = lng === 'he' ? 'קנו לפי קולקציה' : 'Shop by collection'

  return (
    <section
      className="w-full bg-white"
      aria-label={sectionLabel}
    >
      <div className="max-w-[90rem] lg:max-w-[90%] xl:max-w-[90%] mx-auto px-2 sm:px-6 lg:px-4 pt-4 md:pt-6 pb-4 md:pb-6">
        <h2 className="text-2xl md:text-3xl font-bold text-black mb-4 text-center uppercase tracking-wide">
          {sectionTitle}
        </h2>
        <div className="border-b border-gray-200 mb-4" />

        <div className="flex flex-col gap-2 md:gap-3">
          {banners.map((banner) => (
            <CollectionBannerCard key={banner.id} banner={banner} lng={lng} />
          ))}
        </div>
      </div>
    </section>
  )
}
