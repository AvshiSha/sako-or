'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ShoppingBagIcon } from '@heroicons/react/24/outline'
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card'
import { Button } from '@/app/components/ui/button'

const translations = {
  en: {
    pageTitle: 'My Orders',
    comingSoon: 'Coming Soon',
    description: 'Order history and tracking will be available soon.',
    backToProfile: 'Back to Profile'
  },
  he: {
    pageTitle: 'ההזמנות שלי',
    comingSoon: 'בקרוב',
    description: 'היסטוריית הזמנות ומעקב יהיו זמינים בקרוב.',
    backToProfile: 'חזרה לפרופיל'
  }
} as const

export default function OrdersPage() {
  const params = useParams()
  const lng = (params?.lng as string) || 'en'
  const t = (translations as any)[lng] || translations.en

  return (
    <div className="pb-20 md:pb-6">
      <Card>
        <CardHeader>
          <CardTitle>{t.pageTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <ShoppingBagIcon className="h-16 w-16 text-gray-400 mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {t.comingSoon}
            </h3>
            <p className="text-gray-600 mb-6 max-w-md">
              {t.description}
            </p>
            <Link href={`/${lng}/profile`}>
              <Button variant="outline">
                {t.backToProfile}
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

