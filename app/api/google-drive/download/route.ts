import { NextRequest, NextResponse } from 'next/server'
import { googleDriveService } from '@/lib/google-drive'

export async function POST(request: NextRequest) {
  try {
    const { fileIds } = await request.json()

    if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
      return NextResponse.json(
        { error: 'File IDs are required' },
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

    // Download files and convert to base64 for easy handling
    const downloadedFiles = await Promise.all(
      fileIds.map(async (fileId: string) => {
        try {
          const fileData = await googleDriveService.getFile(fileId)
          const fileContent = await googleDriveService.downloadFile(fileId)
          
          return {
            id: fileId,
            name: fileData.name,
            mimeType: fileData.mimeType,
            content: fileContent.toString('base64'),
            size: fileContent.length
          }
        } catch (error) {
          console.error(`Error downloading file ${fileId}:`, error)
          return null
        }
      })
    )

    // Filter out failed downloads
    const successfulDownloads = downloadedFiles.filter(file => file !== null)

    return NextResponse.json({ 
      files: successfulDownloads,
      count: successfulDownloads.length
    })
  } catch (error) {
    console.error('Error downloading Google Drive files:', error)
    return NextResponse.json(
      { error: 'Failed to download files from Google Drive' },
      { status: 500 }
    )
  }
}
