'use client'

import { useMemo } from 'react'
import { SparklesIcon } from '@heroicons/react/24/outline'
import { profileTheme } from './profileTheme'

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

interface ProfilePointsBlockProps {
  pointsHistory: PointsTransaction[]
  pointsLoading: boolean
  locale: string
  translations: {
    pointsHistory: string
    pointsHelp: string
    noPointsActivityYet: string
    earnedPoints: string
    spentPoints: string
    orderNumber: (n: string) => string
  }
}

export default function ProfilePointsBlock({
  pointsHistory,
  pointsLoading,
  locale,
  translations: t
}: ProfilePointsBlockProps) {
  return (
    <div className={profileTheme.section}>
      <h3 className={profileTheme.sectionTitle}>{t.pointsHistory}</h3>
      <p className="text-sm text-gray-600 mb-4">
        {t.pointsHelp}
      </p>

      {pointsLoading ? (
        <div className="animate-pulse space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 rounded"></div>
          ))}
        </div>
      ) : pointsHistory.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <SparklesIcon className="h-12 w-12 mx-auto mb-2 text-gray-300" />
          <p>{t.noPointsActivityYet}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {pointsHistory.map((transaction) => (
            <div
              key={transaction.id}
              className="flex justify-between items-center py-3 border-b border-gray-100 last:border-0"
            >
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {transaction.kind === 'EARN' ? t.earnedPoints : t.spentPoints}
                </p>
                {transaction.order && (
                  <p className="text-xs text-gray-500">
                    {t.orderNumber(transaction.order.orderNumber)}
                  </p>
                )}
                <p className="text-xs text-gray-400">
                  {new Date(transaction.createdAt).toLocaleDateString(locale, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </p>
              </div>
              <div
                className={`text-lg font-bold ${
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
  )
}

