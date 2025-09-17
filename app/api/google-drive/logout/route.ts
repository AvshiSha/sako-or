import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    // Clear the Google Drive tokens from cookies
    const response = NextResponse.json({ success: true })
    
    // Clear the cookies
    response.cookies.set('google_drive_access_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0 // Expire immediately
    })
    
    response.cookies.set('google_drive_refresh_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0 // Expire immediately
    })
    
    return response
  } catch (error) {
    console.error('Error logging out from Google Drive:', error)
    return NextResponse.json(
      { error: 'Failed to logout from Google Drive' },
      { status: 500 }
    )
  }
}
