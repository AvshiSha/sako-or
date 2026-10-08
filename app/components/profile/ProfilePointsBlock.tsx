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
      <p className="text-sm text-text-secondary mb-4">
        {t.pointsHelp}
      </p>

      {pointsLoading ? (
        <div
          className="min-h-[400px]"
          role="status"
          aria-busy="true"
          aria-label={locale.startsWith('he') ? 'טוען…' : 'Loading…'}
        >
        {/* Rows at the shape the list actually takes, inside the same reserved
            box. A centred spinner left the 400px empty and the content replaced it. */}
        <div className="flex flex-col gap-[14px] py-[8px]">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={`pane-skeleton-${index}`}
              className="flex items-center justify-between gap-4 border-b border-border-subtle pb-[14px] last:border-b-0 last:pb-0"
            >
              <div className="min-w-0 flex-1">
                <div className="sako-skeleton sako-skeleton-muted mb-[8px] h-[14px] w-[58%]" aria-hidden />
                <div className="sako-skeleton sako-skeleton-muted h-[12px] w-[34%]" aria-hidden />
              </div>
              <div className="sako-skeleton sako-skeleton-muted h-[14px] w-[72px] shrink-0" aria-hidden />
            </div>
          ))}
        </div>
        </div>
      ) : pointsHistory.length === 0 ? (
        <div className="text-center py-8 text-sako-gray-500">
          <SparklesIcon className="h-12 w-12 mx-auto mb-2 text-sako-gray-300" />
          <p>{t.noPointsActivityYet}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {pointsHistory.map((transaction) => (
            <div
              key={transaction.id}
              className="flex justify-between items-center py-3 border-b border-border-subtle last:border-0"
            >
              <div>
                <p className="text-sm font-medium text-text-primary">
                  {transaction.kind === 'EARN' ? t.earnedPoints : t.spentPoints}
                </p>
                {transaction.order && (
                  <p className="text-xs text-sako-gray-500">
                    {t.orderNumber(transaction.order.orderNumber)}
                  </p>
                )}
                <p className="text-xs text-sako-gray-500">
                  {new Date(transaction.createdAt).toLocaleDateString(locale, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </p>
              </div>
              <div
                className={`text-lg font-bold ${
                  transaction.kind === 'EARN' ? 'text-text-primary' : 'text-accent-error'
                }`}
              >
                {transaction.delta > 0 ? '+' : ''}
                {transaction.delta.toFixed(2)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

