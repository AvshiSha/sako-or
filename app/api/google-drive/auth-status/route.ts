import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // Check if user has valid Google Drive tokens
    const accessToken = request.cookies.get('google_drive_access_token')
    const refreshToken = request.cookies.get('google_drive_refresh_token')
    
    return NextResponse.json({ 
      authenticated: !!(accessToken || refreshToken)
    })
  } catch (error) {
    console.error('Error checking auth status:', error)
    return NextResponse.json(
      { error: 'Failed to check authentication status' },
      { status: 500 }
    )
  }
}
