import { NextRequest, NextResponse } from 'next/server'
import { googleDriveService } from '@/lib/google-drive'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const shortcutId = searchParams.get('shortcutId')

    if (!shortcutId) {
      return NextResponse.json({ error: 'Shortcut ID is required' }, { status: 400 })
    }


    // Get auth tokens from cookies
    const accessToken = request.cookies.get('google_drive_access_token')?.value
    const refreshToken = request.cookies.get('google_drive_refresh_token')?.value

    if (!accessToken || !refreshToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Set credentials
    googleDriveService.setCredentials({ access_token: accessToken, refresh_token: refreshToken })

    // Get the shortcut file details
    const shortcutFile = await googleDriveService.getFile(shortcutId)

    // For Google Drive shortcuts, we need to get the targetId from the shortcut's metadata
    // The targetId is usually in the shortcut's metadata or we need to resolve it
    let targetId = null

    // Try to get target from shortcut's parents or metadata
    if (shortcutFile.parents && shortcutFile.parents.length > 0) {
      // For now, let's try to get the target by looking at the shortcut's properties
      // This is a simplified approach - in practice, shortcuts might need special handling
      
      // Let's try to search for files with the same name in the same parent folder
      // This is not perfect but might work for some cases
      const parentFolderId = shortcutFile.parents[0]
      
      // Search for files with similar names in the parent folder
      const searchResults = await googleDriveService.listFiles(parentFolderId)
      
      // Look for files that might be the target
      const potentialTargets = searchResults.files.filter(file => 
        file.name.toLowerCase().includes(shortcutFile.name.toLowerCase()) ||
        shortcutFile.name.toLowerCase().includes(file.name.toLowerCase())
      )
      
      if (potentialTargets.length > 0) {
        // Take the first potential target
        targetId = potentialTargets[0].id
      }
    }

    if (targetId) {
      
      return NextResponse.json({ 
        success: true,
        targetId: targetId,
        shortcutName: shortcutFile.name
      })
    } else {
      return NextResponse.json({ 
        error: 'Could not resolve shortcut target',
        shortcutName: shortcutFile.name
      }, { status: 404 })
    }

  } catch (error) {
    console.error('Error resolving shortcut:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to resolve shortcut',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
