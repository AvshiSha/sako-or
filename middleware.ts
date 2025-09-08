import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Check if this is an old slug-based product URL
  const slugProductMatch = pathname.match(/^\/(en|he)\/product\/([^\/\?]+)(\?.*)?$/)
  
  if (slugProductMatch) {
    const [, language, slug, queryString] = slugProductMatch
    
    // For now, we'll let the product page handle the redirect
    // This middleware can be enhanced later with a slug-to-SKU mapping
    // or by calling an API route that can access Firebase
    
    // Continue to the product page which will handle the redirect
    return NextResponse.next()
  }
  
  // Continue with the request if no redirect is needed
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
     */
    '/((?!api|_next/static|_next/image|favicon.ico|public).*)',
  ],
}
