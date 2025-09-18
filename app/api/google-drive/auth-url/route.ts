import { NextRequest, NextResponse } from 'next/server'
import { googleDriveService } from '@/lib/google-drive'

export async function GET(request: NextRequest) {
  try {
    // Log environment information for debugging
    console.log('=== Google Drive Auth URL Debug ===');
    console.log('NODE_ENV:', process.env.NODE_ENV);
    console.log('GOOGLE_CLIENT_ID exists:', !!process.env.GOOGLE_CLIENT_ID);
    console.log('GOOGLE_CLIENT_SECRET exists:', !!process.env.GOOGLE_CLIENT_SECRET);
    console.log('GOOGLE_CLIENT_ID length:', process.env.GOOGLE_CLIENT_ID?.length || 0);
    console.log('GOOGLE_CLIENT_SECRET length:', process.env.GOOGLE_CLIENT_SECRET?.length || 0);
    
    const authUrl = googleDriveService.getAuthUrl()
    
    console.log('Auth URL generated successfully');
    return NextResponse.json({ authUrl })
  } catch (error) {
    console.error('=== Google Drive Auth URL Error ===');
    console.error('Error details:', error);
    console.error('Error message:', error instanceof Error ? error.message : 'Unknown error');
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate authentication URL'
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: 'Please check your Google OAuth configuration and environment variables',
        debug: {
          hasClientId: !!process.env.GOOGLE_CLIENT_ID,
          hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
          nodeEnv: process.env.NODE_ENV
        }
      },
      { status: 500 }
    )
  }
}
