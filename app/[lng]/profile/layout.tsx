'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/app/contexts/AuthContext'
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

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!authLoading && !user && mounted) {
      router.replace(`/${lng}/signin`)
    }
  }, [user, authLoading, router, lng, mounted])

  if (authLoading || !user) {
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

