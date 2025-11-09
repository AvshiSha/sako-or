'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ProtectedRoute from '@/app/components/ProtectedRoute'
import { CouponForm, CouponFormValues } from '../_components/CouponForm'
import { CouponTestModal } from '../_components/CouponTestModal'
import { CouponCartItemInput } from '@/lib/coupons'

const initialValues: CouponFormValues = {
  code: '',
  name_en: '',
  name_he: '',
  description_en: '',
  description_he: '',
  discountType: 'percent_all',
  discountValue: '',
  minCartValue: '',
  usageLimit: '',
  usageLimitPerUser: '',
  startDate: '',
  endDate: '',
  stackable: false,
  autoApply: false,
  eligibleProducts: '',
  eligibleCategories: '',
  bogoBuyQuantity: '',
  bogoGetQuantity: '',
  bogoEligibleSkus: '',
  isActive: true
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

function NewCouponPageContent() {
  const router = useRouter()
  const [testModalOpen, setTestModalOpen] = useState(false)
  const [testModalCode, setTestModalCode] = useState<string>('')
  const [testSampleCart, setTestSampleCart] = useState<CouponCartItemInput[]>([])

  const handleSubmit = async (values: CouponFormValues) => {
    const payload = createPayload(values)
    const response = await fetch('/api/admin/coupons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(error.error ?? 'Failed to create coupon')
    }

    const message = encodeURIComponent(`Coupon ${values.code.toUpperCase()} created successfully.`)
    router.push(`/admin/coupons?success=${message}`)
  }

  const handleTest = (values: CouponFormValues) => {
    const code = values.code.trim()
    if (!code) {
      alert('Please provide a coupon code before testing.')
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
        price: 250
      }
    ]

    setTestSampleCart(sampleCart)
    setTestModalOpen(true)
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="bg-white shadow-sm rounded-lg p-6">
          <CouponForm
            initialValues={initialValues}
            onSubmit={async (values) => {
              try {
                await handleSubmit(values)
              } catch (error) {
                console.error('[ADMIN_COUPONS_CREATE_ERROR]', error)
                const message = error instanceof Error ? error.message : 'Failed to create coupon.'
                throw new Error(message)
              }
            }}
            onCancel={() => router.push('/admin/coupons')}
            onTest={handleTest}
            submitLabel="Create coupon"
            heading="Create coupon"
            mode="create"
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

export default function NewCouponPage() {
  return (
    <ProtectedRoute>
      <NewCouponPageContent />
    </ProtectedRoute>
  )
}

