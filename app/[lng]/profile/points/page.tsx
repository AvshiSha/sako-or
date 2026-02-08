'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeftIcon, SparklesIcon } from '@heroicons/react/24/outline'
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card'
import { Button } from '@/app/components/ui/button'
import { useAuth } from '@/app/contexts/AuthContext'
import { profileTheme } from '@/app/components/profile/profileTheme'

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

const translations = {
  en: {
    pageTitle: 'My Points',
    currentBalance: 'Current Balance',
    pointsHistory: 'Points History',
    noPointsActivityYet: 'No points activity yet. Points will appear here after you complete orders.',
    earnedPoints: 'Earned',
    spentPoints: 'Spent',
    orderNumber: (n: string) => `Order ${n}`,
    date: 'Date',
    reason: 'Reason',
    backToProfile: 'Back to Profile',
    loading: 'Loading...',
    points: 'points'
  },
  he: {
    pageTitle: 'הנקודות שלי',
    currentBalance: 'יתרה נוכחית',
    pointsHistory: 'היסטוריית נקודות באתר',
    noPointsActivityYet: 'אין פעילות נקודות עדיין. נקודות יופיעו כאן לאחר שתשלים הזמנות.',
    earnedPoints: 'נצברו',
    spentPoints: 'הוצאו',
    orderNumber: (n: string) => `הזמנה ${n}`,
    date: 'תאריך',
    reason: 'סיבה',
    backToProfile: 'חזרה לפרופיל',
    loading: 'טוען...',
    points: 'נקודות'
  }
} as const

export default function PointsPage() {
  const params = useParams()
  const router = useRouter()
  const lng = (params?.lng as string) || 'en'
  const t = (translations as any)[lng] || translations.en
  const locale = lng === 'he' ? 'he-IL' : 'en-US'
  const isRTL = lng === 'he'

  const { user: firebaseUser, loading: authLoading } = useAuth()
  const [pointsBalance, setPointsBalance] = useState(0)
  const [pointsHistory, setPointsHistory] = useState<PointsTransaction[]>([])
  const [pointsLoading, setPointsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Redirect if not signed in
  useEffect(() => {
    if (authLoading) return
    if (!firebaseUser) {
      router.replace(`/${lng}/signin`)
      return
    }
  }, [firebaseUser, authLoading, router, lng])

  // Load points data
  useEffect(() => {
    if (!firebaseUser || authLoading) return

    let cancelled = false
    ;(async () => {
      setPointsLoading(true)
      setError(null)
      try {
        const token = await firebaseUser.getIdToken()
        const res = await fetch('/api/me/points?limit=10', {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` }
        })

        const json = await res.json().catch(() => ({}))
        if (!res.ok || !json || json.error) {
          throw new Error(json?.error || 'Failed to load points')
        }

        if (!cancelled) {
          setPointsBalance(json.pointsBalance || 0)
          setPointsHistory(json.pointsHistory || [])
        }
      } catch (e: any) {
        console.error('Error loading points:', e)
        if (!cancelled) {
          setError(e?.message || 'Failed to load points')
        }
      } finally {
        if (!cancelled) {
          setPointsLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [firebaseUser, authLoading])

  if (authLoading || pointsLoading) {
    return (
      <div className="pt-6 pb-20 md:pb-6 mt-4">
        <Card className="shadow-[0_4px_20px_rgba(15,23,42,0.08)]">
          <CardHeader>
            <div className={`flex items-center justify-between gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <CardTitle className="text-xl md:text-2xl">{t.pageTitle}</CardTitle>
              <Link
                href={`/${lng}/profile`}
                className="flex items-center text-sm text-[#856D55] hover:text-[#856D55]/80 gap-1 whitespace-nowrap"
              >
                {!isRTL && <ArrowLeftIcon className="h-4 w-4" />}
                {t.backToProfile}
                {isRTL && <ArrowLeftIcon className="h-4 w-4" />}
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="min-h-[400px] flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#856D55] mx-auto"></div>
                <p className="mt-4 text-gray-600">{t.loading}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="pt-6 pb-20 md:pb-6 mt-4">
      <Card className={profileTheme.card}>
        <div className={`${profileTheme.section} flex items-center justify-between gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <h1
            className={`text-xl md:text-2xl font-bold text-gray-900 ${
              isRTL ? 'order-2' : 'order-1'
            }`}
          >
            {t.pageTitle}
          </h1>
          <Link
            href={`/${lng}/profile`}
            className={`flex items-center text-sm text-[#856D55] hover:text-[#856D55]/80 gap-1 whitespace-nowrap ${
              isRTL ? 'order-1' : 'order-2'
            }`}
          >
            {!isRTL && <ArrowLeftIcon className="h-4 w-4" />}
            {t.backToProfile}
            {isRTL && <ArrowLeftIcon className="h-4 w-4" />}
          </Link>
        </div>
        <div className={profileTheme.section}>
          {error ? (
            <div className="text-center py-8 text-red-600">
              <p>{error}</p>
              <Link href={`/${lng}/profile`} className="mt-4 inline-block">
                <Button variant="outline" className="text-sm md:text-base">
                  {t.backToProfile}
                </Button>
              </Link>
            </div>
          ) : (
            <>
              {/* Current Balance */}
              <div className={`mb-6 p-4 rounded-lg ${profileTheme.section} bg-gradient-to-r from-[#856D55]/10 to-[#856D55]/5`}>
                <div className={`flex items-center justify-between ${isRTL ? '' : 'flex-row-reverse'}`}>
                  <SparklesIcon className="h-12 w-12 text-[#856D55]/80" />
                  <div>
                    <p className="text-sm text-gray-600 mb-1 text-center">{t.currentBalance}</p>
                    <p className="text-3xl font-bold text-[#856D55]/80">
                      {pointsBalance.toFixed(2)} {t.points}
                    </p>
                  </div>
                </div>
              </div>

              {/* Points History */}
              <div className={profileTheme.section}>
                <h3 className={profileTheme.sectionTitle}>{t.pointsHistory}</h3>
                
                {pointsHistory.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <SparklesIcon className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                    <p>{t.noPointsActivityYet}</p>
                  </div>
                ) : (
                  <div className="space-y-2 mt-4">
                    {pointsHistory.map((transaction) => (
                      <div
                        key={transaction.id}
                        className="flex justify-between items-start py-3 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors rounded px-2"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className={`text-sm font-medium ${transaction.kind === 'EARN' ? 'text-green-700' : 'text-red-700'}`}>
                              {transaction.kind === 'EARN' ? t.earnedPoints : t.spentPoints}
                            </p>
                            {transaction.order && (
                              <Link
                                href={`/${lng}/profile/orders?orderNumber=${transaction.order.orderNumber}`}
                                className="text-xs text-blue-600 hover:text-blue-800 underline"
                              >
                                {t.orderNumber(transaction.order.orderNumber)}
                              </Link>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mb-1">
                            {transaction.reason}
                          </p>
                          <p className="text-xs text-gray-400">
                            {new Date(transaction.createdAt).toLocaleDateString(locale, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                        <div
                          className={`text-lg font-bold ml-4 ${
                            transaction.kind === 'EARN' ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {transaction.delta > 0 ? '+' : ''}
                          {transaction.delta}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Back Button */}
              <div className="mt-6">
                <Link href={`/${lng}/profile`}>
                  <Button variant="outline" className="w-full md:w-auto text-sm bg-[#856D55]/80 text-white hover:bg-[#856D55]/90">
                    {t.backToProfile}
                  </Button>
                </Link>
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  )
}
