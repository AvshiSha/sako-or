'use client'

import { useState } from 'react'
import ProtectedRoute from '@/app/components/ProtectedRoute'
import { useAuth } from '@/app/hooks/useAuth'

function filenameFrom(contentDisposition: string | null): string {
  const match = contentDisposition?.match(/filename="?([^"]+)"?/i)
  return match?.[1] ?? 'meta_catalog.csv'
}

export default function AdminExportPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // The route is guarded by requireAdmin, which reads the Firebase ID token from
  // the Authorization header. A plain <a href> navigation cannot send that header,
  // so the CSV has to be fetched and handed to the browser as a blob.
  const downloadCsv = async () => {
    try {
      setLoading(true)
      setError(null)
      const idToken = await user?.getIdToken()
      const response = await fetch('/api/admin/export/meta-catalog', {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      })

      if (!response.ok) {
        const text = await response.text()
        setError(text || `Export failed (${response.status})`)
        return
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filenameFrom(response.headers.get('content-disposition'))
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Error exporting meta catalog:', err)
      setError('Failed to download the catalog CSV')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ProtectedRoute requireAdmin={true}>
      <div className="min-h-screen bg-white px-6 py-10">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-2xl font-semibold mb-6 text-gray-900">Export Meta Catalog</h1>
          <p className="text-gray-600 mb-6">Download the latest catalog CSV for Meta with Hebrew-safe encoding.</p>

          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <button
            onClick={downloadCsv}
            disabled={loading || !user}
            className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Preparing CSV...' : 'Download CSV'}
          </button>
        </div>
      </div>
    </ProtectedRoute>
  )
}
