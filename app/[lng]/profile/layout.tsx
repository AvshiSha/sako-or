'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/app/contexts/AuthContext'
import { auth } from '@/lib/firebase'
import ProfileNav from '@/app/components/profile/ProfileNav'

const translations = {
  en: {
    overview: 'Overview',
    personalDetails: 'Personal Details',
    myOrders: 'My Orders',
    myPoints: 'My Points',
    myFavorites: 'My Favorites',
    menu: 'Menu',
    loading: 'Loading...',
    logout: 'Logout'
  },
  he: {
    overview: 'סקירה כללית',
    personalDetails: 'פרטים אישיים',
    myOrders: 'ההזמנות שלי',
    myPoints: 'הנקודות שלי',
    myFavorites: 'המועדפים שלי',
    menu: 'תפריט',
    loading: 'טוען...',
    logout: 'התנתק'
  }
} as const

export default function ProfileLayout({
  children
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const params = useParams()
  const lng = (params?.lng as string) || 'en'
  const t = (translations as any)[lng] || translations.en
  const isRTL = lng === 'he'

  const { user, loading: authLoading } = useAuth()
  const [mounted, setMounted] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return

    // While Firebase auth is still initializing, keep showing a loader
    if (authLoading) {
      setCheckingAuth(true)
      return
    }

    // If we have a user, we're done checking
    if (user) {
      setCheckingAuth(false)
      return
    }

    // No user and not loading: wait a grace period before redirecting.
    // This avoids redirecting to /signin during the brief window right after
    // phone verification while auth state is still settling.
    // Also check auth.currentUser directly as fallback in case context hasn't updated
    setCheckingAuth(true)

    const timer = setTimeout(() => {
      setCheckingAuth(false)

      // Check both context user and auth.currentUser before redirecting
      // Capture auth.currentUser at this point in time to avoid closure issues
      const currentAuthUser: any = auth.currentUser
      const currentAuthUid: string | null = currentAuthUser?.uid ?? null

      if (!user && !currentAuthUid && !authLoading) {
        router.replace(`/${lng}/signin`)
      }
    }, 5000) // 5 seconds - enough time for auth to restore after signup

    return () => clearTimeout(timer)
  }, [user, authLoading, router, lng, mounted])

  if (authLoading || checkingAuth || !user) {
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
    <div
      className="min-h-screen bg-gradient-to-b from-[#eef5ff] via-[#f4f7ff] to-white pt-20 pb-12"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row gap-6 lg:gap-8">
          {/* Sidebar Navigation */}
          <ProfileNav lng={lng} translations={t} />

          {/* Main Content */}
          <div className="flex-1 min-w-0 max-w-full">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

