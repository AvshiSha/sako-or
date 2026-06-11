'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { blogService, BlogArticle } from '@/lib/firebase'
import ProtectedRoute from '@/app/components/ProtectedRoute'
import {
  ArrowLeftIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
} from '@heroicons/react/24/outline'

function BlogListPage() {
  const [articles, setArticles] = useState<BlogArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'draft' | 'published'>('all')

  useEffect(() => {
    fetchArticles()
  }, [])

  const fetchArticles = async () => {
    try {
      setLoading(true)
      const data = await blogService.getAllArticles()
      setArticles(data)
    } catch (error) {
      console.error('Error loading articles:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}"?`)) return
    try {
      await blogService.deleteArticle(id)
      setArticles((prev) => prev.filter((a) => a.id !== id))
    } catch {
      alert('Failed to delete article')
    }
  }

  const filtered = articles.filter((a) => filter === 'all' || a.status === filter)

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

        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Blog Articles</h1>
          <Link
            href="/admin/blog/new"
            className="inline-flex items-center rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            <PlusIcon className="mr-2 h-4 w-4" />
            New Article
          </Link>
        </div>

        <div className="flex gap-2 mb-6">
          {(['all', 'published', 'draft'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1 text-sm capitalize ${
                filter === f
                  ? 'bg-black text-white'
                  : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-gray-500">Loading articles…</p>
        ) : filtered.length === 0 ? (
          <p className="text-gray-500">No articles found.</p>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Title
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Published
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filtered.map((article) => {
                  const title = article.title.en || article.title.he || article.slug
                  return (
                    <tr key={article.id}>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900">{title}</div>
                        <div className="text-xs text-gray-500">/news/{article.slug}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            article.status === 'published'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {article.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {article.publishedAt
                          ? new Date(article.publishedAt).toLocaleDateString()
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/admin/blog/${article.id}/edit`}
                            className="text-gray-600 hover:text-black"
                          >
                            <PencilIcon className="h-4 w-4" />
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleDelete(article.id, title)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
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
      <BlogListPage />
    </ProtectedRoute>
  )
}
