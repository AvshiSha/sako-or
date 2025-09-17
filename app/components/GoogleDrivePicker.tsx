'use client'

import { useState, useEffect, useCallback } from 'react'
import { 
  CloudIcon, 
  FolderIcon, 
  PhotoIcon, 
  ChevronRightIcon,
  ChevronLeftIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  CheckIcon
} from '@heroicons/react/24/outline'
import Image from 'next/image'

// Component to handle thumbnail loading with multiple fallback methods
function ThumbnailImage({ file }: { file: GoogleDriveFile }) {
  const [currentMethod, setCurrentMethod] = useState(0)
  const [showPlaceholder, setShowPlaceholder] = useState(false)

  const thumbnailMethods = [
    `https://drive.google.com/thumbnail?id=${file.id}&sz=w200-h200`,
    `https://lh3.googleusercontent.com/d/${file.id}=w200-h200`,
    file.webViewLink ? file.webViewLink.replace('/view?usp=drivesdk', '/preview') : '',
    `https://drive.google.com/thumbnail?id=${file.id}&sz=w400-h400`
  ].filter(Boolean)

  const handleError = () => {
    console.log(`Thumbnail method ${currentMethod + 1} failed for:`, file.name)
    if (currentMethod < thumbnailMethods.length - 1) {
      setCurrentMethod(prev => prev + 1)
    } else {
      setShowPlaceholder(true)
    }
  }

  const handleLoad = () => {
    console.log(`Thumbnail method ${currentMethod + 1} succeeded for:`, file.name)
  }

  if (showPlaceholder) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
        <PhotoIcon className="h-8 w-8 text-gray-400" />
      </div>
    )
  }

  return (
    <Image
      src={thumbnailMethods[currentMethod]}
      alt={file.name}
      fill
      className="object-cover"
      onLoad={handleLoad}
      onError={handleError}
    />
  )
}

interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  webViewLink?: string;
  thumbnailLink?: string;
  parents?: string[];
}

interface GoogleDrivePickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFiles: (files: GoogleDriveFile[]) => void;
  multiple?: boolean;
  folderId?: string;
}

export default function GoogleDrivePicker({ 
  isOpen, 
  onClose, 
  onSelectFiles, 
  multiple = true,
  folderId 
}: GoogleDrivePickerProps) {
  const [files, setFiles] = useState<GoogleDriveFile[]>([])
  const [folders, setFolders] = useState<GoogleDriveFile[]>([])
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [currentFolderId, setCurrentFolderId] = useState<string | undefined>(folderId)
  const [currentPath, setCurrentPath] = useState<string[]>(['My Drive'])
  const [folderHistory, setFolderHistory] = useState<string[]>([]) // Track folder IDs for navigation
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  // Check authentication status
  useEffect(() => {
    checkAuthStatus()
  }, [])

  const checkAuthStatus = async () => {
    try {
      const response = await fetch('/api/google-drive/auth-status')
      const data = await response.json()
      setIsAuthenticated(data.authenticated)
    } catch (error) {
      console.error('Error checking auth status:', error)
    }
  }

  // Load files and folders
  const loadFiles = useCallback(async (folderId?: string) => {
    if (!isAuthenticated) return

    setLoading(true)
    setError(null)

    try {
      console.log('Google Drive Picker - Loading files for folderId:', folderId)
      
      const response = await fetch(`/api/google-drive/files?folderId=${folderId || ''}`)
      
      console.log('Google Drive Picker - Response status:', response.status)
      console.log('Google Drive Picker - Response headers:', Object.fromEntries(response.headers.entries()))
      
      // Check if response is HTML (error page)
      const contentType = response.headers.get('content-type')
      if (contentType && contentType.includes('text/html')) {
        const htmlText = await response.text()
        console.error('Google Drive Picker - Received HTML instead of JSON:', htmlText.substring(0, 200))
        throw new Error('Server returned HTML page instead of JSON. This usually indicates a server error.')
      }

      // Check if response is not ok
      if (!response.ok) {
        const errorText = await response.text()
        console.error('Google Drive Picker - API error response:', response.status, errorText)
        throw new Error(`API request failed with status ${response.status}`)
      }
      
      const data = await response.json()
      console.log('Google Drive Picker - Response data:', data)

      if (data.error) {
        throw new Error(data.error)
      }

      // Separate files and folders
      const mediaFiles = data.files.filter((file: GoogleDriveFile) => 
        file.mimeType.startsWith('image/') || file.mimeType.startsWith('video/')
      )
      const folderFiles = data.files.filter((file: GoogleDriveFile) => 
        file.mimeType === 'application/vnd.google-apps.folder'
      )

      console.log('Google Drive Picker - Found media files:', mediaFiles.length)
      console.log('Google Drive Picker - Found folders:', folderFiles.length)

      setFiles(mediaFiles)
      setFolders(folderFiles)
    } catch (error) {
      console.error('Error loading files:', error)
      setError(error instanceof Error ? error.message : 'Failed to load files')
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated])

  // Load files when component opens or folder changes
  useEffect(() => {
    if (isOpen && isAuthenticated) {
      loadFiles(currentFolderId)
    }
  }, [isOpen, isAuthenticated, currentFolderId, loadFiles])

  // Handle folder navigation
  const handleFolderClick = async (folder: GoogleDriveFile) => {
    setCurrentFolderId(folder.id)
    setCurrentPath(prev => [...prev, folder.name])
    setFolderHistory(prev => [...prev, currentFolderId || 'root'])
    setSelectedFiles(new Set())
  }

  // Handle back navigation
  const handleBack = async () => {
    if (currentPath.length <= 1) return

    const newPath = currentPath.slice(0, -1)
    setCurrentPath(newPath)

    // Get the previous folder ID from history
    const newHistory = folderHistory.slice(0, -1)
    setFolderHistory(newHistory)

    if (newPath.length === 1) {
      // Going back to root (My Drive)
      setCurrentFolderId(undefined)
    } else {
      // Go back to the previous folder
      const previousFolderId = newHistory[newHistory.length - 1]
      setCurrentFolderId(previousFolderId === 'root' ? undefined : previousFolderId)
    }
  }

  // Handle file selection
  const handleFileSelect = (fileId: string) => {
    if (multiple) {
      setSelectedFiles(prev => {
        const newSet = new Set(prev)
        if (newSet.has(fileId)) {
          newSet.delete(fileId)
        } else {
          newSet.add(fileId)
        }
        return newSet
      })
    } else {
      setSelectedFiles(new Set([fileId]))
    }
  }

  // Handle search
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadFiles(currentFolderId)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/google-drive/search?query=${encodeURIComponent(searchQuery)}&folderId=${currentFolderId || ''}`)
      const data = await response.json()

      if (data.error) {
        throw new Error(data.error)
      }

      const mediaFiles = data.files.filter((file: GoogleDriveFile) => 
        file.mimeType.startsWith('image/') || file.mimeType.startsWith('video/')
      )

      setFiles(mediaFiles)
      setFolders([]) // Clear folders when searching
    } catch (error) {
      console.error('Error searching files:', error)
      setError(error instanceof Error ? error.message : 'Failed to search files')
    } finally {
      setLoading(false)
    }
  }

  // Handle authentication
  const handleAuth = async () => {
    try {
      setError(null)
      const response = await fetch('/api/google-drive/auth-url')
      const data = await response.json()
      
      if (data.error) {
        throw new Error(data.error)
      }
      
      if (data.authUrl) {
        window.location.href = data.authUrl
      } else {
        throw new Error('No authentication URL received')
      }
    } catch (error) {
      console.error('Error getting auth URL:', error)
      setError(error instanceof Error ? error.message : 'Failed to start authentication')
    }
  }

  // Handle logout
  const handleLogout = async () => {
    try {
      const response = await fetch('/api/google-drive/logout', {
        method: 'POST'
      })
      
      if (response.ok) {
        setIsAuthenticated(false)
        setFiles([])
        setFolders([])
        setError(null)
      }
    } catch (error) {
      console.error('Error logging out:', error)
    }
  }

  // Handle file selection confirmation
  const handleConfirmSelection = () => {
    const selectedFilesList = files.filter(file => selectedFiles.has(file.id))
    onSelectFiles(selectedFilesList)
    onClose()
  }

  // Format file size
  const formatFileSize = (bytes?: string) => {
    if (!bytes) return ''
    const size = parseInt(bytes)
    if (size < 1024) return `${size} B`
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
    return `${(size / (1024 * 1024)).toFixed(1)} MB`
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <CloudIcon className="h-8 w-8 text-blue-500" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Import from Google Drive</h2>
              <p className="text-sm text-gray-500">Select images to import</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {isAuthenticated && (
              <button
                onClick={handleLogout}
                className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Logout
              </button>
            )}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Authentication */}
        {!isAuthenticated && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <CloudIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Connect to Google Drive</h3>
              <p className="text-gray-500 mb-6">You need to authenticate with Google Drive to access your files.</p>
              <button
                onClick={handleAuth}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                <CloudIcon className="h-4 w-4 mr-2" />
                Connect to Google Drive
              </button>
            </div>
          </div>
        )}

        {/* Main Content */}
        {isAuthenticated && (
          <>
            {/* Navigation */}
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center space-x-2 mb-4">
                <button
                  onClick={handleBack}
                  disabled={currentPath.length <= 1}
                  className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeftIcon className="h-5 w-5" />
                </button>
                <div className="flex items-center space-x-1 text-sm text-gray-600">
                  {currentPath.map((path, index) => (
                    <div key={index} className="flex items-center">
                      {index > 0 && <ChevronRightIcon className="h-4 w-4 mx-1" />}
                      <span>{path}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Search */}
              <div className="flex space-x-2">
                <div className="flex-1 relative">
                  <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="Search for images..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  onClick={handleSearch}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Search
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-4">
              {loading && (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              )}

              {error && (
                <div className="text-center py-8">
                  <div className="text-red-600 mb-2">{error}</div>
                  <button
                    onClick={() => loadFiles(currentFolderId)}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    Try Again
                  </button>
                </div>
              )}

              {!loading && !error && (
                <div className="space-y-4">
                  {/* Folders */}
                  {folders.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-2">Folders</h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        {folders.map((folder) => (
                          <button
                            key={folder.id}
                            onClick={() => handleFolderClick(folder)}
                            className="flex flex-col items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 text-left"
                          >
                            <FolderIcon className="h-8 w-8 text-blue-500 mb-2" />
                            <span className="text-xs text-gray-700 truncate w-full">{folder.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Images */}
                  {files.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-2">
                        Images ({files.length})
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        {files.map((file) => (
                          <div
                            key={file.id}
                            className={`relative group cursor-pointer border-2 rounded-lg overflow-hidden ${
                              selectedFiles.has(file.id)
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                            onClick={() => handleFileSelect(file.id)}
                          >
                            <div className="aspect-square relative">
                              {/* Try to show thumbnail for images */}
                              {file.mimeType.startsWith('image/') ? (
                                <ThumbnailImage file={file} />
                              ) : file.mimeType.startsWith('video/') ? (
                                <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                  </svg>
                                </div>
                              ) : (
                                <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                                  <PhotoIcon className="h-8 w-8 text-gray-400" />
                                </div>
                              )}
                              
                              {/* Selection indicator */}
                              {selectedFiles.has(file.id) && (
                                <div className="absolute top-2 right-2 bg-blue-500 text-white rounded-full p-1">
                                  <CheckIcon className="h-4 w-4" />
                                </div>
                              )}
                            </div>
                            
                            <div className="p-2">
                              <p className="text-xs text-gray-700 truncate" title={file.name}>
                                {file.name}
                              </p>
                              <div className="flex justify-between items-center">
                                <p className="text-xs text-gray-500">
                                  {formatFileSize(file.size)}
                                </p>
                                <span className={`text-xs px-1 py-0.5 rounded ${
                                  file.mimeType.startsWith('image/') 
                                    ? 'bg-green-100 text-green-800' 
                                    : file.mimeType.startsWith('video/')
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-gray-100 text-gray-800'
                                }`}>
                                  {file.mimeType.startsWith('image/') ? 'IMG' : 
                                   file.mimeType.startsWith('video/') ? 'VID' : 'FILE'}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {files.length === 0 && folders.length === 0 && !loading && (
                    <div className="text-center py-8">
                      <PhotoIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">No images found in this folder</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-500">
                {selectedFiles.size > 0 && `${selectedFiles.size} file(s) selected`}
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmSelection}
                  disabled={selectedFiles.size === 0}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Import Selected ({selectedFiles.size})
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
