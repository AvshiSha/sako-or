import { NextRequest, NextResponse } from 'next/server'
import { googleDriveService } from '@/lib/google-drive'
import { ADMIN_SESSION_COOKIE } from '@/lib/admin-session'
import { verifyAdminSessionCookie } from '@/lib/server/admin-session'

export async function GET(request: NextRequest) {
  try {
    // This route cannot use requireAdmin: it is Google's OAuth redirect, a
    // top-level navigation with no Authorization header. The admin session
    // cookie IS sent here, because it is SameSite=Lax — which is the specific
    // reason the cookie is Lax rather than Strict.
    //
    // Redirect rather than 401: a bare JSON error is a dead end for someone
    // who has just been bounced back from Google in their address bar.
    const sessionCookie = request.cookies.get(ADMIN_SESSION_COOKIE)?.value
    const session = sessionCookie ? await verifyAdminSessionCookie(sessionCookie) : null
    if (!session) {
      return NextResponse.redirect(new URL('/admin/login?from=%2Fadmin%2Fproducts%2Fnew', request.url))
    }

    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const expectedState = request.cookies.get('google_drive_oauth_state')?.value

    if (!code) {
      return NextResponse.json(
        { error: 'Authorization code not provided' },
        { status: 400 }
      )
    }

    if (!state || !expectedState || state !== expectedState) {
      return NextResponse.json(
        { error: 'Invalid or missing state parameter' },
        { status: 400 }
      )
    }

    // Exchange code for tokens
    const tokens = await googleDriveService.getTokens(code)

    // Store tokens in secure HTTP-only cookies
    const response = NextResponse.redirect(new URL('/admin/products/new?google_drive_auth=success', request.url))
    response.cookies.set('google_drive_oauth_state', '', { path: '/api/google-drive', maxAge: 0 })

    // Set secure cookies for the tokens
    response.cookies.set('google_drive_access_token', tokens.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7 // 7 days
    })
    
    if (tokens.refresh_token) {
      response.cookies.set('google_drive_refresh_token', tokens.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30 // 30 days
      })
    }
    
    return response
  } catch (error) {
    console.error('Error in Google Drive callback:', error)
    
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? 'https://sako-or.com'
      : 'http://localhost:3000';
    
    const redirectUrl = new URL('/admin/products/new', baseUrl)
    redirectUrl.searchParams.set('google_drive_auth', 'error')

    const errorResponse = NextResponse.redirect(redirectUrl)
    errorResponse.cookies.set('google_drive_oauth_state', '', { path: '/api/google-drive', maxAge: 0 })
    return errorResponse
  }
}
