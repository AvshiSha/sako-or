'use client'

import ProtectedRoute from '@/app/components/ProtectedRoute'
import BlogArticleForm from '../_components/BlogArticleForm'

function NewBlogPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <BlogArticleForm />
      </div>
    </div>
  )
}

export default function Page() {
  return (
    <ProtectedRoute>
      <NewBlogPage />
    </ProtectedRoute>
  )
}
