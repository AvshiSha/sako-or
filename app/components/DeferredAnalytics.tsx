'use client'

import { useEffect } from 'react'
import { hasCookieNoticeBeenSeen } from '@/lib/cookies'
import { loadGoogleTagManager } from '@/lib/loadAnalytics'

export const COOKIE_NOTICE_SEEN_EVENT = 'cookie-notice-seen'

function scheduleGtmLoad(): void {
  const load = () => loadGoogleTagManager()
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(load, { timeout: 3000 })
  } else {
    window.setTimeout(load, 1500)
  }
}

export default function DeferredAnalytics() {
  useEffect(() => {
    if (hasCookieNoticeBeenSeen()) {
      scheduleGtmLoad()
    }

    const onNoticeSeen = () => scheduleGtmLoad()
    window.addEventListener(COOKIE_NOTICE_SEEN_EVENT, onNoticeSeen)
    return () => window.removeEventListener(COOKIE_NOTICE_SEEN_EVENT, onNoticeSeen)
  }, [])

  return null
}
