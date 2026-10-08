import { notFound, redirect } from 'next/navigation'
import { getCachedProductByBaseSku } from '@/lib/server/cached-product-data'
import { getPrimaryColorSlug } from '@/lib/product-seo'

interface ProductRedirectPageProps {
  params: Promise<{
    lng: string
    baseSku: string
  }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/**
 * Rebuilds the incoming query string so the redirect below can carry it.
 *
 * This hop happens on the server, before any script on the page runs, so
 * anything dropped here is not merely moved - it never reaches the browser at
 * all. `fbclid` is the one that matters most: fbevents.js reads it off the
 * landing URL to set the `_fbc` cookie, which is what lets Meta join an ad
 * click to the session that follows. Measured 2026-10-08, this redirect
 * answered `/he/product/5124-5317?fbclid=…&utm_source=facebook` with a bare
 * `location: /he/product/5124-5317/black`, so every Meta ad pointed at a base
 * SKU lost its click id and all of its utm_* tagging. The middleware's own
 * locale redirect already preserves the query string; this one did not.
 *
 * Repeated keys are appended rather than overwritten, because `searchParams`
 * hands them over as an array and a Meta URL can legitimately carry the same
 * key twice.
 */
function buildQuerySuffix(
  searchParams: Record<string, string | string[] | undefined>
): string {
  const query = new URLSearchParams()

  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      for (const entry of value) query.append(key, entry)
    } else if (value !== undefined) {
      query.append(key, value)
    }
  }

  const serialized = query.toString()
  return serialized ? `?${serialized}` : ''
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
export default async function ProductRedirectPage({
  params,
  searchParams,
}: ProductRedirectPageProps) {
  const { lng, baseSku } = await params

  if (!['en', 'he'].includes(lng)) {
    notFound()
  }

  const product = await getCachedProductByBaseSku(baseSku)
  if (!product) {
    notFound()
  }

  const primaryColorSlug = getPrimaryColorSlug(product)
  if (!primaryColorSlug) {
    notFound()
  }

  // Awaited after the lookups above so a 404 still costs nothing extra, and so
  // the three notFound() paths are reached on exactly the conditions they were
  // before.
  const querySuffix = buildQuerySuffix(await searchParams)

  redirect(`/${lng}/product/${baseSku}/${primaryColorSlug}${querySuffix}`)
}
