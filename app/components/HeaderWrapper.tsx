'use client'

import PromoSection from '@/app/components/PromoSection'
import Navigation from '@/app/components/Navigation'

interface HeaderWrapperProps {
  lng: 'en' | 'he'
}

export default function HeaderWrapper({ lng }: HeaderWrapperProps) {
  return (
    <header className="sticky top-0 z-[65] w-full">
      <PromoSection lng={lng} />
      <Navigation lng={lng} />
    </header>
  )
}
