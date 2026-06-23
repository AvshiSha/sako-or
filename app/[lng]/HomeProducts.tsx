import { fetchHomeBestSellers } from '@/lib/home-products'
import { fetchHomeShoeCategories } from '@/lib/home-categories'
import { HOME_COLLECTION_BANNERS } from '@/lib/home-collections'

import HomeClient from './HomeClient'

export function HomeProductsFallback() {
  return (
    <div
      className="w-full py-12 min-h-[420px] md:min-h-[480px] animate-pulse bg-[#E1DBD7]"
      aria-hidden="true"
    />
  )
}

export default async function HomeProducts({
  lng,
}: {
  lng: 'en' | 'he'
}) {
  const [bestSellers, categories] = await Promise.all([
    fetchHomeBestSellers(),
    fetchHomeShoeCategories(lng),
  ])

  return (
    <HomeClient
      initialBestSellers={bestSellers}
      initialCategories={categories}
      collectionBanners={HOME_COLLECTION_BANNERS}
    />
  )
}
