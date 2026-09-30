import type { Metadata } from 'next'
import { fetchHomeBestSellers } from '@/lib/home-products'
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

export default async function StorefrontNotFoundPage() {
  const products = await fetchHomeBestSellers()
  return <NotFoundClient products={products} />
}
