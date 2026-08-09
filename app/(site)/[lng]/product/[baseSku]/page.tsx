import { notFound, redirect } from 'next/navigation'
import { getCachedProductByBaseSku } from '@/lib/server/cached-product-data'
import { getPrimaryColorSlug } from '@/lib/product-seo'

interface ProductRedirectPageProps {
  params: Promise<{
    lng: string
    baseSku: string
  }>
}

/**
 * The base SKU URL has no content of its own - it resolves to the product's
 * primary colour, which is the URL the canonical tag and the sitemap agree on.
 *
 * DO NOT add a loading.tsx to this route or any route above it.
 *
 * A loading.tsx creates an implicit Suspense boundary, and Next streams that
 * fallback immediately - which sends the response headers and locks the status
 * at 200. Once that happens `redirect()` cannot set a 3xx and silently
 * degrades to `<meta http-equiv="refresh" content="1;url=...">` inside a 200,
 * and `notFound()` renders the not-found UI inside a 200 instead of a real
 * 404. Both are soft redirects/404s that Google discounts and that most AI
 * crawlers ignore entirely. There used to be a loading.tsx at
 * app/[lng]/loading.tsx and this whole route tree behaved that way.
 *
 * 307 rather than 308 on purpose: the destination is whichever colour is
 * currently first and active, so it can legitimately change. A permanent
 * redirect would be cached by browsers and could strand a bookmark on a
 * colour that has since been discontinued.
 */
export default async function ProductRedirectPage({ params }: ProductRedirectPageProps) {
  const { lng, baseSku } = await params

  if (!['en', 'he'].includes(lng)) {
    notFound()
  }

  const product = await getCachedProductByBaseSku(baseSku)
  if (!product) {
    notFound()
  }

  const primaryColorSlug = getPrimaryColorSlug(product.colorVariants)
  if (!primaryColorSlug) {
    notFound()
  }

  redirect(`/${lng}/product/${baseSku}/${primaryColorSlug}`)
}
