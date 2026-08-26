'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeftIcon,
  ArrowsUpDownIcon,
  Cog6ToothIcon,
  EyeIcon,
  EyeSlashIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/24/outline'
import { faqService, type FaqItem } from '@/lib/firebase'
import { useAuth } from '@/app/contexts/AuthContext'
import { adminTheme } from '@/app/(unlocalized)/admin/_components/adminTheme'
import { cmsHtmlToPlainText } from '@/lib/cms-html-cleanup'
import { deleteFaq, setFaqStatus } from '@/lib/admin/faq-client'
import { faqMatchesSearch } from '@/lib/faq-selectors'
import { groupFaqsByAudience } from '@/lib/faq-order'
import {
  FAQ_AUDIENCES,
  FAQ_AUDIENCE_LABELS,
  FAQ_STATUSES,
  FAQ_STATUS_LABELS,
  FAQ_TOPICS,
  FAQ_TOPIC_LABELS,
  type FaqAudience,
  type FaqStatus,
  type FaqTopic,
} from '@/lib/faq-types'
import FaqDeleteConfirmModal from './_components/FaqDeleteConfirmModal'
import FaqReorderBoard from './_components/FaqReorderBoard'

function statusBadgeClass(status: FaqStatus): string {
  if (status === 'published') return adminTheme.badgeActive
  if (status === 'hidden') return adminTheme.badgeNew
  return adminTheme.badgeInactive
}

function formatDate(value?: string): string {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString()
}

export default function AdminFaqListPage() {
  const { user } = useAuth()

  const [items, setItems] = useState<FaqItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [audienceFilter, setAudienceFilter] = useState<FaqAudience | 'all'>('all')
  const [topicFilter, setTopicFilter] = useState<FaqTopic | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<FaqStatus | 'all'>('all')

  const [reorderOpen, setReorderOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<FaqItem | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const fetchItems = useCallback(async () => {
    try {
      setLoadError(null)
      const data = await faqService.getAllFaqs()
      setItems(data)
    } catch (error) {
      console.error('Error loading FAQs:', error)
      setLoadError('Could not load the FAQ list. Check that you are signed in as an admin.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  // Plain text of each answer, so the search box also matches answer wording —
  // computed once per list rather than per keystroke.
  const searchable = useMemo(
    () =>
      items.map((item) => ({
        item,
        plainAnswer: `${cmsHtmlToPlainText(item.answerHtml?.he ?? '')} ${cmsHtmlToPlainText(
          item.answerHtml?.en ?? ''
        )}`,
      })),
    [items]
  )

  const filtered = useMemo(
    () =>
      searchable
        .filter(({ item, plainAnswer }) => {
          if (audienceFilter !== 'all' && item.audience !== audienceFilter) return false
          if (topicFilter !== 'all' && item.topic !== topicFilter) return false
          if (statusFilter !== 'all' && item.status !== statusFilter) return false
          return faqMatchesSearch({ ...item, plainAnswer }, search)
        })
        .map(({ item }) => item),
    [searchable, audienceFilter, topicFilter, statusFilter, search]
  )

  const grouped = useMemo(() => groupFaqsByAudience(filtered), [filtered])

  const counts = useMemo(
    () => ({
      total: items.length,
      published: items.filter((i) => i.status === 'published').length,
      draft: items.filter((i) => i.status === 'draft').length,
      hidden: items.filter((i) => i.status === 'hidden').length,
    }),
    [items]
  )

  const handleStatusChange = async (item: FaqItem, status: FaqStatus) => {
    if (!user) return
    setBusyId(item.id)
    setNotice(null)

    const result = await setFaqStatus(user, item.id, status)
    if (!result.ok) {
      setNotice({ type: 'error', message: result.error })
    } else {
      setNotice({
        type: 'success',
        message:
          status === 'published'
            ? 'Published. It is on the public page now.'
            : status === 'hidden'
              ? 'Hidden. It is off the public page and out of the structured data.'
              : 'Moved back to draft.',
      })
      await fetchItems()
    }
    setBusyId(null)
  }

  const handleDelete = async () => {
    if (!user || !pendingDelete) return
    setIsDeleting(true)

    const result = await deleteFaq(user, pendingDelete.id)
    if (!result.ok) {
      setNotice({ type: 'error', message: result.error })
    } else {
      setNotice({ type: 'success', message: `Deleted "${result.data.slug}".` })
      await fetchItems()
    }

    setIsDeleting(false)
    setPendingDelete(null)
  }

  return (
    <div className={adminTheme.pageBg}>
      <div className="mx-auto max-w-6xl px-4 py-8">
        <Link href="/admin" className="mb-6 inline-flex items-center text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeftIcon className="mr-2 h-4 w-4" />
          Back to Admin
        </Link>

        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className={adminTheme.title}>FAQ</h1>
            <p className={adminTheme.subtitle}>
              {counts.total} questions — {counts.published} published, {counts.draft} draft,{' '}
              {counts.hidden} hidden. Public at{' '}
              <a href="/he/faq" target="_blank" rel="noreferrer" className={adminTheme.link}>
                /he/faq
              </a>{' '}
              and{' '}
              <a href="/en/faq" target="_blank" rel="noreferrer" className={adminTheme.link}>
                /en/faq
              </a>
              .
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/faq/settings" className={adminTheme.buttonSecondary}>
              <Cog6ToothIcon className="mr-2 h-4 w-4" />
              Page settings
            </Link>
            <button
              type="button"
              onClick={() => setReorderOpen((open) => !open)}
              className={adminTheme.buttonSecondary}
            >
              <ArrowsUpDownIcon className="mr-2 h-4 w-4" />
              Reorder
            </button>
            <Link href="/admin/faq/new" className={adminTheme.buttonPrimary}>
              <PlusIcon className="mr-2 h-4 w-4" />
              Add question
            </Link>
          </div>
        </div>

        {notice && (
          <p
            role="status"
            className={`mb-4 rounded-md border p-3 text-sm ${
              notice.type === 'success'
                ? 'border-green-300 bg-green-50 text-green-800'
                : 'border-red-300 bg-red-50 text-red-700'
            }`}
          >
            {notice.message}
          </p>
        )}

        {counts.draft > 0 && (
          <p className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            {counts.draft} question{counts.draft === 1 ? '' : 's'} still in draft. The seeded
            shipping, returns, store and payment questions are placeholders — they need SAKO-OR&apos;s
            approved wording before they can be published.
          </p>
        )}

        {reorderOpen && (
          <div className="mb-6">
            <FaqReorderBoard
              items={items}
              onSaved={(message) => setNotice({ type: 'success', message })}
              onError={(message) => setNotice({ type: 'error', message })}
              onRefetch={fetchItems}
              onClose={() => setReorderOpen(false)}
            />
          </div>
        )}

        {/* Filters */}
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label htmlFor="faq-search" className="mb-1 block text-xs font-medium text-gray-600">
              Search
            </label>
            <input
              id="faq-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Question or answer text…"
              className={adminTheme.input}
            />
          </div>
          <div>
            <label htmlFor="faq-filter-audience" className="mb-1 block text-xs font-medium text-gray-600">
              Section
            </label>
            <select
              id="faq-filter-audience"
              value={audienceFilter}
              onChange={(event) => setAudienceFilter(event.target.value as FaqAudience | 'all')}
              className={adminTheme.select}
            >
              <option value="all">All sections</option>
              {FAQ_AUDIENCES.map((value) => (
                <option key={value} value={value}>
                  {FAQ_AUDIENCE_LABELS[value].en}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="faq-filter-topic" className="mb-1 block text-xs font-medium text-gray-600">
              Topic
            </label>
            <select
              id="faq-filter-topic"
              value={topicFilter}
              onChange={(event) => setTopicFilter(event.target.value as FaqTopic | 'all')}
              className={adminTheme.select}
            >
              <option value="all">All topics</option>
              {FAQ_TOPICS.map((value) => (
                <option key={value} value={value}>
                  {FAQ_TOPIC_LABELS[value].en}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="faq-filter-status" className="mb-1 block text-xs font-medium text-gray-600">
              Status
            </label>
            <select
              id="faq-filter-status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as FaqStatus | 'all')}
              className={adminTheme.select}
            >
              <option value="all">All statuses</option>
              {FAQ_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {FAQ_STATUS_LABELS[value].en}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <p className="text-gray-500">Loading questions…</p>
        ) : loadError ? (
          <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
            {loadError}
          </p>
        ) : items.length === 0 ? (
          <div className={`${adminTheme.card} p-8 text-center`}>
            <p className="text-gray-600">No questions yet.</p>
            <p className="mt-1 text-sm text-gray-500">
              Add one here, or run <code>npm run seed:faqs</code> to load the starter set.
            </p>
            <Link href="/admin/faq/new" className={`${adminTheme.buttonPrimary} mt-4`}>
              <PlusIcon className="mr-2 h-4 w-4" />
              Add question
            </Link>
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-gray-500">No questions match these filters.</p>
        ) : (
          <div className="space-y-8">
            {FAQ_AUDIENCES.filter((audience) => grouped[audience].length > 0).map((audience) => (
              <section key={audience}>
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[#856D55]">
                  {FAQ_AUDIENCE_LABELS[audience].en} ({grouped[audience].length})
                </h2>
                <div className={`${adminTheme.card} overflow-hidden`}>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className={adminTheme.tableHead}>
                        <tr>
                          <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500">#</th>
                          <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500">Question</th>
                          <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500">Topic</th>
                          <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
                          <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500">Updated</th>
                          <th className="px-3 py-3 text-right text-xs font-medium uppercase text-gray-500">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {grouped[audience].map((item) => (
                          <tr key={item.id} className={adminTheme.tableRowHover}>
                            <td className="px-3 py-3 text-sm tabular-nums text-gray-400">{item.order + 1}</td>
                            <td className="px-3 py-3">
                              <div className="max-w-md truncate text-sm text-gray-900">
                                {item.question?.he || item.question?.en || '(untitled)'}
                              </div>
                              <code className="text-xs text-gray-400">{item.slug}</code>
                            </td>
                            <td className="px-3 py-3 text-sm text-gray-600">
                              {FAQ_TOPIC_LABELS[item.topic]?.en ?? item.topic}
                            </td>
                            <td className="px-3 py-3">
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-xs ${statusBadgeClass(item.status)}`}
                              >
                                {FAQ_STATUS_LABELS[item.status]?.en ?? item.status}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-sm text-gray-500">
                              <div>{formatDate(item.updatedAt)}</div>
                              {item.updatedBy && (
                                <div className="max-w-[12rem] truncate text-xs text-gray-400">
                                  {item.updatedBy}
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex items-center justify-end gap-1">
                                <Link
                                  href={`/admin/faq/${item.id}/edit`}
                                  className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                                  aria-label={`Edit ${item.slug}`}
                                  title="Edit"
                                >
                                  <PencilIcon className="h-4 w-4" />
                                </Link>

                                {/* Deep-links straight to this question on the
                                    live page, so "preview" means the real thing. */}
                                <a
                                  href={`/he/faq#faq-question-${item.slug}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className={`rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900 ${
                                    item.status === 'published' ? '' : 'pointer-events-none opacity-30'
                                  }`}
                                  aria-label={`View ${item.slug} on the site`}
                                  title={
                                    item.status === 'published'
                                      ? 'View on the site'
                                      : 'Only published questions appear on the site'
                                  }
                                >
                                  <EyeIcon className="h-4 w-4" />
                                </a>

                                {item.status === 'published' ? (
                                  <button
                                    type="button"
                                    onClick={() => handleStatusChange(item, 'hidden')}
                                    disabled={busyId === item.id}
                                    className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-40"
                                    aria-label={`Hide ${item.slug}`}
                                    title="Hide from the public page"
                                  >
                                    <EyeSlashIcon className="h-4 w-4" />
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleStatusChange(item, 'published')}
                                    disabled={busyId === item.id}
                                    className="rounded px-2 py-1 text-xs font-medium text-[#856D55] hover:bg-[#E1DBD7]/60 disabled:opacity-40"
                                    title="Publish to the public page"
                                  >
                                    Publish
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => setPendingDelete(item)}
                                  className="rounded p-1.5 text-red-500 hover:bg-red-50 hover:text-red-700"
                                  aria-label={`Delete ${item.slug}`}
                                  title="Delete permanently"
                                >
                                  <TrashIcon className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      {pendingDelete && (
        <FaqDeleteConfirmModal
          question={pendingDelete.question?.he || pendingDelete.question?.en || pendingDelete.slug}
          slug={pendingDelete.slug}
          status={pendingDelete.status}
          isDeleting={isDeleting}
          onConfirm={handleDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  )
}
