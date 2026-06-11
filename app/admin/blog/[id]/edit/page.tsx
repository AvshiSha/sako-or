'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import ProtectedRoute from '@/app/components/ProtectedRoute'
import BlogArticleForm from '../../_components/BlogArticleForm'
import { blogService, BlogArticle } from '@/lib/firebase'

function EditBlogPage() {
  const params = useParams()
  const id = params?.id as string
  const [article, setArticle] = useState<BlogArticle | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    blogService
      .getArticleById(id)
      .then(setArticle)
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading article…</p>
      </div>
    )
  }

  if (!article) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Article not found.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <BlogArticleForm initialData={article} isEdit />
      </div>
    </div>
  )
}

export default function Page() {
  return (
    <ProtectedRoute>
      <EditBlogPage />
    </ProtectedRoute>
  )
}
