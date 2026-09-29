import { fetchHomeBestSellers } from '@/lib/home-products'
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

// No lng parameter: it only ever fed fetchHomeShoeCategories, and HomeClient
// derives the locale from the pathname itself.
export default async function HomeProducts() {
  // Only best sellers now: the SHOP BY CATEGORY section was the sole consumer
  // of fetchHomeShoeCategories, so dropping it takes a second Firestore round trip
  // off the home page's critical path.
  const bestSellers = await fetchHomeBestSellers()

  return (
    <HomeClient
      initialBestSellers={bestSellers}
      collectionBanners={HOME_COLLECTION_BANNERS}
    />
  )
}
