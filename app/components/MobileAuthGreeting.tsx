'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useAuth } from '@/app/contexts/AuthContext'
import { SheetClose } from '@/app/components/ui/sheet'
import { ArrowLeft, ArrowRight, User } from 'lucide-react'

interface MobileAuthGreetingProps {
  lng: string
}

export default function MobileAuthGreeting({ lng }: MobileAuthGreetingProps) {
  const { user } = useAuth()
  const [firstName, setFirstName] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Fetch user profile to get firstName
  useEffect(() => {
    if (!user) {
      setFirstName(null)
      return
    }

    let cancelled = false
    setLoading(true)

    ;(async () => {
      try {
        const token = await user.getIdToken()
        const res = await fetch('/api/me/profile', {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` }
        })

        const json = await res.json().catch(() => ({}))
        if (!res.ok || !json || json.error) {
          // If profile fetch fails, just use displayName or null
          setFirstName(user.displayName || null)
          return
        }

        if (!cancelled) {
          setFirstName(json.user?.firstName || user.displayName || null)
        }
      } catch (error) {
        if (!cancelled) {
          // Fallback to displayName if available
          setFirstName(user.displayName || null)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [user])

  // If user is not logged in
  if (!user) {
    return (
      <div className="border-t border-gray-200 px-4 py-4 md:hidden">
        <SheetClose asChild>
          <Link
            href={`/${lng}/signin`}
            className="block w-full rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors duration-200 p-4 border border-gray-200"
          >
            <div className="flex items-center justify-center">
              <div className="text-center">
                <div className="text-sm font-medium text-gray-900 mb-1">
                  {lng === 'he' ? '👋 התחברו לחשבון שלכם' : '👋 Sign in to your account'}
                </div>
                <div className="text-xs text-gray-600">
                  {lng === 'he' 
                    ? 'לצפייה בפרופיל, הזמנות ומועדון הלקוחות'
                    : 'View your profile, orders, and customer club'}
                </div>
              </div>
            </div>
          </Link>
        </SheetClose>
      </div>
    )
  }

  // If user is logged in
  const displayName = firstName || (lng === 'he' ? 'היי, כיף לראות אותך כאן 🙂' : 'Hi, nice to see you here 🙂')
  const greeting = firstName 
    ? (lng === 'he' ? `היי ${firstName}, כיף לראות אותך כאן 🙂` : `Hi ${firstName}, nice to see you here 🙂`)
    : displayName

  return (
    <div className="border-t border-gray-200 px-4 py-4 md:hidden">
      <SheetClose asChild>
        <Link
          href={`/${lng}/profile`}
          className={`block w-full rounded-lg bg-gradient-to-br from-gray-50 to-gray-100 hover:from-gray-100 hover:to-gray-200 transition-all duration-200 p-4 border border-gray-200 shadow-sm active:scale-[0.98] ${lng === 'he' ? 'text-right' : 'text-left'}`}
          dir={lng === 'he' ? 'rtl' : 'ltr'}
        >
          <div className="flex items-center gap-3" dir={lng === 'he' ? 'rtl' : 'ltr'}>
            <div className="flex-shrink-0">
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-gray-900 mb-1 leading-tight">
                {loading ? (lng === 'he' ? 'טוען...' : 'Loading...') : greeting}
              </div>
              <div className="text-xs text-gray-600 flex items-center gap-1">
                <span>
                  {lng === 'he' ? 'לצפייה בפרופיל האישי שלך' : 'View your personal profile'}
                </span>
                {lng === 'he' ? (
                  <ArrowLeft className="h-3 w-3" />
                ) : (
                  <ArrowRight className="h-3 w-3" />
                )}
              </div>
            </div>
          </div>
        </Link>
      </SheetClose>
    </div>
  )
}

