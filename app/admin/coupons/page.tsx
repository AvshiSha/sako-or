'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { CouponDiscountType } from '@prisma/client'
import ProtectedRoute from '@/app/components/ProtectedRoute'
import SuccessMessage from '@/app/components/SuccessMessage'
import { CouponTestModal } from './_components/CouponTestModal'
import { CouponCartItemInput } from '@/lib/coupons'

interface AdminCoupon {
  id: string
  code: string
  name_en: string
  name_he: string
  description_en?: string | null
  description_he?: string | null
  discountType: CouponDiscountType
  discountValue?: number | null
  minCartValue?: number | null
  startDate?: string | null
  endDate?: string | null
  usageLimit?: number | null
  usageLimitPerUser?: number | null
  usageCount: number
  stackable: boolean
  autoApply: boolean
  eligibleProducts: string[]
  eligibleCategories: string[]
  bogoBuyQuantity: number
  bogoGetQuantity: number
  bogoEligibleSkus: string[]
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
}

const discountTypeLabels: Record<CouponDiscountType, { en: string; he: string }> = {
  percent_all: {
    en: 'Percent off (entire cart)',
    he: 'הנחה באחוזים (כל העגלה)'
  },
  percent_specific: {
    en: 'Percent off (specific items)',
    he: 'הנחה באחוזים (פריטים נבחרים)'
  },
  fixed: {
    en: 'Fixed amount off',
    he: 'הנחה בסכום קבוע'
  },
  bogo: {
    en: 'Buy X Get Y',
    he: 'מבצע קנה X קבל Y'
  }
}

const statusBadges: Record<'active' | 'inactive', string> = {
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-800'
}

type FilterState = {
  search: string
  status: 'all' | 'active' | 'inactive'
  type: 'all' | CouponDiscountType
  autoApply: 'all' | 'true' | 'false'
  page: number
}

const defaultFilters: FilterState = {
  search: '',
  status: 'all',
  type: 'all',
  autoApply: 'all',
  page: 1
}

function formatDateTime(value?: string | null): string {
  if (!value) return '—'
  try {
    const date = new Date(value)
    if (Number.isNaN(date.valueOf())) return '—'
    return date.toLocaleString('en-IL', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return '—'
  }
}

function formatCurrency(amount?: number | null, currency: string = 'ILS'): string {
  if (!amount && amount !== 0) return '—'
  try {
    return new Intl.NumberFormat('he-IL', {
      style: 'currency',
      currency
    }).format(amount)
  } catch {
    return `${amount} ${currency}`
  }
}

function CouponsPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [filters, setFilters] = useState<FilterState>(defaultFilters)
  const [coupons, setCoupons] = useState<AdminCoupon[]>([])
  const [pagination, setPagination] = useState<PaginationMeta | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [selectedCoupon, setSelectedCoupon] = useState<AdminCoupon | null>(null)
  const [testModalOpen, setTestModalOpen] = useState(false)

  useEffect(() => {
    if (!searchParams) return

    const success = searchParams.get('success')
    if (success) {
      setSuccessMessage(decodeURIComponent(success))
      setShowSuccess(true)
      const params = new URLSearchParams(searchParams.toString())
      params.delete('success')
      router.replace(`/admin/coupons?${params.toString()}`, { scroll: false })
    }
  }, [searchParams, router])

  const fetchCoupons = useCallback(async (overrideFilters?: Partial<FilterState>) => {
    try {
      setLoading(true)
      setError(null)
      const activeFilters = { ...filters, ...overrideFilters }
      const params = new URLSearchParams()

      if (activeFilters.search) params.set('search', activeFilters.search)
      if (activeFilters.status !== 'all') params.set('status', activeFilters.status)
      if (activeFilters.type !== 'all') params.set('type', activeFilters.type)
      if (activeFilters.autoApply !== 'all') params.set('autoApply', activeFilters.autoApply)
      params.set('page', String(activeFilters.page))
      params.set('limit', '20')

      const response = await fetch(`/api/admin/coupons?${params.toString()}`)

      if (!response.ok) {
        throw new Error('Failed to fetch coupons')
      }

      const data = await response.json()
      setCoupons(data.data ?? [])
      setPagination(data.pagination ?? null)
      setFilters(activeFilters)
    } catch (fetchError) {
      console.error('[ADMIN_COUPONS_FETCH_ERROR]', fetchError)
      setError('Failed to load coupons. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    fetchCoupons()
  }, [])

  const handleFilterChange = (key: keyof FilterState, value: string) => {
    const updated: FilterState = {
      ...filters,
      [key]: value,
      page: 1
    } as FilterState
    setFilters(updated)
    fetchCoupons(updated)
  }

  const handlePageChange = (page: number) => {
    if (page < 1 || (pagination && page > pagination.totalPages)) return
    fetchCoupons({ page })
  }

  const handleToggleActive = async (coupon: AdminCoupon) => {
    try {
      const response = await fetch(`/api/admin/coupons/${coupon.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !coupon.isActive })
      })
      if (!response.ok) {
        throw new Error('Failed to update coupon status')
      }
      fetchCoupons()
    } catch (toggleError) {
      console.error('[ADMIN_COUPONS_TOGGLE_ERROR]', toggleError)
      setError('Unable to update coupon status.')
    }
  }

  const handleDelete = async (coupon: AdminCoupon) => {
    const confirmDelete = window.confirm(`Delete coupon ${coupon.code}? This cannot be undone.`)
    if (!confirmDelete) return
    try {
      const response = await fetch(`/api/admin/coupons/${coupon.id}`, {
        method: 'DELETE'
      })
      if (!response.ok) {
        throw new Error('Failed to delete coupon')
      }
      fetchCoupons()
      setSuccessMessage(`Coupon ${coupon.code} deleted.`)
      setShowSuccess(true)
    } catch (deleteError) {
      console.error('[ADMIN_COUPONS_DELETE_ERROR]', deleteError)
      setError('Failed to delete coupon.')
    }
  }

  const handleTestCoupon = (coupon: AdminCoupon) => {
    setSelectedCoupon(coupon)
    setTestModalOpen(true)
  }

  const filteredTableData = useMemo(() => coupons, [coupons])

  const sampleCart: CouponCartItemInput[] = useMemo(() => {
    if (!selectedCoupon) return []
    const sampleSku = selectedCoupon.eligibleProducts?.[0] ?? 'SKU-1001'
    return [
      {
        sku: sampleSku,
        quantity: selectedCoupon.discountType === 'bogo' ? selectedCoupon.bogoBuyQuantity + selectedCoupon.bogoGetQuantity : 1,
        price: 250
      }
    ]
  }, [selectedCoupon])

  return (
    <div className="min-h-screen bg-gray-50 pt-16">
      {showSuccess && (
        <SuccessMessage
          message={successMessage}
          onClose={() => setShowSuccess(false)}
        />
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Coupons</h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage promotional codes and discount logic across languages.
            </p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={() => fetchCoupons()}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              Refresh
            </button>
            <Link
              href="/admin/coupons/new"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
            >
              Create coupon
            </Link>
          </div>
        </div>

        <div className="bg-white shadow-sm rounded-lg p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Search</label>
              <input
                type="text"
                value={filters.search}
                onChange={(event) => handleFilterChange('search', event.target.value)}
                placeholder="Search code or name…"
                className="mt-1 block w-full rounded-md border-gray-300 text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Status</label>
              <select
                value={filters.status}
                onChange={(event) => handleFilterChange('status', event.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Discount type</label>
              <select
                value={filters.type}
                onChange={(event) => handleFilterChange('type', event.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              >
                <option value="all">All</option>
                {Object.entries(discountTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label.en}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Auto apply</label>
              <select
                value={filters.autoApply}
                onChange={(event) => handleFilterChange('autoApply', event.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              >
                <option value="all">All</option>
                <option value="true">Auto apply</option>
                <option value="false">Manual</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Coupon catalog</h2>
          </div>

          {loading ? (
            <div className="py-12">
              <div className="flex justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
              </div>
              <p className="mt-4 text-center text-sm text-gray-500">Loading coupons…</p>
            </div>
          ) : error ? (
            <div className="py-12 text-center text-sm text-red-600">
              {error}
            </div>
          ) : filteredTableData.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-gray-600">No coupons found.</p>
              <p className="text-sm text-gray-400 mt-1">Adjust filters or create a new coupon.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Coupon</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Discount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Limits</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Schedule</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Flags</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredTableData.map((coupon) => (
                    <tr key={coupon.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex flex-col space-y-1">
                          <span className="text-sm font-semibold text-gray-900">{coupon.name_en}</span>
                          <span className="text-xs text-gray-500">{coupon.name_he}</span>
                          <span className="inline-flex mt-1 px-2 py-0.5 text-xs font-medium rounded-full bg-indigo-50 text-indigo-700">
                            {coupon.code}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-700">
                          {discountTypeLabels[coupon.discountType].en}
                        </div>
                        {coupon.discountValue && (
                          <div className="text-xs text-gray-500">
                            Value: {coupon.discountType === 'fixed'
                              ? formatCurrency(coupon.discountValue)
                              : `${coupon.discountValue}%`}
                          </div>
                        )}
                        {typeof coupon.minCartValue === 'number' && coupon.minCartValue >= 0 && (
                          <div className="text-xs text-gray-700">
                            Min cart: {formatCurrency(coupon.minCartValue)}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-700">
                          Global: {coupon.usageLimit ?? '∞'}
                        </div>
                        <div className="text-sm text-gray-700">
                          Per user: {coupon.usageLimitPerUser ?? '∞'}
                        </div>
                        <div className="text-xs text-gray-500">
                          Used: {coupon.usageCount}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700 space-y-1">
                        <div>Start: {formatDateTime(coupon.startDate)}</div>
                        <div>End: {formatDateTime(coupon.endDate)}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          <span className={coupon.stackable ? 'inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-blue-50 text-blue-700' : 'inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600'}>
                            {coupon.stackable ? 'Stackable' : 'Single-use'}
                          </span>
                          {coupon.autoApply && (
                            <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-amber-50 text-amber-700">
                              Auto apply
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2.5 py-0.5 text-xs font-semibold rounded-full ${statusBadges[coupon.isActive ? 'active' : 'inactive']}`}>
                          {coupon.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="inline-flex items-center space-x-2">
                          <button
                            onClick={() => handleTestCoupon(coupon)}
                            className="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
                          >
                            Test
                          </button>
                          <Link
                            href={`/admin/coupons/${coupon.id}/edit`}
                            className="text-blue-600 hover:text-blue-900 text-sm font-medium"
                          >
                            Edit
                          </Link>
                          <button
                            onClick={() => handleToggleActive(coupon)}
                            className="text-gray-600 hover:text-gray-900 text-sm font-medium"
                          >
                            {coupon.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            onClick={() => handleDelete(coupon)}
                            className="text-red-600 hover:text-red-900 text-sm font-medium"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Page {pagination.page} of {pagination.totalPages}
            </p>
            <div className="inline-flex space-x-2">
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm text-gray-700 bg-white disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page === pagination.totalPages}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm text-gray-700 bg-white disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      <CouponTestModal
        isOpen={testModalOpen && !!selectedCoupon}
        couponCode={selectedCoupon?.code ?? ''}
        onClose={() => {
          setSelectedCoupon(null)
          setTestModalOpen(false)
        }}
        initialCartItems={sampleCart}
      />
    </div>
  )
}

export default function CouponsPage() {
  return (
    <ProtectedRoute>
      <CouponsPageContent />
    </ProtectedRoute>
  )
}

