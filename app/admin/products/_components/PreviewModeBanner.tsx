'use client'

import { useRouter } from 'next/navigation'
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'

interface PreviewModeBannerProps {
  lng: string
  /** Link to fall back to when this tab has no `window.opener` to close back to (e.g. opened directly). */
  editHref: string
  /** Non-blocking warning for the currently-selected color (e.g. "no images assigned"), shown instead of silently rendering an empty gallery. */
  warning?: string
}

export default function PreviewModeBanner({ lng, editHref, warning }: PreviewModeBannerProps) {
  const router = useRouter()
  const isRTL = lng === 'he'

  const handleReturnToEditing = () => {
    if (typeof window !== 'undefined' && window.opener) {
      window.close()
      return
    }
    window.location.href = editHref
  }

  const handleRefresh = () => {
    router.refresh()
  }

  return (
    <div className="sticky top-0 z-50 w-full" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[#856D55] px-4 py-2 text-white shadow-md">
        <span className="text-sm font-semibold uppercase tracking-wide">
          {lng === 'he' ? 'מצב תצוגה מקדימה — המוצר אינו פורסם' : 'Preview Mode — not published'}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            className="rounded-md border border-white/40 px-3 py-1 text-xs font-medium hover:bg-white/10"
          >
            {lng === 'he' ? 'רענן תצוגה מקדימה' : 'Refresh preview'}
          </button>
          <button
            type="button"
            onClick={handleReturnToEditing}
            className="rounded-md bg-white px-3 py-1 text-xs font-medium text-[#856D55] hover:bg-white/90"
          >
            {lng === 'he' ? 'חזרה לעריכה' : 'Return to editing'}
          </button>
        </div>
      </div>
      {warning && (
        <div className="flex items-center gap-2 bg-amber-50 px-4 py-2 text-sm text-amber-800 border-b border-amber-200">
          <ExclamationTriangleIcon className="h-4 w-4 flex-shrink-0" />
          <span>{warning}</span>
        </div>
      )}
    </div>
  )
}
