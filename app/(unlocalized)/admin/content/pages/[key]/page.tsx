'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import ProtectedRoute from '@/app/components/ProtectedRoute'
import StaticPageForm from '../../_components/StaticPageForm'
import { staticPageService, StaticPage } from '@/lib/firebase'
import { getStaticPageDefinition } from '@/lib/static-page-registry'

function EditStaticPage() {
  const params = useParams()
  const key = params?.key as string
  const definition = getStaticPageDefinition(key)
  const [page, setPage] = useState<StaticPage | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!definition) {
      setLoading(false)
      return
    }
    staticPageService
      .getStaticPage(definition.key)
      .then(setPage)
      .finally(() => setLoading(false))
  }, [definition])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading page…</p>
      </div>
    )
  }

  if (!definition) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Unknown page.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <StaticPageForm definition={definition} initialData={page} />
      </div>
    </div>
  )
}

export default function Page() {
  return (
    <ProtectedRoute>
      <EditStaticPage />
    </ProtectedRoute>
  )
}
