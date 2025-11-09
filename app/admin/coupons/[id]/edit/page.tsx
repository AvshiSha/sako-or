'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import ProtectedRoute from '@/app/components/ProtectedRoute'
import { CouponForm, CouponFormValues } from '../../_components/CouponForm'
import { CouponTestModal } from '../../_components/CouponTestModal'
import { CouponCartItemInput } from '@/lib/coupons'

interface CouponStats {
  totalRedemptions: number
  totalDiscountGranted: number
}

interface CouponApiResponse {
  coupon: {
    id: string
    code: string
    name_en: string
    name_he: string
    description_en?: string | null
    description_he?: string | null
    discountType: string
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
  stats: CouponStats
}

const emptyStats: CouponStats = {
  totalRedemptions: 0,
  totalDiscountGranted: 0
}

function formatCurrency(amount: number, currency = 'ILS'): string {
  try {
    return new Intl.NumberFormat('he-IL', {
      style: 'currency',
      currency
    }).format(amount)
  } catch {
    return `${amount} ${currency}`
  }
}

function formatDatetimeLocal(value?: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) return ''
  const localISO = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString()
  return localISO.slice(0, 16)
}

function mapCouponToFormValues(data: CouponApiResponse['coupon']): CouponFormValues {
  return {
    code: data.code,
    name_en: data.name_en,
    name_he: data.name_he,
    description_en: data.description_en ?? '',
    description_he: data.description_he ?? '',
    discountType: data.discountType as CouponFormValues['discountType'],
    discountValue: data.discountValue != null ? String(data.discountValue) : '',
    minCartValue: data.minCartValue != null ? String(data.minCartValue) : '',
    usageLimit: data.usageLimit != null ? String(data.usageLimit) : '',
    usageLimitPerUser: data.usageLimitPerUser != null ? String(data.usageLimitPerUser) : '',
    startDate: formatDatetimeLocal(data.startDate),
    endDate: formatDatetimeLocal(data.endDate),
    stackable: data.stackable,
    autoApply: data.autoApply,
    eligibleProducts: data.eligibleProducts.join(', '),
    eligibleCategories: data.eligibleCategories.join(', '),
    bogoBuyQuantity: data.bogoBuyQuantity ? String(data.bogoBuyQuantity) : '',
    bogoGetQuantity: data.bogoGetQuantity ? String(data.bogoGetQuantity) : '',
    bogoEligibleSkus: data.bogoEligibleSkus.join(', '),
    isActive: data.isActive
  }
}

function EditCouponPageContent() {
  const params = useParams<{ id: string }>()
  const id = params?.id
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formValues, setFormValues] = useState<CouponFormValues | null>(null)
  const [coupon, setCoupon] = useState<CouponApiResponse['coupon'] | null>(null)
  const [stats, setStats] = useState<CouponStats>(emptyStats)
  const [testModalOpen, setTestModalOpen] = useState(false)
  const [testModalCode, setTestModalCode] = useState('')
  const [testSampleCart, setTestSampleCart] = useState<CouponCartItemInput[]>([])

  useEffect(() => {
    async function loadCoupon() {
      try {
        setLoading(true)
        setError(null)
        const response = await fetch(`/api/admin/coupons/${id}`)
        if (!response.ok) {
          throw new Error('Failed to load coupon.')
        }
        const data: CouponApiResponse = await response.json()
        setCoupon(data.coupon)
        setStats(data.stats)
        setFormValues(mapCouponToFormValues(data.coupon))
      } catch (loadError) {
        console.error('[ADMIN_COUPONS_EDIT_LOAD_ERROR]', loadError)
        setError(loadError instanceof Error ? loadError.message : 'Unable to load coupon.')
      } finally {
        setLoading(false)
      }
    }

    if (id) {
      loadCoupon()
    }
  }, [id])

  const handleSubmit = async (values: CouponFormValues) => {
    if (!id) {
      throw new Error('Invalid coupon id')
    }

    const payload = createPayload(values)
    const response = await fetch(`/api/admin/coupons/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(error.error ?? 'Failed to update coupon')
    }

    const message = encodeURIComponent(`Coupon ${values.code.toUpperCase()} updated successfully.`)
    router.push(`/admin/coupons?success=${message}`)
  }

  const handleTest = (values: CouponFormValues) => {
    const code = values.code.trim()
    if (!code) {
      alert('Coupon code is required before testing.')
      return
    }

    setTestModalCode(code)
    const eligibleProduct = values.eligibleProducts.split(',').map((item) => item.trim()).filter(Boolean)[0] ?? 'SKU-1001'
    const buyQty = Number(values.bogoBuyQuantity) || 1
    const getQty = Number(values.bogoGetQuantity) || 1
    const isBogo = values.discountType === 'bogo'

    const sampleCart: CouponCartItemInput[] = [
      {
        sku: eligibleProduct,
        quantity: isBogo ? buyQty + getQty : 1,
        price: 220
      }
    ]

    setTestSampleCart(sampleCart)
    setTestModalOpen(true)
  }

  if (!id) {
    return (
      <div className="min-h-screen bg-gray-50 pt-16 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">Invalid coupon ID.</p>
          <button
            onClick={() => router.push('/admin/coupons')}
            className="mt-4 text-sm text-indigo-600 hover:text-indigo-800"
          >
            Back to coupons
          </button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pt-16 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading coupon…</p>
        </div>
      </div>
    )
  }

  if (error || !formValues || !coupon) {
    return (
      <div className="min-h-screen bg-gray-50 pt-16 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">{error ?? 'Coupon not found.'}</p>
          <button
            onClick={() => router.push('/admin/coupons')}
            className="mt-4 text-sm text-indigo-600 hover:text-indigo-800"
          >
            Back to coupons
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
        <div className="bg-white shadow-sm rounded-lg p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Edit coupon</h1>
              <p className="text-sm text-gray-500 mt-1">
                Update details for <span className="font-semibold">{coupon.code}</span>
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
              <div>
                <p className="font-semibold">Total redemptions</p>
                <p>{stats.totalRedemptions}</p>
              </div>
              <div>
                <p className="font-semibold">Discount granted</p>
                <p>{formatCurrency(stats.totalDiscountGranted)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white shadow-sm rounded-lg p-6">
          <CouponForm
            initialValues={formValues}
            onSubmit={async (values) => {
              try {
                await handleSubmit(values)
              } catch (submitError) {
                console.error('[ADMIN_COUPONS_UPDATE_ERROR]', submitError)
                const message = submitError instanceof Error ? submitError.message : 'Failed to update coupon.'
                throw new Error(message)
              }
            }}
            onCancel={() => router.push('/admin/coupons')}
            onTest={handleTest}
            submitLabel="Update coupon"
            heading={`Edit ${coupon.code}`}
            mode="edit"
          />
        </div>
      </div>

      <CouponTestModal
        isOpen={testModalOpen}
        couponCode={testModalCode}
        onClose={() => setTestModalOpen(false)}
        initialCartItems={testSampleCart}
      />
    </div>
  )
}

function createPayload(values: CouponFormValues) {
  const toNumber = (value: string): number | null => {
    if (!value || value.trim() === '') return null
    const parsed = Number(value)
    return Number.isNaN(parsed) ? null : parsed
  }

  const toDateISO = (value: string): string | null => {
    if (!value) return null
    const date = new Date(value)
    if (Number.isNaN(date.valueOf())) return null
    return date.toISOString()
  }

  const toStringArray = (value: string): string[] =>
    value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)

  return {
    code: values.code,
    name_en: values.name_en,
    name_he: values.name_he,
    description_en: values.description_en || null,
    description_he: values.description_he || null,
    discountType: values.discountType,
    discountValue: toNumber(values.discountValue),
    minCartValue: toNumber(values.minCartValue),
    usageLimit: toNumber(values.usageLimit),
    usageLimitPerUser: toNumber(values.usageLimitPerUser),
    startDate: toDateISO(values.startDate),
    endDate: toDateISO(values.endDate),
    stackable: values.stackable,
    autoApply: values.autoApply,
    eligibleProducts: toStringArray(values.eligibleProducts),
    eligibleCategories: toStringArray(values.eligibleCategories),
    bogoBuyQuantity: toNumber(values.bogoBuyQuantity),
    bogoGetQuantity: toNumber(values.bogoGetQuantity),
    bogoEligibleSkus: toStringArray(values.bogoEligibleSkus),
    isActive: values.isActive
  }
}

export default function EditCouponPage() {
  return (
    <ProtectedRoute>
      <EditCouponPageContent />
    </ProtectedRoute>
  )
}

