'use client'

import { useState } from 'react'
import { ArrowLeftIcon, ArrowPathIcon, ExclamationTriangleIcon, CheckCircleIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'
import ProtectedRoute from '@/app/components/ProtectedRoute'
import SuccessMessage from '@/app/components/SuccessMessage'

interface SyncStats {
  total: number
  synced: number
  created: number
  updated: number
  deleted: number
  errors: number
}

interface ComparisonData {
  firebase: {
    count: number
    emails: string[]
  }
  neon: {
    count: number
    emails: string[]
  }
  differences: {
    missingInNeon: string[]
    extraInNeon: string[]
    needsSync: boolean
  }
}

export default function SyncNewsletterPage() {
  const [loading, setLoading] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [comparisonData, setComparisonData] = useState<ComparisonData | null>(null)
  const [syncStats, setSyncStats] = useState<SyncStats | null>(null)
  const [errors, setErrors] = useState<string[]>([])

  const checkSyncStatus = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/newsletter/sync')
      const data = await response.json()
      
      if (data.success) {
        setComparisonData(data.comparison)
        setErrors([])
      } else {
        setErrors([data.error || 'Failed to check sync status'])
      }
    } catch (error) {
      console.error('Error checking sync status:', error)
      setErrors(['Failed to check sync status'])
    } finally {
      setLoading(false)
    }
  }

  const syncNewsletter = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/newsletter/sync', {
        method: 'POST'
      })
      const data = await response.json()
      
      if (data.success) {
        setSyncStats(data.stats)
        setErrors(data.errors || [])
        setSuccessMessage(data.message)
        setShowSuccess(true)
        
        // Refresh comparison data
        await checkSyncStatus()
        
        setTimeout(() => setShowSuccess(false), 5000)
      } else {
        setErrors([data.error || 'Failed to sync newsletter emails'])
      }
    } catch (error) {
      console.error('Error syncing newsletter emails:', error)
      setErrors(['Failed to sync newsletter emails'])
    } finally {
      setLoading(false)
    }
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50 pt-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center">
              <Link
                href="/admin"
                className="flex items-center text-gray-600 hover:text-gray-900 mr-4"
              >
                <ArrowLeftIcon className="h-5 w-5 mr-2" />
                Back to Admin
              </Link>
              <h1 className="text-3xl font-bold text-gray-900">Sync Newsletter</h1>
            </div>
            <p className="text-gray-600 mt-2">Synchronize newsletter emails between Firebase and Neon DB</p>
          </div>

          {showSuccess && (
            <SuccessMessage 
              message={successMessage} 
              onClose={() => setShowSuccess(false)} 
            />
          )}

          {/* Error Messages */}
          {errors.length > 0 && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start">
                <ExclamationTriangleIcon className="h-5 w-5 text-red-600 mt-0.5 mr-3" />
                <div>
                  <h3 className="text-sm font-medium text-red-800">Errors occurred:</h3>
                  <ul className="mt-2 text-sm text-red-700 list-disc list-inside">
                    {errors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Sync Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
            <div className="flex items-start">
              <ArrowPathIcon className="h-6 w-6 text-blue-600 mt-0.5 mr-3" />
              <div>
                <h3 className="text-lg font-medium text-blue-800 mb-2">
                  Newsletter Email Synchronization
                </h3>
                <p className="text-blue-700 mb-4">
                  Your application uses two databases for newsletter emails:
                </p>
                <ul className="list-disc list-inside text-blue-700 space-y-1 mb-4">
                  <li><strong>Firebase:</strong> Primary database for newsletter emails (used by the website)</li>
                  <li><strong>Neon DB (PostgreSQL):</strong> Connected via Prisma (used for some operations)</li>
                </ul>
                <p className="text-blue-700 font-medium">
                  This tool helps keep both databases in sync.
                </p>
              </div>
            </div>
          </div>

          {/* Sync Controls */}
          <div className="bg-white shadow rounded-lg p-6">
            <div className="mb-6">
              <h2 className="text-lg font-medium text-gray-900 mb-2">
                Synchronization Steps
              </h2>
              <p className="text-gray-600">
                Follow these steps to synchronize your newsletter emails:
              </p>
            </div>

            <div className="space-y-4">
              {/* Step 1: Check Status */}
              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div>
                  <h3 className="font-medium text-gray-900">Step 1: Check Sync Status</h3>
                  <p className="text-sm text-gray-600">Compare newsletter emails between Firebase and Neon DB</p>
                </div>
                <button
                  onClick={checkSyncStatus}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Checking...' : 'Check Status'}
                </button>
              </div>

              {/* Step 2: Sync Newsletter */}
              {comparisonData && (
                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div>
                    <h3 className="font-medium text-gray-900">Step 2: Sync Newsletter</h3>
                    <p className="text-sm text-gray-600">
                      {comparisonData.differences.needsSync 
                        ? `Found ${comparisonData.differences.missingInNeon.length} emails to sync`
                        : 'Newsletter emails are already in sync'
                      }
                    </p>
                  </div>
                  <button
                    onClick={syncNewsletter}
                    disabled={loading}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Syncing...' : 'Sync Newsletter'}
                  </button>
                </div>
              )}
            </div>

            {/* Comparison Results */}
            {comparisonData && (
              <div className="mt-8 border border-gray-200 rounded-lg">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                  <h3 className="font-medium text-gray-900">Sync Status</h3>
                </div>
                <div className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Firebase</h4>
                      <p className="text-sm text-gray-600 mb-2">
                        {comparisonData.firebase.count} emails
                      </p>
                      <div className="max-h-32 overflow-y-auto">
                        {comparisonData.firebase.emails.map((email, index) => (
                          <div key={index} className="text-sm text-gray-700 py-1">
                            • {email}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Neon DB</h4>
                      <p className="text-sm text-gray-600 mb-2">
                        {comparisonData.neon.count} emails
                      </p>
                      <div className="max-h-32 overflow-y-auto">
                        {comparisonData.neon.emails.map((email, index) => (
                          <div key={index} className="text-sm text-gray-700 py-1">
                            • {email}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  {comparisonData.differences.missingInNeon.length > 0 && (
                    <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <h4 className="font-medium text-yellow-800 mb-2">Missing in Neon DB:</h4>
                      <div className="text-sm text-yellow-700">
                        {comparisonData.differences.missingInNeon.map((email, index) => (
                          <div key={index}>• {email}</div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {comparisonData.differences.extraInNeon.length > 0 && (
                    <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                      <h4 className="font-medium text-orange-800 mb-2">Extra in Neon DB:</h4>
                      <div className="text-sm text-orange-700">
                        {comparisonData.differences.extraInNeon.map((email, index) => (
                          <div key={index}>• {email}</div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {!comparisonData.differences.needsSync && (
                    <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center">
                        <CheckCircleIcon className="h-5 w-5 text-green-600 mr-2" />
                        <span className="text-sm font-medium text-green-800">
                          Newsletter emails are in sync!
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Sync Results */}
            {syncStats && (
              <div className="mt-8 border border-gray-200 rounded-lg">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                  <h3 className="font-medium text-gray-900">Sync Results</h3>
                </div>
                <div className="p-4">
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900">{syncStats.total}</div>
                      <div className="text-sm text-gray-600">Total</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{syncStats.created}</div>
                      <div className="text-sm text-gray-600">Created</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{syncStats.updated}</div>
                      <div className="text-sm text-gray-600">Updated</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600">{syncStats.deleted}</div>
                      <div className="text-sm text-gray-600">Deleted</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">{syncStats.errors}</div>
                      <div className="text-sm text-gray-600">Errors</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}
