import type { Metadata } from 'next'
import { Suspense } from 'react'

import { fetchHomeBestSellers } from '@/lib/home-products'
import ProductCarousel from '@/app/components/ProductCarousel'
import ProductCarouselSkeleton from '@/app/components/ProductCarouselSkeleton'
import NotFoundClient from '../NotFoundClient'

/**
 * Storefront 404 (404 / Desktop 438:3397, 404 / Mobile 438:3853).
 *
 * A catch-all page rather than a notFound() throw, and that is not a shortcut.
 * This app has two root layouts - (site)/[lng] and (unlocalized) - and with more
 * than one, Next renders every not-found boundary in its own bare default
 * document instead of a root layout, because it has no way to pick between them.
 * The result is a page with no <html lang>, no header, no footer and no
 * stylesheet: globals.css is imported by RootShell, which lives in the layout
 * that gets dropped. The product route's own not-found already ships in that
 * state - /he/product/<unknown>/x renders Next's bare fallback today.
 *
 * Rendering from a page keeps the 404 inside the locale layout, so it gets the
 * chrome, the fonts and the tokens the design is built on. The cost is the
 * status code: a page returns 200, so this is a soft 404, held back from the
 * index by the robots directive below until the root layouts are consolidated.
 *
 * It cannot shadow a real route - Next resolves static and dynamic segments
 * before a catch-all, so every directory beside this one still wins, including
 * collection's own optional catch-all.
 */
export const metadata: Metadata = {
  title: 'הדף לא נמצא | סכו עור',
  robots: {
    index: false,
    follow: true,
  },
}

/**
 * The suggestions rail. Everything slow on this page is in here on purpose: a
 * visitor who has hit a dead end should be told so immediately, not after a
 * Firestore round trip for a carousel below the apology. Measured before this
 * split: 1.8s to any content, all of it waiting on this query.
 */
async function NotFoundBestSellers({ title, language }: { title: string; language: 'en' | 'he' }) {
  const products = await fetchHomeBestSellers()

  if (products.length === 0) return null

  return <ProductCarousel products={products} title={title} language={language} />
}

export default async function StorefrontNotFoundPage({
  params,
}: {
  params: Promise<{ lng: string }>
}) {
  const { lng } = await params
  const language = lng === 'en' ? 'en' : 'he'
  const carouselTitle = language === 'he' ? 'הנמכרים ביותר' : 'Best Sellers'

  return (
    <NotFoundClient
      carousel={
        <Suspense
          fallback={
            <ProductCarouselSkeleton
              title={carouselTitle}
              label="Loading suggestions"
            />
          }
        >
          <NotFoundBestSellers title={carouselTitle} language={language} />
        </Suspense>
      }
    />
  )
}
