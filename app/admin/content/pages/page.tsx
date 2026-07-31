'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import ProtectedRoute from '@/app/components/ProtectedRoute'
import { staticPageService, StaticPage } from '@/lib/firebase'
import { STATIC_PAGE_DEFINITIONS } from '@/lib/static-page-registry'
import { ArrowLeftIcon, PencilIcon } from '@heroicons/react/24/outline'

function ContentPagesHub() {
  const [pages, setPages] = useState<Record<string, StaticPage | null>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all(
      STATIC_PAGE_DEFINITIONS.map((definition) =>
        staticPageService.getStaticPage(definition.key).then((page) => [definition.key, page] as const)
      )
    )
      .then((entries) => setPages(Object.fromEntries(entries)))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <Link
          href="/admin"
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeftIcon className="mr-2 h-4 w-4" />
          Back to Admin
        </Link>

        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Content Management</h1>
          <p className="mt-1 text-sm text-gray-500">
            Static pages editable like a blog article — Terms & Conditions, and more to come.
          </p>
        </div>

        {loading ? (
          <p className="text-gray-500">Loading pages…</p>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Page
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Last Updated
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {STATIC_PAGE_DEFINITIONS.map((definition) => {
                  const page = pages[definition.key]
                  return (
                    <tr key={definition.key}>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900">{definition.adminLabel}</div>
                        <div className="text-xs text-gray-500">{definition.publicPath}</div>
                      </td>
                      <td className="px-4 py-3">
                        {page ? (
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                              page.status === 'published'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}
                          >
                            {page.status}
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                            not created yet
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {page?.updatedAt ? new Date(page.updatedAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/admin/content/pages/${definition.key}`}
                          className="text-gray-600 hover:text-black"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Page() {
  return (
    <ProtectedRoute>
      <ContentPagesHub />
    </ProtectedRoute>
  )
}
