import type { Metadata } from 'next'
import { fetchHomeBestSellers } from '@/lib/home-products'
import NotFoundClient from './NotFoundClient'

/**
 * The notFound() boundary for the storefront.
 *
 * Unmatched URLs do NOT arrive here - they are served by the [...notFound]
 * catch-all page beside this file, which is what actually renders the design.
 * This covers the other case: a page that resolves a route and then throws
 * notFound() itself, the way the product route does for an unknown SKU.
 *
 * Caveat, and the reason the catch-all exists: with two root layouts in the app
 * - (site)/[lng] and (unlocalized) - Next cannot pick one for a not-found
 * boundary, so it renders this in its own bare default document. No <html lang>,
 * no header, no footer, and no stylesheet, since globals.css is imported by
 * RootShell inside the layout that gets dropped. The markup and the 404 status
 * are right; the styling is not, and consolidating to a single root layout is
 * what fixes it. Same component as the catch-all, so that fix lands here too.
 */
export const metadata: Metadata = {
  title: 'הדף לא נמצא | סכו עור',
  robots: {
    index: false,
    follow: true,
  },
}

export default async function NotFound() {
  const products = await fetchHomeBestSellers()
  return <NotFoundClient products={products} />
}
