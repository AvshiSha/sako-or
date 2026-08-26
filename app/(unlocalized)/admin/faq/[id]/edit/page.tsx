'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import { faqService, type FaqItem } from '@/lib/firebase'
import { adminTheme } from '@/app/(unlocalized)/admin/_components/adminTheme'
import FaqForm from '../../_components/FaqForm'

interface EditFaqPageProps {
  params: Promise<{ id: string }>
}

export default function EditFaqPage({ params }: EditFaqPageProps) {
  const { id } = use(params)

  const [item, setItem] = useState<FaqItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const data = await faqService.getFaqById(id)
        if (cancelled) return
        if (!data) {
          setError('That question no longer exists. It may have been deleted.')
        } else {
          setItem(data)
        }
      } catch (err) {
        console.error('Error loading FAQ:', err)
        if (!cancelled) setError('Could not load this question.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [id])

  return (
    <div className={adminTheme.pageBg}>
      <div className="mx-auto max-w-3xl px-4 py-8">
        {loading && <p className="text-gray-500">Loading question…</p>}

        {error && (
          <>
            <Link href="/admin/faq" className="mb-6 inline-flex items-center text-sm text-gray-600 hover:text-gray-900">
              <ArrowLeftIcon className="mr-2 h-4 w-4" />
              Back to FAQ
            </Link>
            <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          </>
        )}

        {/* Keyed on the record id so switching questions remounts the form with
            fresh state instead of carrying the previous answer over. */}
        {item && <FaqForm key={item.id} initial={item} />}
      </div>
    </div>
  )
}
