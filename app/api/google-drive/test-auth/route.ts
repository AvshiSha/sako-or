import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'

export async function GET(request: NextRequest) {
  try {
    console.log('=== Google OAuth Test ===');
    
    // Check environment variables
    const hasClientId = !!process.env.GOOGLE_CLIENT_ID;
    const hasClientSecret = !!process.env.GOOGLE_CLIENT_SECRET;
    
    console.log('Environment check:', { hasClientId, hasClientSecret });
    
    if (!hasClientId || !hasClientSecret) {
      return NextResponse.json({
        status: 'error',
        message: 'Missing environment variables',
        debug: {
          hasClientId,
          hasClientSecret,
          clientIdValue: process.env.GOOGLE_CLIENT_ID ? 'SET' : 'NOT SET',
          clientSecretValue: process.env.GOOGLE_CLIENT_SECRET ? 'SET' : 'NOT SET'
        }
      }, { status: 500 });
    }

    // Test OAuth client creation
    const redirectUri = process.env.NODE_ENV === 'production' 
      ? 'https://sako-or.vercel.app/api/google-drive/callback'
      : 'http://localhost:3000/api/google-drive/callback';

    console.log('Creating OAuth client with redirect URI:', redirectUri);

    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      redirectUri
    );

    console.log('OAuth client created successfully');

    // Test auth URL generation
    const authUrl = auth.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/drive.readonly',
        'https://www.googleapis.com/auth/drive.file'
      ],
      prompt: 'consent'
    });

    console.log('Auth URL generated successfully');

    return NextResponse.json({
      status: 'success',
      message: 'OAuth configuration is working correctly',
      debug: {
        hasClientId,
        hasClientSecret,
        redirectUri,
        authUrlGenerated: true,
        authUrlLength: authUrl.length
      },
      authUrl: authUrl
    });

  } catch (error) {
    console.error('=== OAuth Test Error ===');
    console.error('Error:', error);
    console.error('Error message:', error instanceof Error ? error.message : 'Unknown error');
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');

    return NextResponse.json({
      status: 'error',
      message: 'OAuth test failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      debug: {
        hasClientId: !!process.env.GOOGLE_CLIENT_ID,
        hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
        nodeEnv: process.env.NODE_ENV,
        errorType: error instanceof Error ? error.constructor.name : 'Unknown'
      }
    }, { status: 500 });
  }
}
