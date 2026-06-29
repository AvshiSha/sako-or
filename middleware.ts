import { NextRequest, NextResponse } from 'next/server'
import { languages } from './i18n/settings'

const PUBLIC_FILE = /\.(?:json|xml|txt|png|jpe?g|svg|ico|webmanifest)$/i

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

  // Check if this is an old slug-based product URL
  const slugProductMatch = pathname.match(/^\/(en|he)\/product\/([^\/\?]+)(\?.*)?$/)

  if (slugProductMatch) {
    // For now, we'll let the product page handle the redirect
    // This middleware can be enhanced later with a slug-to-SKU mapping
    // or by calling an API route that can access Firebase

    // Continue to the product page which will handle the redirect
    return NextResponse.next()
  }

  const segments = pathname.split('/').filter(Boolean)
  const firstSegment = segments[0]

  // If the path already starts with a supported language, just continue
  if (firstSegment && languages.includes(firstSegment as any)) {
    return NextResponse.next()
  }

  // For now, do not perform any language-based rewriting.
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
