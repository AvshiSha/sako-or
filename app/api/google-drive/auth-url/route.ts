import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession as requireAdmin } from '@/lib/server/auth'
import { randomBytes } from 'crypto'
import { googleDriveService } from '@/lib/google-drive'

export async function GET(request: NextRequest) {
  // Admin-only: this is the product-image picker, not a public integration.
  const auth = await requireAdmin(request)
  if (auth instanceof NextResponse) return auth

  try {
    // Generate a per-flow anti-CSRF state token and bind it to this browser
    const state = randomBytes(32).toString('hex')
    const authUrl = googleDriveService.getAuthUrl(state)

    const response = NextResponse.json({ authUrl })
    // Scoped to /api/google-drive and always Secure: this cookie is the ONLY
    // thing protecting the callback route, which cannot carry a bearer header
    // because it is a top-level navigation back from Google.
    response.cookies.set('google_drive_oauth_state', state, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/api/google-drive',
      maxAge: 60 * 10 // 10 minutes, only needs to survive the redirect round-trip
    })
    return response
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to generate authentication URL'
        
        return NextResponse.json(
          { 
            error: errorMessage,
            details: 'Please check your Google OAuth configuration and environment variables'
          },
          { status: 500 }
        )
  }
}
