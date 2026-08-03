import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { googleDriveService } from '@/lib/google-drive'

export async function GET(request: NextRequest) {
  try {
    // Generate a per-flow anti-CSRF state token and bind it to this browser
    const state = randomBytes(32).toString('hex')
    const authUrl = googleDriveService.getAuthUrl(state)

    const response = NextResponse.json({ authUrl })
    response.cookies.set('google_drive_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
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
