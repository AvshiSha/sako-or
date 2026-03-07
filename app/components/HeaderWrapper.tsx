'use client'

import PromoSection from '@/app/components/PromoSection'
import Navigation from '@/app/components/Navigation'

interface HeaderWrapperProps {
  lng: 'en' | 'he'
  targetDate?: Date | string
}

export default function HeaderWrapper({ lng, targetDate }: HeaderWrapperProps) {
  return (
    <header className="sticky top-0 z-[65] w-full">
      <PromoSection lng={lng} targetDate={targetDate} />
      <Navigation lng={lng} />
    </header>
  )
}
