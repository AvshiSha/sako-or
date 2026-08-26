'use client'

import { useEffect, useState } from 'react'
import { XMarkIcon, ChevronDownIcon } from '@heroicons/react/24/outline'
import { useAuth } from '@/app/contexts/AuthContext'
import { previewFaqAnswer } from '@/lib/admin/faq-client'
import { adminTheme } from '@/app/(unlocalized)/admin/_components/adminTheme'

interface FaqPreviewModalProps {
  question: string
  answerHtml: string
  locale: 'he' | 'en'
  onClose: () => void
}

/**
 * Shows an unsaved answer exactly as it will be published.
 *
 * The content round-trips through /api/admin/faq/preview because sanitize-html
 * is Node-only — the same reason /api/admin/preview-static-page exists. That
 * also means the preview reflects what the sanitizer actually did, including
 * anything it stripped or demoted, rather than the raw editor HTML.
 *
 * The request sends the admin bearer token via previewFaqAnswer. Do not copy
 * StaticPagePreviewModal here: it omits the Authorization header and its
 * preview route, which calls requireAdmin, therefore 401s.
 */
export default function FaqPreviewModal({
  question,
  answerHtml,
  locale,
  onClose,
}: FaqPreviewModalProps) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ question: string; answerHtml: string; warnings: string[] } | null>(null)
  const [open, setOpen] = useState(true)

  const dir = locale === 'he' ? 'rtl' : 'ltr'

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!user) {
        setError('You must be signed in to preview.')
        setLoading(false)
        return
      }
      const result = await previewFaqAnswer(user, question, answerHtml)
      if (cancelled) return
      if (!result.ok) {
        setError(result.error)
      } else {
        setPreview(result.data)
      }
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [user, question, answerHtml])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="FAQ preview"
      onClick={onClose}
    >
      <div
        className="my-8 w-full max-w-3xl rounded-lg bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Preview — {locale === 'he' ? 'Hebrew' : 'English'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
            aria-label="Close preview"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-5">
          {loading && <p className="text-sm text-gray-500">Building preview…</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}

          {preview && (
            <>
              {preview.warnings.length > 0 && (
                <ul className="mb-4 space-y-1 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                  {preview.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              )}

              {/* The real public markup, at the real direction, so RTL problems
                  and the collapsed/expanded states are visible here. */}
              <div dir={dir} className="rounded-md border border-gray-200 bg-white px-4">
                <div className="faq-item" data-open={open ? 'true' : 'false'}>
                  <h2 className="faq-question-heading">
                    <button
                      type="button"
                      className="faq-trigger"
                      aria-expanded={open}
                      aria-controls="faq-preview-panel"
                      onClick={() => setOpen((value) => !value)}
                    >
                      <span className="faq-trigger-text">
                        {preview.question || <em className="text-gray-400">(no question text)</em>}
                      </span>
                      <ChevronDownIcon className="faq-chevron" aria-hidden="true" />
                    </button>
                  </h2>
                  <div id="faq-preview-panel" className="faq-panel" hidden={!open}>
                    <div className="faq-panel-inner">
                      <div
                        className="cms-content faq-answer leading-relaxed"
                        dir={dir}
                        dangerouslySetInnerHTML={{ __html: preview.answerHtml }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <p className="mt-3 text-xs text-gray-500">
                Click the question to check both the collapsed and expanded states.
              </p>
            </>
          )}
        </div>

        <div className="flex justify-end border-t border-gray-200 px-6 py-4">
          <button type="button" onClick={onClose} className={adminTheme.buttonSecondary}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
