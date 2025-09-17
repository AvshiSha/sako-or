import { NextRequest, NextResponse } from 'next/server'
import { googleDriveService } from '@/lib/google-drive'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('query')
    const folderId = searchParams.get('folderId')

    if (!query) {
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400 }
      )
    }

    // Get tokens from cookies
    const accessToken = request.cookies.get('google_drive_access_token')?.value
    const refreshToken = request.cookies.get('google_drive_refresh_token')?.value

    if (!accessToken && !refreshToken) {
      return NextResponse.json(
        { error: 'Not authenticated with Google Drive' },
        { status: 401 }
      )
    }

    const tokens = {
      access_token: accessToken,
      refresh_token: refreshToken
    }

    googleDriveService.setCredentials(tokens)

    const files = await googleDriveService.searchFiles(
      query,
      folderId || undefined
    )

    return NextResponse.json({ files })
  } catch (error) {
    console.error('Error searching Google Drive files:', error)
    return NextResponse.json(
      { error: 'Failed to search files in Google Drive' },
      { status: 500 }
    )
  }
}
