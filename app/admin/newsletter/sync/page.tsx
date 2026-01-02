'use client'

import Link from 'next/link'
import ProtectedRoute from '@/app/components/ProtectedRoute'

export default function SyncNewsletterPage() {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50 pt-20">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <div className="mb-6">
            <Link
              href="/admin"
              className="flex items-center text-gray-600 hover:text-gray-900"
            >
              ← Back to Admin
            </Link>
          </div>

          <h1 className="text-3xl font-bold text-gray-900">Sync Newsletter</h1>

          <div className="mt-4 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
            <p className="text-yellow-900 font-medium">This tool is disabled.</p>
            <p className="text-yellow-800 mt-1">
              Newsletter subscriptions are stored only in <strong>Neon</strong> (source of truth).
              Firebase is no longer used for newsletter subscription data.
            </p>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}