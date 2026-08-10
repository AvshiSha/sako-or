import { ReactNode } from 'react'
import type { Metadata } from 'next'

// Per-visitor state, not content. Nothing here is the same for two people and
// nothing here is a useful search result, so keep it out of the index.
// `follow` so the links out of it still count.
export const metadata: Metadata = {
  robots: { index: false, follow: true },
}

interface CartLayoutProps {
  children: ReactNode
  params: Promise<{
    lng: string
  }>
}

export default async function CartLayout({ children, params }: CartLayoutProps) {
  const { lng } = await params
  const isRTL = lng === 'he'

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className={isRTL ? 'rtl' : 'ltr'}>
      {children}
    </div>
  )
}
