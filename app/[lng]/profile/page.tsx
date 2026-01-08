'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/app/contexts/AuthContext'
import { profileTheme } from '@/app/components/profile/profileTheme'
import ProfilePointsBlock from '@/app/components/profile/ProfilePointsBlock'
import NewsletterSubscriptionBlock from '@/app/components/profile/NewsletterSubscriptionBlock'
import Toast, { useToast } from '@/app/components/Toast'
import { PencilIcon, SparklesIcon, CalendarIcon, ShoppingBagIcon, ArrowRightIcon } from '@heroicons/react/24/outline'
import { formatIsraelE164ToLocalDigits } from '@/lib/phone'

const translations = {
  en: {
    pageTitle: 'Profile Overview',
    welcomeBack: (name: string) => `Welcome back, ${name}!`,
    userFallback: 'User',
    unableToLoadProfile: 'Unable to load profile',
    pointsBalance: 'Points Balance',
    personalInformation: 'Personal Information',
    addressInformation: 'Address Information',
    recentOrders: 'Recent Orders',
    viewAllOrders: 'View All Orders',
    noOrdersYet: 'No orders yet',
    startShopping: 'Start Shopping',
    edit: 'Edit',
    loading: 'Loading…',
    firstName: 'First Name',
    lastName: 'Last Name',
    emailAddress: 'Email Address',
    phoneNumber: 'Phone Number',
    address: 'Address',
    noAddressSaved: 'No address saved yet',
    newsletterSubscription: 'Newsletter Subscription',
    newsletterDescription: 'Receive updates, offers, and news via email.',
    pointsHistory: 'Points History',
    pointsHelp: 'Earn 5% back in points on every purchase. Use points towards future orders!',
    noPointsActivityYet: 'No points activity yet',
    earnedPoints: 'Earned Points',
    spentPoints: 'Spent Points',
    orderNumber: (n: string) => `Order #${n}`,
    memberSince: (value: string) => `Member since ${value}`,
    unableToSaveProfile: 'Unable to save profile',
    profileUpdated: 'Profile updated successfully'
  },
  he: {
    pageTitle: 'סקירת פרופיל',
    welcomeBack: (name: string) => `ברוך שובך, ${name}!`,
    userFallback: 'משתמש',
    unableToLoadProfile: 'לא ניתן לטעון את הפרופיל',
    pointsBalance: 'יתרת נקודות',
    personalInformation: 'מידע אישי',
    addressInformation: 'מידע כתובת',
    recentOrders: 'הזמנות אחרונות',
    viewAllOrders: 'צפה בכל ההזמנות',
    noOrdersYet: 'אין הזמנות עדיין',
    startShopping: 'התחל לקנות',
    edit: 'עריכה',
    loading: 'טוען…',
    firstName: 'שם פרטי',
    lastName: 'שם משפחה',
    emailAddress: 'אימייל',
    phoneNumber: 'מספר טלפון',
    address: 'כתובת',
    noAddressSaved: 'לא נשמרה כתובת עדיין',
    newsletterSubscription: 'הרשמה לניוזלטר',
    newsletterDescription: 'קבלו עדכונים, מבצעים וחדשות במייל.',
    pointsHistory: 'היסטוריית נקודות',
    pointsHelp: 'צברו 5% בחזרה כנקודות על כל רכישה. השתמשו בנקודות להזמנות עתידיות!',
    noPointsActivityYet: 'אין פעילות נקודות עדיין',
    earnedPoints: 'נקודות שנצברו',
    spentPoints: 'נקודות שנוצלו',
    orderNumber: (n: string) => `הזמנה #${n}`,
    memberSince: (value: string) => `חבר מאז ${value}`,
    unableToSaveProfile: 'לא ניתן לשמור את הפרופיל',
    profileUpdated: 'הפרופיל עודכן בהצלחה'
  }
} as const

type ApiUser = {
  id: string
  firebaseUid: string | null
  email: string | null
  phone: string | null
  firstName: string | null
  lastName: string | null
  language: string | null
  birthday: string | null
  interestedIn: string | null
  addressStreet: string | null
  addressStreetNumber: string | null
  addressFloor: string | null
  addressApt: string | null
  addressCity: string | null
  isNewsletter: boolean
  pointsBalance: number
  role: string
  createdAt: string
  updatedAt: string
}

type PointsTransaction = {
  id: string
  kind: 'EARN' | 'SPEND'
  delta: number
  reason: string
  createdAt: string
  order: {
    orderNumber: string
    total: number
    currency: string
    createdAt: string
  } | null
}

export default function ProfileOverviewPage() {
  const router = useRouter()
  const params = useParams()
  const lng = (params?.lng as string) || 'en'
  const t = (translations as any)[lng] || translations.en
  const locale = lng === 'he' ? 'he-IL' : 'en-US'

  const { user: firebaseUser, loading: authLoading } = useAuth()
  const { toast, showToast, hideToast } = useToast()

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadedUser, setLoadedUser] = useState<ApiUser | null>(null)

  // Points state
  const [pointsHistory, setPointsHistory] = useState<PointsTransaction[]>([])
  const [pointsLoading, setPointsLoading] = useState(true)

  // Load user profile
  useEffect(() => {
    if (authLoading) return
    if (!firebaseUser) {
      router.replace(`/${lng}/signin`)
      return
    }

    let cancelled = false
    ;(async () => {
      setBusy(true)
      setError(null)
      try {
        const token = await firebaseUser.getIdToken()
        const res = await fetch('/api/me/profile', {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` }
        })

        const json = await res.json().catch(() => ({}))
        if (!res.ok || !json || json.error) {
          throw new Error(json?.error || `HTTP ${res.status}`)
        }

        if (cancelled) return
        setLoadedUser(json.user)
      } catch (e: any) {
        if (!cancelled) setError(e?.message || t.unableToLoadProfile)
      } finally {
        if (!cancelled) setBusy(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [firebaseUser, authLoading, router, lng, t])

  // Load points
  useEffect(() => {
    if (!firebaseUser || !loadedUser) return

    let cancelled = false
    ;(async () => {
      setPointsLoading(true)
      try {
        const token = await firebaseUser.getIdToken()
        const res = await fetch('/api/me/points?limit=5', {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` }
        })

        const json = await res.json().catch(() => ({}))
        if (!res.ok || !json || json.error) {
          throw new Error(json?.error || 'Failed to load points')
        }

        if (!cancelled) setPointsHistory(json.pointsHistory || [])
      } catch (e: any) {
        console.error('Error loading points:', e)
      } finally {
        if (!cancelled) setPointsLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [firebaseUser, loadedUser])

  // Handle newsletter update
  const handleNewsletterUpdate = async (isNewsletter: boolean) => {
    if (!firebaseUser) return

    const token = await firebaseUser.getIdToken()
    const res = await fetch('/api/me/profile', {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ isNewsletter })
    })

    const json = await res.json().catch(() => ({}))
    if (!res.ok || !json || json.error) {
      throw new Error(json?.error || t.unableToSaveProfile)
    }

    setLoadedUser(json.user)
    showToast(t.profileUpdated, 'success')
  }

  if (authLoading || !loadedUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#856D55] mx-auto"></div>
          <p className="mt-4 text-gray-600">{t.loading}</p>
        </div>
      </div>
    )
  }

  const memberSince = new Date(loadedUser.createdAt).toLocaleDateString(locale, {
    month: 'long',
    year: 'numeric'
  })

  const formatAddress = () => {
    const parts = []
    if (loadedUser.addressStreet) {
      let streetPart = loadedUser.addressStreet
      if (loadedUser.addressStreetNumber) {
        streetPart += ` ${loadedUser.addressStreetNumber}`
      }
      parts.push(streetPart)
    }
    if (loadedUser.addressFloor || loadedUser.addressApt) {
      const aptParts = []
      if (loadedUser.addressFloor) aptParts.push(`Floor ${loadedUser.addressFloor}`)
      if (loadedUser.addressApt) aptParts.push(`Apt ${loadedUser.addressApt}`)
      if (aptParts.length > 0) parts.push(aptParts.join(', '))
    }
    if (loadedUser.addressCity) {
      parts.push(loadedUser.addressCity)
    }
    return parts.length > 0 ? parts.join(', ') : t.noAddressSaved
  }

  // Derive display name for Welcome Back header
  const getDisplayName = (): string => {
    // 1. Try firstName from loaded user
    if (loadedUser.firstName?.trim()) {
      return loadedUser.firstName.trim()
    }
    
    // 2. Try displayName from Firebase user
    if (firebaseUser?.displayName?.trim()) {
      return firebaseUser.displayName.trim()
    }
    
    // 3. Try email prefix
    const email = loadedUser.email || firebaseUser?.email
    if (email) {
      const prefix = email.split('@')[0]
      if (prefix) return prefix
    }
    
    // 4. Fallback
    return lng === 'he' ? 'שם משתמש' : 'User'
  }

  const displayName = getDisplayName()

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      {/* Welcome Back Header */}
      <div className={`${profileTheme.card} overflow-hidden`}>
        <div className="px-6 py-8 sm:px-8 sm:py-10 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight mb-3">
            WELCOME BACK
          </h2>
          <p className="text-xl sm:text-2xl text-gray-700 font-medium">
            {displayName}
          </p>
        </div>
      </div>

      {/* Header */}
      <div className={profileTheme.card}>
        <div className={profileTheme.section}>
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {loadedUser.firstName} {loadedUser.lastName}
              </h1>
              <p className="text-sm text-gray-500">{loadedUser.email}</p>
              <p className="text-xs text-gray-400 flex items-center mt-1">
                <CalendarIcon className="h-4 w-4 mr-1" />
                {t.memberSince(memberSince)}
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500">{t.pointsBalance}</div>
              <div className="text-3xl font-bold text-indigo-600 flex items-center">
                <SparklesIcon className="h-6 w-6 mr-1" />
                {loadedUser.pointsBalance}
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Personal Information Summary */}
      <div className={profileTheme.card}>
        <div className={profileTheme.section}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={profileTheme.sectionTitle}>{t.personalInformation}</h3>
            <Link
              href={`/${lng}/profile/personal`}
              className="flex items-center text-sm text-indigo-600 hover:text-indigo-700"
            >
              <PencilIcon className="h-4 w-4 mr-1" />
              {t.edit}
            </Link>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">{t.firstName}:</span>
              <span className="text-sm font-medium text-gray-900">{loadedUser.firstName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">{t.lastName}:</span>
              <span className="text-sm font-medium text-gray-900">{loadedUser.lastName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">{t.emailAddress}:</span>
              <span className="text-sm font-medium text-gray-900">{loadedUser.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">{t.phoneNumber}:</span>
              <span className="text-sm font-medium text-gray-900">{formatIsraelE164ToLocalDigits(loadedUser.phone) || '—'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Address Information Summary */}
      <div className={profileTheme.card}>
        <div className={profileTheme.section}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={profileTheme.sectionTitle}>{t.addressInformation}</h3>
            <Link
              href={`/${lng}/profile/personal`}
              className="flex items-center text-sm text-indigo-600 hover:text-indigo-700"
            >
              <PencilIcon className="h-4 w-4 mr-1" />
              {t.edit}
            </Link>
          </div>

          <div className="text-sm text-gray-900">
            {formatAddress()}
          </div>
        </div>
      </div>

      {/* Recent Orders Section */}
      <div className={profileTheme.card}>
        <div className={profileTheme.section}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={profileTheme.sectionTitle}>{t.recentOrders}</h3>
            <Link
              href={`/${lng}/profile/orders`}
              className="flex items-center text-sm text-indigo-600 hover:text-indigo-700"
            >
              {t.viewAllOrders}
              <ArrowRightIcon className="h-4 w-4 ml-1" />
            </Link>
          </div>

          {/* Placeholder for orders - will be replaced with actual orders later */}
          <div className="text-center py-8 text-gray-500">
            <ShoppingBagIcon className="h-12 w-12 mx-auto mb-2 text-gray-300" />
            <p className="mb-4">{t.noOrdersYet}</p>
            <Link
              href={`/${lng}`}
              className="inline-flex items-center text-sm text-indigo-600 hover:text-indigo-700"
            >
              {t.startShopping}
            </Link>
          </div>

          {/* TODO: Replace above placeholder with actual orders display
          <div className="space-y-3">
            {orders.slice(0, 3).map((order) => (
              <div
                key={order.id}
                className="border border-gray-200 rounded-lg p-4 hover:border-indigo-300 transition-colors"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-semibold text-gray-900">
                      {t.orderNumber(order.orderNumber)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(order.createdAt).toLocaleDateString(locale)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900">
                      ₪{order.total.toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500 capitalize">{order.status}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          */}
        </div>
      </div>

      {/* Points Block */}
      <div className={profileTheme.card}>
        <ProfilePointsBlock
          pointsHistory={pointsHistory}
          pointsLoading={pointsLoading}
          locale={locale}
          translations={{
            pointsHistory: t.pointsHistory,
            pointsHelp: t.pointsHelp,
            noPointsActivityYet: t.noPointsActivityYet,
            earnedPoints: t.earnedPoints,
            spentPoints: t.spentPoints,
            orderNumber: t.orderNumber
          }}
        />
      </div>

      {/* Newsletter Block */}
      <div className={profileTheme.card}>
        <NewsletterSubscriptionBlock
          isNewsletter={loadedUser.isNewsletter}
          onUpdate={handleNewsletterUpdate}
          translations={{
            newsletterSubscription: t.newsletterSubscription,
            newsletterDescription: t.newsletterDescription,
            unableToSaveProfile: t.unableToSaveProfile
          }}
          showAsSection={true}
        />
      </div>

      {/* Toast Notification */}
      <Toast
        message={toast.message}
        isVisible={toast.isVisible}
        onClose={hideToast}
        type={toast.type}
      />
    </div>
  )
}
