import { NextRequest, NextResponse } from 'next/server'
import { googleDriveService } from '@/lib/google-drive'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const folderId = searchParams.get('folderId')
    const pageToken = searchParams.get('pageToken')

    // Get tokens from cookies
    const accessToken = request.cookies.get('google_drive_access_token')?.value
    const refreshToken = request.cookies.get('google_drive_refresh_token')?.value

    console.log('Google Drive API - Access token present:', !!accessToken)
    console.log('Google Drive API - Refresh token present:', !!refreshToken)

    if (!accessToken && !refreshToken) {
      console.log('Google Drive API - No tokens found')
      return NextResponse.json(
        { error: 'Not authenticated with Google Drive' },
        { status: 401 }
      )
    }

    const tokens = {
      access_token: accessToken,
      refresh_token: refreshToken
    }

    console.log('Google Drive API - Setting credentials and calling listFiles')
    googleDriveService.setCredentials(tokens)

    const result = await googleDriveService.listFiles(
      folderId || undefined,
      pageToken || undefined
    )

    console.log('Google Drive API - Successfully fetched files:', result.files.length)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching Google Drive files:', error)
    
    // Log more details about the error
    if (error instanceof Error) {
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch files from Google Drive',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
