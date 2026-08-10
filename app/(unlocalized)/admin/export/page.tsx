'use client'

import ProtectedRoute from '@/app/components/ProtectedRoute'

export default function AdminExportPage() {
  const downloadHref = '/api/admin/export/meta-catalog'

  return (
    <ProtectedRoute requireAdmin={true}>
      <div className="min-h-screen bg-white px-6 py-10">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-2xl font-semibold mb-6 text-gray-900">Export Meta Catalog</h1>
          <p className="text-gray-600 mb-6">Download the latest catalog CSV for Meta with Hebrew-safe encoding.</p>
          <a
            href={downloadHref}
            className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            Download CSV
          </a>
        </div>
      </div>
    </ProtectedRoute>
  )
}


