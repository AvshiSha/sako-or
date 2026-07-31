'use client'

import { useEffect, useState } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'

interface StaticPagePreviewModalProps {
  title: string
  content: string
  dir: 'ltr' | 'rtl'
  onClose: () => void
}

// Renders the current *unsaved* form state the way the public page will.
// Sanitization happens server-side via /api/admin/preview-static-page so the
// Node-only `sanitize-html` package never has to be bundled for the client.
export default function StaticPagePreviewModal({
  title,
  content,
  dir,
  onClose,
}: StaticPagePreviewModalProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [sanitized, setSanitized] = useState<{ title: string; content: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)

    fetch('/api/admin/preview-static-page', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content }),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Preview request failed')
        return res.json()
      })
      .then((data) => {
        if (!cancelled) setSanitized({ title: data.title || '', content: data.content || '' })
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 py-10"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-sm font-semibold text-gray-900">Preview (unsaved changes)</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close preview"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[75vh] overflow-y-auto px-6 py-8" dir={dir}>
          {loading && <p className="text-sm text-gray-500">Loading preview…</p>}
          {error && <p className="text-sm text-red-600">Failed to load preview.</p>}
          {sanitized && (
            <>
              <h1
                className="text-3xl font-light text-gray-900 mb-6"
                dangerouslySetInnerHTML={{ __html: sanitized.title || 'Untitled page' }}
              />
              {sanitized.content ? (
                <div
                  className="cms-content"
                  dangerouslySetInnerHTML={{ __html: sanitized.content }}
                />
              ) : (
                <p className="text-sm text-gray-500">No content yet.</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
