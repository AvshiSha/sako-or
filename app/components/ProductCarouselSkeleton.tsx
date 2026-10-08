import CollectionProductCardSkeleton from '@/app/components/CollectionProductCardSkeleton'

import {
  CAROUSEL_HEADER_BAND,
  CAROUSEL_ITEM_WIDTH,
  CAROUSEL_TITLE,
} from './carouselChrome'

/**
 * A stand-in for ProductCarousel, used wherever a carousel sits behind a Suspense
 * boundary - the home page's best sellers and the blog article's related products.
 *
 * The placeholder is `CollectionProductCardSkeleton` rather than a bespoke box,
 * because the carousel's cards *are* ProductCards and that skeleton is already
 * dimension-matched to one. Measured against the real carousel: 487.3 against
 * 487.8 on mobile, 670.6 against 671.1 on desktop.
 *
 * The title is rendered as real text, not a grey bar. Every caller knows it
 * without waiting for the fetch, so rendering it means the heading never swaps and
 * the band's top edge never moves.
 *
 * Four cards is enough to fill the track at every width; `overflow-clip` on the
 * section hides the remainder exactly as it does for the real carousel.
 *
 * Deliberately not a client component, and it takes its measurements from
 * carouselChrome - a plain module. A chrome module with 'use client' on it hands
 * a server component client *references* instead of strings, which renders the
 * source of a throwing stub into the markup without failing the build. See §4b of
 * LOADING_ARCHITECTURE.md.
 */
export default function ProductCarouselSkeleton({
  title,
  label = 'Loading products',
}: {
  title: string
  label?: string
}) {
  return (
    <section
      className="w-full overflow-clip"
      role="status"
      aria-busy="true"
      aria-label={label}
    >
      <div className={`${CAROUSEL_HEADER_BAND} justify-center`}>
        <h2 className={CAROUSEL_TITLE}>{title}</h2>
      </div>

      <div className="relative bg-surface-dark">
        <div className="flex">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={`carousel-skeleton-${index}`}
              className={`${CAROUSEL_ITEM_WIDTH} min-w-0 shrink-0 grow-0`}
            >
              <CollectionProductCardSkeleton />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
