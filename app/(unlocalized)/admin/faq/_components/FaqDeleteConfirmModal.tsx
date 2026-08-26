'use client'

import { useEffect, useRef, useState } from 'react'
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { adminTheme } from '@/app/(unlocalized)/admin/_components/adminTheme'
import type { FaqStatus } from '@/lib/faq-types'

interface FaqDeleteConfirmModalProps {
  question: string
  slug: string
  status: FaqStatus
  isDeleting: boolean
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Deletion is permanent and, for a published question, breaks every inbound
 * #faq-question-{slug} link — from the footer, from llms.txt, from anything a
 * customer bookmarked. Hence a dialog that names the slug rather than a
 * window.confirm(), and a typed confirmation when the question is live.
 *
 * Hand-rolled overlay because this codebase has no shared Dialog primitive; the
 * structure follows StaticPagePreviewModal.
 */
export default function FaqDeleteConfirmModal({
  question,
  slug,
  status,
  isDeleting,
  onConfirm,
  onCancel,
}: FaqDeleteConfirmModalProps) {
  const [typed, setTyped] = useState('')
  const cancelRef = useRef<HTMLButtonElement>(null)

  const requiresTyping = status === 'published'
  const canConfirm = !isDeleting && (!requiresTyping || typed.trim() === slug)

  useEffect(() => {
    // Focus lands on Cancel, not Delete: the safe action should be the one a
    // stray Enter triggers.
    cancelRef.current?.focus()
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isDeleting) onCancel()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isDeleting, onCancel])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="faq-delete-title"
      onClick={() => !isDeleting && onCancel()}
    >
      <div
        className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <ExclamationTriangleIcon className="h-6 w-6 flex-shrink-0 text-red-600" aria-hidden="true" />
          <div className="min-w-0">
            <h2 id="faq-delete-title" className="text-lg font-semibold text-gray-900">
              Delete this question?
            </h2>
            <p className="mt-2 break-words text-sm text-gray-600">{question}</p>
          </div>
        </div>

        <div className="mt-4 rounded-md bg-gray-50 p-3 text-sm text-gray-600">
          <p>
            This is permanent. To take the question off the public page without losing it, hide
            it instead.
          </p>
          {requiresTyping && (
            <p className="mt-2">
              This question is <strong>published</strong>. Any existing link to{' '}
              <code className="break-all">#faq-question-{slug}</code> will stop working.
            </p>
          )}
        </div>

        {requiresTyping && (
          <div className="mt-4">
            <label htmlFor="faq-delete-confirm" className="block text-sm font-medium text-gray-700">
              Type <code>{slug}</code> to confirm
            </label>
            <input
              id="faq-delete-confirm"
              type="text"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
              className={`mt-1 ${adminTheme.input}`}
            />
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className={adminTheme.buttonSecondary}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!canConfirm}
            className="inline-flex items-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isDeleting ? 'Deleting…' : 'Delete permanently'}
          </button>
        </div>
      </div>
    </div>
  )
}
