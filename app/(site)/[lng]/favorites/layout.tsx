import { ReactNode } from 'react'
import type { Metadata } from 'next'

// Per-visitor state (guest localStorage or account data), not content.
// Already excluded from the sitemap for the same reason.
export const metadata: Metadata = {
  robots: { index: false, follow: true },
}

interface FavoritesLayoutProps {
  children: ReactNode
  params: Promise<{
    lng: string
  }>
}

export default async function FavoritesLayout({ children, params }: FavoritesLayoutProps) {
  const { lng } = await params
  const isRTL = lng === 'he'

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className={isRTL ? 'rtl' : 'ltr'}>
      {children}
    </div>
  )
}
