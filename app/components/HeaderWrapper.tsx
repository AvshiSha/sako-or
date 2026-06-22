'use client'

import PromoSection from '@/app/components/PromoSection'
import Navigation from '@/app/components/Navigation'
import type { NavigationCategoriesData } from '@/lib/navigation-categories'

interface HeaderWrapperProps {
  lng: 'en' | 'he'
  initialNavData: NavigationCategoriesData
}

export default function HeaderWrapper({ lng, initialNavData }: HeaderWrapperProps) {
  return (
    <header className="sticky top-0 z-[65] w-full">
      <PromoSection lng={lng} />
      <Navigation lng={lng} initialNavData={initialNavData} />
    </header>
  )
}
