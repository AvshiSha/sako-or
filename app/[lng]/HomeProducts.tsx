import { fetchHomeBestSellers, fetchHomeBagsProducts } from '@/lib/home-products'

import HomeClient from './HomeClient'

export function HomeProductsFallback() {
  return (
    <div
      className="w-full py-12 min-h-[420px] md:min-h-[480px] animate-pulse"
      style={{ backgroundColor: '#E1DBD7' }}
      aria-hidden="true"
    />
  )
}

export default async function HomeProducts() {
  const [bestSellers, sakoOrProducts] = await Promise.all([
    fetchHomeBestSellers(),
    fetchHomeBagsProducts(),
  ])

  return (
    <HomeClient
      initialBestSellers={bestSellers}
      initialSakoOrProducts={sakoOrProducts}
    />
  )
}
