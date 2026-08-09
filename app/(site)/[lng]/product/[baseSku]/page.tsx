import { notFound, redirect } from 'next/navigation'
import { getCachedProductByBaseSku } from '@/lib/server/cached-product-data'

interface ProductRedirectPageProps {
  params: Promise<{
    lng: string
    baseSku: string
  }>
}

/**
 * The base SKU URL has no content of its own - it resolves to the product's
 * default colour variant, which is the URL we actually publish in the sitemap.
 *
 * This has to redirect on the server. It previously did the lookup in a
 * `useEffect` and called `router.replace()`, which meant the URL answered
 * HTTP 200 with a loading spinner as its entire body: crawlers that don't
 * execute JS (most AI crawlers do not) saw "Redirecting to product..." and
 * nothing else, and Google treats a 200-with-no-content as a soft 404.
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

  // Match the colour page's own guard (`variant.isActive === false` fails it),
  // otherwise we can redirect to a variant that immediately 404s.
  const defaultVariant = Object.values(product.colorVariants || {}).find(
    (variant) => variant.isActive !== false
  )

  if (!defaultVariant?.colorSlug) {
    notFound()
  }

  redirect(`/${lng}/product/${baseSku}/${defaultVariant.colorSlug}`)
}
