import { NextRequest, NextResponse } from 'next/server'
import { googleDriveService } from '@/lib/google-drive'

export async function GET(request: NextRequest) {
  try {
    // Log environment information for debugging
        const authUrl = googleDriveService.getAuthUrl()
    return NextResponse.json({ authUrl })
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
