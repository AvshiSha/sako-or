import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    console.log('Google Drive Test API - Request received')
    
    // Get tokens from cookies
    const accessToken = request.cookies.get('google_drive_access_token')?.value
    const refreshToken = request.cookies.get('google_drive_refresh_token')?.value

    return NextResponse.json({
      success: true,
      message: 'Google Drive API is working',
      hasAccessToken: !!accessToken,
      hasRefreshToken: !!refreshToken,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Google Drive Test API - Error:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Test API failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
