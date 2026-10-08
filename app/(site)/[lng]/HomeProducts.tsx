import { fetchHomeBestSellers } from '@/lib/home-products'

import ProductCarousel from '@/app/components/ProductCarousel'
import ProductCarouselSkeleton from '@/app/components/ProductCarouselSkeleton'

/**
 * The best-sellers band - the only part of the home page that waits on data.
 *
 * It used to carry the whole lower half of the page behind its Suspense boundary,
 * including the About band and Shop by Collection, neither of which needs a
 * fetch: the banners are a module constant and both components are presentational.
 * Measured below the hero at 390: About 281px, Shop by Collection 1064px, this
 * carousel 487.8px - so 73% of what the fallback had to stand in for was content
 * the server could already render. It is rendered outside the boundary now, and
 * this file reserves only the carousel.
 */

function bestSellersTitle(lng: 'en' | 'he') {
  return lng === 'he' ? 'הנמכרים ביותר' : 'Best Sellers'
}

/** Shared by the band and its fallback so the ground behind them matches. */
function bandClassName(lng: 'en' | 'he') {
  return lng === 'he'
    ? 'text-right bg-surface-secondary'
    : 'text-left bg-surface-secondary'
}

/**
 * The fallback. Reserves the ruled header band at its real padding and a row of
 * cards at the carousel's own item basis — which is what decides the card width,
 * and therefore the height of the whole band.
 *
 * The placeholder is `CollectionProductCardSkeleton`, not a bespoke box: the
 * carousel's cards are `ProductCard`s, and that skeleton is already dimension-
 * matched to one (measured to within half a pixel on the collection grid). Four
 * is enough to fill the track at every width; `overflow-clip` on the section hides
 * the remainder exactly as it does for the real carousel.
 *
 * The title is the real string rather than a grey bar: it is known without the
 * fetch, so rendering it means the heading never swaps and the band's top edge
 * never moves.
 */
export function HomeProductsFallback({ lng = 'he' }: { lng?: 'en' | 'he' }) {
  return (
    <div className={bandClassName(lng)}>
      <ProductCarouselSkeleton
        title={bestSellersTitle(lng)}
        label="Loading best sellers"
      />
    </div>
  )
}

export default async function HomeProducts({ lng }: { lng: 'en' | 'he' }) {
  const bestSellers = await fetchHomeBestSellers()

  // Same guard the client had. An empty list means the band does not exist at
  // all, so the reserved space is given back - the one case where this fallback
  // over-reserves, and it is the case where there is nothing to show anyway.
  if (bestSellers.length === 0) return null

  return (
    <div className={bandClassName(lng)}>
      <ProductCarousel
        products={bestSellers}
        title={bestSellersTitle(lng)}
        language={lng}
      />
    </div>
  )
}
