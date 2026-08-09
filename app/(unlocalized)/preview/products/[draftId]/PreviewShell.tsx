'use client'

import { useState } from 'react'
import {
  ComputerDesktopIcon,
  DevicePhoneMobileIcon,
  ArrowPathIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'

interface PreviewShellProps {
  draftId: string
  token: string
  lng: 'en' | 'he'
  defaultColorSlug: string
  sourceProductId: string | null
}

type Viewport = 'desktop' | 'mobile'

export default function PreviewShell({ draftId, token, lng, defaultColorSlug, sourceProductId }: PreviewShellProps) {
  const [viewport, setViewport] = useState<Viewport>('desktop')
  const [activeLng, setActiveLng] = useState<'en' | 'he'>(lng)
  const [refreshKey, setRefreshKey] = useState(0)

  const editHref = sourceProductId ? `/admin/products/${sourceProductId}/edit` : '/admin/products/new'
  const iframeSrc = `/preview/products/${draftId}/${defaultColorSlug}?token=${encodeURIComponent(token)}&lng=${activeLng}`

  const handleClose = () => {
    if (typeof window !== 'undefined' && window.opener) {
      window.close()
      return
    }
    window.location.href = editHref
  }

  return (
    <div className="flex h-screen flex-col bg-gray-100">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-2 shadow-sm">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setViewport('desktop')}
            className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium ${
              viewport === 'desktop' ? 'bg-[#856D55] text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <ComputerDesktopIcon className="h-4 w-4" />
            Desktop
          </button>
          <button
            type="button"
            onClick={() => setViewport('mobile')}
            className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium ${
              viewport === 'mobile' ? 'bg-[#856D55] text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <DevicePhoneMobileIcon className="h-4 w-4" />
            Mobile
          </button>

          <div className="mx-2 h-5 w-px bg-gray-200" />

          <button
            type="button"
            onClick={() => setActiveLng('en')}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              activeLng === 'en' ? 'bg-[#856D55] text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            EN
          </button>
          <button
            type="button"
            onClick={() => setActiveLng('he')}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              activeLng === 'he' ? 'bg-[#856D55] text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            עברית
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setRefreshKey((key) => key + 1)}
            className="flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <ArrowPathIcon className="h-4 w-4" />
            Refresh preview
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="flex items-center gap-1 rounded-md bg-[#856D55] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#6f5a45]"
          >
            <XMarkIcon className="h-4 w-4" />
            Close preview
          </button>
        </div>
      </div>

      <div className="flex flex-1 items-start justify-center overflow-auto p-4">
        <iframe
          key={refreshKey}
          title="Product preview"
          src={iframeSrc}
          className={`h-full border border-gray-300 bg-white shadow-lg transition-all ${
            viewport === 'mobile' ? 'w-[390px] rounded-[2rem]' : 'w-full rounded-lg'
          }`}
        />
      </div>
    </div>
  )
}
