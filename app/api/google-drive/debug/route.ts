import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // Check environment variables without exposing sensitive data
    const debugInfo = {
      nodeEnv: process.env.NODE_ENV,
      hasGoogleClientId: !!process.env.GOOGLE_CLIENT_ID,
      hasGoogleClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
      clientIdLength: process.env.GOOGLE_CLIENT_ID?.length || 0,
      clientSecretLength: process.env.GOOGLE_CLIENT_SECRET?.length || 0,
      clientIdPrefix: process.env.GOOGLE_CLIENT_ID?.substring(0, 10) + '...' || 'not set',
      redirectUri: process.env.NODE_ENV === 'production' 
        ? 'https://sako-or.vercel.app/api/google-drive/callback'
        : 'http://localhost:3000/api/google-drive/callback'
    }

    console.log('=== Google Drive Debug Info ===');
    console.log(debugInfo);

    return NextResponse.json({
      status: 'success',
      debug: debugInfo,
      message: 'Environment variables check completed'
    })
  } catch (error) {
    console.error('Debug endpoint error:', error)
    return NextResponse.json(
      { 
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
