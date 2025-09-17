import { NextRequest, NextResponse } from 'next/server'
import { googleDriveService } from '@/lib/google-drive'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')

    if (!code) {
      return NextResponse.json(
        { error: 'Authorization code not provided' },
        { status: 400 }
      )
    }

    // Exchange code for tokens
    const tokens = await googleDriveService.getTokens(code)
    
    // Store tokens in secure HTTP-only cookies
    const response = NextResponse.redirect(new URL('/admin/products/new?google_drive_auth=success', request.url))
    
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
      ? 'https://sako-or.vercel.app'
      : 'http://localhost:3000';
    
    const redirectUrl = new URL('/admin/products/new', baseUrl)
    redirectUrl.searchParams.set('google_drive_auth', 'error')
    
    return NextResponse.redirect(redirectUrl)
  }
}
