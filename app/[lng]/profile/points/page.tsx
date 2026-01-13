'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { SparklesIcon } from '@heroicons/react/24/outline'
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card'
import { Button } from '@/app/components/ui/button'

const translations = {
  en: {
    pageTitle: 'My Points',
    comingSoon: 'Coming Soon',
    description: 'Detailed points history and redemption options will be available soon.',
    backToProfile: 'Back to Profile'
  },
  he: {
    pageTitle: 'הנקודות שלי',
    comingSoon: 'בקרוב',
    description: 'היסטוריית נקודות מפורטת ואפשרויות מימוש יהיו זמינים בקרוב.',
    backToProfile: 'חזרה לפרופיל'
  }
} as const

export default function PointsPage() {
  const params = useParams()
  const lng = (params?.lng as string) || 'en'
  const t = (translations as any)[lng] || translations.en

  return (
    <div className="pt-6 pb-20 md:pb-6 mt-4">
      <Card className="shadow-[0_4px_20px_rgba(15,23,42,0.08)]">
        <CardHeader>
          <CardTitle className="text-xl md:text-2xl">{t.pageTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-10 md:py-12 text-center">
            <SparklesIcon className="h-14 w-14 md:h-16 md:w-16 text-gray-400 mb-4" />
            <h3 className="text-lg md:text-xl font-semibold text-gray-900 mb-2">
              {t.comingSoon}
            </h3>
            <p className="text-sm md:text-base text-gray-600 mb-6 max-w-md px-4">
              {t.description}
            </p>
            <Link href={`/${lng}/profile`}>
              <Button variant="outline" className="text-sm md:text-base">
                {t.backToProfile}
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

