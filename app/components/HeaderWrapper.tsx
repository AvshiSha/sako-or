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
    <>
      {/* The announcement band is ordinary page content: it shows at the top of the
          page, scrolls away with everything else, and comes back when the visitor
          returns to the top. It is deliberately OUTSIDE the <header> below rather
          than a non-sticky child of it - a sticky element is clipped to its own
          parent's box, so a sticky bar inside a static header would unpin the
          moment that header scrolled past. Keeping the two as siblings makes the
          nav's containing block the page column, so it pins for the whole scroll
          with no JS, no measured offsets and nothing to shift during load. */}
      <PromoSection lng={lng} />
      {/* The only persistent element. Its flow position is directly under the
          band, so it travels up with the page and lands on top: 0 exactly as the
          band's last pixel leaves - no gap above it, and no height removed from
          the flow, so nothing below it moves. */}
      <header className="sticky top-0 z-[65] w-full">
        <Navigation lng={lng} initialNavData={initialNavData} />
      </header>
    </>
  )
}
