'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/app/contexts/AuthContext'
import { profileTheme } from '@/app/components/profile/profileTheme'
import OrderHistory from '@/app/components/profile/OrderHistory'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'

const translations = {
  en: {
    pageTitle: 'My Orders',
    orderHistory: 'Order History',
    orderNumber: (n: string) => `Order #${n}`,
    orderDate: 'Order Date',
    noOrdersYet: 'No orders yet',
    startShopping: 'Start Shopping',
    products: 'Products',
    quantity: 'Quantity',
    size: 'Size',
    price: 'Price',
    total: 'Total',
    subtotal: 'Subtotal',
    shipping: 'Shipping',
    discount: 'Discount',
    couponsApplied: 'Coupons Applied',
    loyaltyPointsUsed: 'Loyalty Points Used',
    modelNumber: 'Model Number',
    color: 'Color',
    backToProfile: 'Back to Profile',
    loading: 'Loading…'
  },
  he: {
    pageTitle: 'ההזמנות שלי',
    orderHistory: 'היסטוריית הזמנות',
    orderNumber: (n: string) => `הזמנה #${n}`,
    orderDate: 'תאריך הזמנה',
    noOrdersYet: 'אין הזמנות עדיין',
    startShopping: 'התחל לקנות',
    products: 'מוצרים',
    quantity: 'כמות',
    size: 'מידה',
    price: 'מחיר',
    total: 'סה"כ',
    subtotal: 'סכום ביניים',
    shipping: 'משלוח',
    discount: 'הנחה',
    couponsApplied: 'קופונים שהופעלו',
    loyaltyPointsUsed: 'נקודות נאמנות שנוצלו',
    modelNumber: 'מספר דגם',
    color: 'צבע',
    backToProfile: 'חזרה לפרופיל',
    loading: 'טוען…'
  }
} as const

export default function OrdersPage() {
  const params = useParams()
  const router = useRouter()
  const lng = (params?.lng as string) || 'en'
  const t = (translations as any)[lng] || translations.en
  const locale = lng === 'he' ? 'he-IL' : 'en-US'
  const isRTL = lng === 'he'

  const { user: firebaseUser, loading: authLoading } = useAuth()
  const [orders, setOrders] = useState<any[]>([])
  const [ordersLoading, setOrdersLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (!firebaseUser) {
      router.replace(`/${lng}/signin`)
      return
    }

    let cancelled = false
    ;(async () => {
      setOrdersLoading(true)
      try {
        const token = await firebaseUser.getIdToken()
        const res = await fetch('/api/me/orders', {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` }
        })

        const json = await res.json().catch(() => ({}))
        if (!res.ok || !json || json.error) {
          throw new Error(json?.error || 'Failed to load orders')
        }

        if (!cancelled) setOrders(json.orders || [])
      } catch (e: any) {
        console.error('Error loading orders:', e)
      } finally {
        if (!cancelled) setOrdersLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [firebaseUser, authLoading, router, lng])

  if (authLoading || ordersLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#856D55] mx-auto"></div>
          <p className="mt-4 text-gray-600">{t.loading}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="pt-6 pb-20 md:pb-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className={profileTheme.card}>
        <div className="flex items-center justify-between mb-4 px-5 pt-5 sm:px-6 sm:pt-6 md:px-8 md:pt-6">
          <h1 className={profileTheme.sectionTitle}>{t.pageTitle}</h1>
          <Link
            href={`/${lng}/profile`}
            className="flex items-center text-sm text-indigo-600 hover:text-indigo-700 gap-1"
          >
            {isRTL && <ArrowLeftIcon className="h-4 w-4" />}
            {t.backToProfile}
            {!isRTL && <ArrowLeftIcon className="h-4 w-4" />}
          </Link>
        </div>
        <OrderHistory
          orders={orders}
          loading={ordersLoading}
          locale={locale}
          lng={lng as 'en' | 'he'}
          variant="list"
          translations={{
            orderHistory: t.orderHistory,
            orderNumber: t.orderNumber,
            orderDate: t.orderDate,
            noOrdersYet: t.noOrdersYet,
            startShopping: t.startShopping,
            products: t.products,
            quantity: t.quantity,
            size: t.size,
            price: t.price,
            total: t.total,
            subtotal: t.subtotal,
            shipping: t.shipping,
            discount: t.discount,
            couponsApplied: t.couponsApplied,
            loyaltyPointsUsed: t.loyaltyPointsUsed,
            modelNumber: t.modelNumber,
            color: t.color
          }}
        />
      </div>
    </div>
  )
}

