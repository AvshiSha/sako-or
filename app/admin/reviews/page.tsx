'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeftIcon, StarIcon } from '@heroicons/react/24/outline'
import { StarIcon as StarSolid } from '@heroicons/react/24/solid'
import { useAuth } from '@/app/contexts/AuthContext'
import { getAdminAuthHeaders } from '@/lib/admin-api'
import { getColorName } from '@/lib/colors'
import { adminTheme } from '../_components/adminTheme'

/**
 * Customer reviews console.
 *
 * The primary job here is not moderation — it is the manual loyalty-points
 * follow-up. Points for reviewing are credited by hand in Verifone, so without a
 * record of who has been paid there is no way to avoid missing someone or paying
 * them twice. "Awaiting points" is therefore the default view.
 */

type Filter = 'awaiting_points' | 'all' | 'awarded' | 'unpublished'

interface Product {
  id: string
  productSku: string
  productName: string
  size: string | null
  colorName: string | null
  primaryImage: string | null
  rating: number
  body: string | null
  sizingFit: string | null
  isPublished: boolean
}

interface Review {
  id: string
  orderNumber: string
  submittedAt: string
  language: string
  customerName: string | null
  customerEmail: string | null
  customerPhone: string | null
  currentPointsBalance: string | null
  isClubMember: boolean
  joinedAfterOrder: boolean
  overallRating: number
  serviceRating: number | null
  deliveryRating: number | null
  packagingRating: number | null
  serviceComment: string | null
  deliveryComment: string | null
  packagingComment: string | null
  pointsAwardedAt: string | null
  pointsBefore: string | null
  pointsAfter: string | null
  pointsAwardedBy: string | null
  notifiedAt: string | null
  notifyResult: { ok?: boolean; skipped?: boolean; reason?: string; error?: string } | null
  products: Product[]
}

interface Counts {
  all: number
  awaitingPoints: number
  awarded: number
  unpublished: number
}

const SIZING_LABEL: Record<string, string> = {
  runs_small: 'Runs small',
  true_to_size: 'True to size',
  runs_large: 'Runs large',
}

export default function AdminReviewsPage() {
  const { user } = useAuth()
  const [filter, setFilter] = useState<Filter>('awaiting_points')
  const [reviews, setReviews] = useState<Review[]>([])
  const [counts, setCounts] = useState<Counts>({
    all: 0,
    awaitingPoints: 0,
    awarded: 0,
    unpublished: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      const headers = await getAdminAuthHeaders(user)
      const response = await fetch(`/api/admin/reviews?filter=${filter}&limit=50`, { headers })
      const data = await response.json()
      if (!data.success) throw new Error(data.error ?? 'Failed to load')
      setReviews(data.reviews)
      setCounts(data.counts)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load reviews')
    } finally {
      setLoading(false)
    }
  }, [user, filter])

  useEffect(() => {
    void load()
  }, [load])

  const tabs: { key: Filter; label: string; count: number }[] = [
    { key: 'awaiting_points', label: 'Awaiting points', count: counts.awaitingPoints },
    { key: 'awarded', label: 'Points given', count: counts.awarded },
    { key: 'unpublished', label: 'Unpublished', count: counts.unpublished },
    { key: 'all', label: 'All', count: counts.all },
  ]

  return (
    <>
      <div className={`${adminTheme.card} border-0 rounded-none shadow-sm`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link href="/admin" className={`${adminTheme.link} inline-flex items-center gap-1 text-sm mb-2`}>
            <ArrowLeftIcon className="h-4 w-4" />
            Back to dashboard
          </Link>
          <h1 className={adminTheme.title}>Customer Reviews</h1>
          <p className={adminTheme.subtitle}>
            Review feedback, record manually-added loyalty points, and notify the customer.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-wrap gap-2 mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={filter === tab.key ? adminTheme.tabActive : adminTheme.tabInactive}
            >
              {tab.label}
              <span className="ms-2 text-xs opacity-70">({tab.count})</span>
            </button>
          ))}
        </div>

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 mb-6">
            {error}
          </div>
        ) : null}

        {loading ? (
          <p className="text-gray-500">Loading…</p>
        ) : reviews.length === 0 ? (
          <div className={`${adminTheme.card} p-10 text-center`}>
            <p className="text-gray-500">
              {filter === 'awaiting_points'
                ? 'Nobody is waiting for points. 🎉'
                : 'No reviews here yet.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => (
              <ReviewCard key={review.id} review={review} onChanged={load} />
            ))}
          </div>
        )}
      </div>
    </>
  )
}

function ReviewCard({ review, onChanged }: { review: Review; onChanged: () => void }) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const awarded = Boolean(review.pointsAwardedAt)

  return (
    <div className={`${adminTheme.card} p-5`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Stars value={review.overallRating} />
            <span className="text-sm font-semibold text-black">
              {review.customerName ?? 'Guest'}
            </span>
            {review.isClubMember ? (
              <span className={adminTheme.badgeActive}>
                Club member
                {/* The order was placed as a guest — she joined afterwards, most
                    likely because the review request asked her to. Worth showing
                    so the balance below is not mistaken for a stale figure. */}
                {review.joinedAfterOrder ? ' (joined after order)' : ''}
              </span>
            ) : (
              <span className={adminTheme.badgeInactive}>Not a member</span>
            )}
            {review.currentPointsBalance !== null ? (
              <span className="text-xs text-gray-500">
                balance {review.currentPointsBalance}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-gray-500">
            {review.orderNumber} · {new Date(review.submittedAt).toLocaleString()}
            {review.customerPhone ? ` · ${review.customerPhone}` : ''}
            {review.customerEmail ? ` · ${review.customerEmail}` : ''}
          </p>
        </div>

        <div className="text-end">
          {awarded ? (
            <div className="text-sm">
              <span className={adminTheme.badgeActive}>
                Points {review.pointsBefore} → {review.pointsAfter}
              </span>
              <p className="mt-1 text-xs text-gray-500">
                by {review.pointsAwardedBy} ·{' '}
                {review.notifiedAt
                  ? `customer notified ${new Date(review.notifiedAt).toLocaleDateString()}`
                  : notifyFailureLabel(review)}
              </p>
            </div>
          ) : (
            <button onClick={() => setOpen(true)} className={adminTheme.buttonPrimary}>
              Record points
            </button>
          )}
        </div>
      </div>

      {/* Aspect ratings */}
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <Aspect label="Service" value={review.serviceRating} comment={review.serviceComment} />
        <Aspect label="Delivery" value={review.deliveryRating} comment={review.deliveryComment} />
        <Aspect label="Arrival" value={review.packagingRating} comment={review.packagingComment} />
      </div>

      {/* Products */}
      <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
        {review.products.map((product) => (
          <ProductRow key={product.id} product={product} onChanged={onChanged} />
        ))}
      </div>

      {open ? (
        <AwardDialog
          review={review}
          onClose={() => setOpen(false)}
          onDone={() => {
            setOpen(false)
            onChanged()
          }}
          user={user}
        />
      ) : null}
    </div>
  )
}

function notifyFailureLabel(review: Review): string {
  if (!review.notifyResult) return 'customer not notified'
  if (review.notifyResult.skipped) return `not notified — ${review.notifyResult.reason ?? 'skipped'}`
  if (review.notifyResult.error) return `notify failed — ${review.notifyResult.error}`
  return 'customer not notified'
}

function Aspect({
  label,
  value,
  comment,
}: {
  label: string
  value: number | null
  comment: string | null
}) {
  if (value === null && !comment) return null
  return (
    <div>
      <span className="text-gray-500">{label}: </span>
      {value !== null ? <Stars value={value} small /> : <span className="text-gray-400">—</span>}
      {comment ? <p className="mt-0.5 max-w-md text-gray-700">“{comment}”</p> : null}
    </div>
  )
}

function ProductRow({ product, onChanged }: { product: Product; onChanged: () => void }) {
  const { user } = useAuth()
  const [busy, setBusy] = useState(false)

  async function togglePublished() {
    if (!user) return
    setBusy(true)
    try {
      const headers = await getAdminAuthHeaders(user)
      await fetch(`/api/admin/reviews/products/${product.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ isPublished: !product.isPublished }),
      })
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-start gap-3">
      {product.primaryImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={product.primaryImage}
          alt=""
          className="h-12 w-12 shrink-0 rounded object-cover ring-1 ring-black/5"
        />
      ) : (
        <div className="h-12 w-12 shrink-0 rounded bg-gray-100" />
      )}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Stars value={product.rating} small />
          <span className="text-sm font-medium text-black">{product.productName}</span>
          <span className="text-xs text-gray-500">
            {[
              product.size,
              product.colorName ? getColorName(product.colorName, 'en') : null,
              product.sizingFit ? SIZING_LABEL[product.sizingFit] : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </div>
        {product.body ? <p className="mt-1 text-sm text-gray-700">“{product.body}”</p> : null}
      </div>

      <button
        onClick={togglePublished}
        disabled={busy}
        className={product.isPublished ? adminTheme.buttonSecondary : adminTheme.buttonPrimary}
      >
        {product.isPublished ? 'Unpublish' : 'Publish'}
      </button>
    </div>
  )
}

function AwardDialog({
  review,
  onClose,
  onDone,
  user,
}: {
  review: Review
  onClose: () => void
  onDone: () => void
  user: ReturnType<typeof useAuth>['user']
}) {
  // Pre-filled from our mirror of the Verifone balance, but editable: Verifone is
  // the source of truth and our copy may be stale.
  const [before, setBefore] = useState(review.currentPointsBalance ?? '')
  const [after, setAfter] = useState('')
  const [notify, setNotify] = useState(true)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  const beforeNum = Number(before)
  const afterNum = Number(after)
  const valid =
    before !== '' &&
    after !== '' &&
    Number.isFinite(beforeNum) &&
    Number.isFinite(afterNum) &&
    afterNum >= beforeNum

  async function submit() {
    if (!user || !valid) return
    setBusy(true)
    setResult(null)
    try {
      const headers = await getAdminAuthHeaders(user)
      const response = await fetch(`/api/admin/reviews/${review.id}/points`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          pointsBefore: beforeNum,
          pointsAfter: afterNum,
          notifyCustomer: notify,
        }),
      })
      const data = await response.json()

      if (!data.success) {
        setResult(data.error ?? 'Failed to record')
        return
      }
      if (data.alreadyAwarded) {
        setResult('Already recorded — no message sent.')
        return
      }
      if (data.notify?.attempted && !data.notify.ok) {
        // Recorded, but the customer was not told. Surfaced rather than hidden:
        // the points are given either way, and someone must follow up manually.
        setResult(
          `Points recorded, but the customer was NOT notified — ${
            data.notify.reason ?? data.notify.error ?? 'unknown reason'
          }`
        )
        return
      }
      onDone()
    } catch (submitError) {
      setResult(submitError instanceof Error ? submitError.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-black">Record loyalty points</h2>
        <p className="mt-1 text-sm text-gray-600">
          {review.customerName ?? 'Guest'} · {review.orderNumber}
        </p>
        <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
          Add the points in Verifone first. This only records that you did it, and tells the
          customer.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="before" className="block text-sm font-medium text-gray-700">
              Points before
            </label>
            <input
              id="before"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={before}
              onChange={(event) => setBefore(event.target.value)}
              className={adminTheme.input}
            />
          </div>
          <div>
            <label htmlFor="after" className="block text-sm font-medium text-gray-700">
              Points after
            </label>
            <input
              id="after"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={after}
              onChange={(event) => setAfter(event.target.value)}
              className={adminTheme.input}
            />
          </div>
        </div>

        {before !== '' && after !== '' && !valid ? (
          <p className="mt-2 text-sm text-red-600">
            “Points after” must be a number greater than or equal to “points before”.
          </p>
        ) : null}

        <label className="mt-4 flex items-start gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={notify}
            onChange={(event) => setNotify(event.target.checked)}
            className="mt-0.5"
          />
          <span>
            Send the customer a WhatsApp/SMS that their points moved
            {valid ? ` from ${beforeNum} to ${afterNum}` : ''}
          </span>
        </label>

        {result ? (
          <p className="mt-3 rounded-lg bg-gray-50 p-3 text-sm text-gray-800">{result}</p>
        ) : null}

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className={adminTheme.buttonSecondary} disabled={busy}>
            Cancel
          </button>
          <button onClick={submit} className={adminTheme.buttonPrimary} disabled={!valid || busy}>
            {busy ? 'Saving…' : 'Record'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Stars({ value, small }: { value: number; small?: boolean }) {
  const size = small ? 'h-3.5 w-3.5' : 'h-4 w-4'
  return (
    <span className="inline-flex items-center" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((star) =>
        star <= value ? (
          <StarSolid key={star} className={`${size} text-amber-400`} aria-hidden="true" />
        ) : (
          <StarIcon key={star} className={`${size} text-gray-300`} aria-hidden="true" />
        )
      )}
    </span>
  )
}
