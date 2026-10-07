import { NextRequest, NextResponse } from 'next/server'
import { languages } from './i18n/settings'

// webp/avif/gif were missing from this list while png/jpg/svg were on it, so a
// .webp in public/ was the one static image kind that still got locale-
// redirected. Harmless for a plain <img>, which follows the 308 - but the
// next/image optimizer fetches server-side, does not follow it, and answers
// "The requested resource isn't a valid image" with a 400. That is why the size
// guide's measurement-guide.webp had never rendered: its onError handler hid
// the container, so the failure was silent. avif is listed here too because
// next.config generates it, and gif for symmetry.
const PUBLIC_FILE = /\.(?:json|xml|txt|png|jpe?g|webp|avif|gif|svg|ico|webmanifest)$/i

// Default locale used when redirecting a request that has no language prefix
// at all (e.g. an old backlink, or a URL a crawler guessed). Matches the
// existing root `/` -> `/he` redirect in app/page.tsx.
const DEFAULT_LOCALE = 'he'

// Top-level routes that intentionally live OUTSIDE the [lng] structure and
// must keep working at their literal, unprefixed path: Cancel/Failed/Success
// are payment-gateway callback URLs hardcoded on the processor's side, so
// redirecting them would break checkout. `admin` is the internal admin panel
// (app/admin), which also lives outside [lng] and isn't meant to be indexed
// or localized at all. `preview` is the admin product-preview route
// (app/preview), which takes its own `lng` query param instead of a path
// segment and is noindexed in its own layouts. `review` is the post-delivery
// customer review page (app/review), which lives outside [lng] on purpose: it
// is reached from a signed one-off link and is deliberately chrome-free, so it
// must not inherit the [lng] layout's header and footer. It carries its own
// `lng` path segment (/review/he/order/...). They're marked noindex in
// their own layouts rather than redirected.
// Matched case-insensitively: the actual Next.js routes (app/Cancel etc.) are
// case-sensitive and would 404 on a differently-cased request regardless,
// but we still must not let a case variant slip past this guard and get
// redirected to a locale-prefixed URL, silently breaking the callback.
const UNLOCALIZED_ROUTES = new Set([
  'cancel',
  'failed',
  'success',
  'admin',
  'preview',
  'review',
])

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Bypass static file requests like /meta.json, /sitemap.xml, etc.
  if (PUBLIC_FILE.test(pathname)) {
    return NextResponse.next()
  }

  // Skip Next.js internals and API routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.startsWith('/assets') ||
    pathname.startsWith('/api')
  ) {
    return NextResponse.next()
  }

  // Skip socket.io requests - return 404 to prevent routing to [lng]
  if (pathname.startsWith('/socket.io')) {
    return new NextResponse('', { status: 404 })
  }

  const segments = pathname.split('/').filter(Boolean)
  const firstSegment = segments[0]

  // Enforce a canonical, always-localized URL structure: any path that isn't
  // already under a supported language prefix (and isn't one of the special
  // unprefixed utility routes above) permanently redirects to its localized
  // equivalent. Without this, unprefixed URLs (e.g. /collection/women/...)
  // 404 instead of consolidating onto the one canonical, indexable URL,
  // which is what let Google discover and keep re-crawling them.
  if (
    firstSegment &&
    !languages.includes(firstSegment as any) &&
    !UNLOCALIZED_ROUTES.has(firstSegment.toLowerCase())
  ) {
    const url = request.nextUrl.clone()
    url.pathname = `/${DEFAULT_LOCALE}${pathname}`
    return NextResponse.redirect(url, 308)
  }

  if (!firstSegment) {
    const url = request.nextUrl.clone()
    url.pathname = `/${DEFAULT_LOCALE}`
    return NextResponse.redirect(url, 308)
  }

  // Campaign slugs moved from `?slug=` into the path, so that the route's layout
  // can resolve the campaign - and therefore own the redirect for an unknown one -
  // above its loading boundary. Layouts get `params`, never `searchParams`, so the
  // query-string form could not be resolved there at all, which is why the route
  // had no loading state to begin with.
  //
  // Done here rather than in the page so the hop costs no Firestore read and no
  // render: the old URL is still live on the storefront, in the admin, and in
  // whatever links are already out there. The rest of the query string (filters,
  // sort, page) rides along untouched.
  const campaignSlugMatch = pathname.match(/^\/(en|he)\/collection\/campaign\/?$/)

  if (campaignSlugMatch) {
    const slug = request.nextUrl.searchParams.get('slug')?.trim()
    if (slug) {
      const url = request.nextUrl.clone()
      url.pathname = `/${campaignSlugMatch[1]}/collection/campaign/${encodeURIComponent(slug)}`
      url.searchParams.delete('slug')
      return NextResponse.redirect(url, 308)
    }
  }

  // Check if this is an old slug-based product URL
  const slugProductMatch = pathname.match(/^\/(en|he)\/product\/([^\/\?]+)(\?.*)?$/)

  if (slugProductMatch) {
    // For now, we'll let the product page handle the redirect
    // This middleware can be enhanced later with a slug-to-SKU mapping
    // or by calling an API route that can access Firebase

    // Continue to the product page which will handle the redirect
    return NextResponse.next()
  }

  // Path already has a supported language prefix (or is an excluded
  // unlocalized utility route) - continue as normal.
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - socket.io (socket.io requests)
     */
    '/((?!api|monitoring|_next/static|_next/image|favicon.ico|public|socket\\.io).*)',
  ],
}
