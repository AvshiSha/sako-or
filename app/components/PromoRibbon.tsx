'use client'

import Link from 'next/link'

interface PromoRibbonProps {
  lng: 'en' | 'he'
}

export default function PromoRibbon({ lng }: PromoRibbonProps) {
  const text = lng === 'he' 
    ? 'סילבסטר סייל 🔥 10% הנחה על מגוון פריטים, עם הקוד: SILB10' 
    : 'Silvestr Sale 🔥 10% off on selected items, with code: SILB10'

  return (
    <div className="fixed top-0 left-0 right-0 bg-gradient-to-r from-[#B2A28E] to-[#B2A28E] text-white h-10 z-[60]">
      <div className="max-w-7xl mx-auto h-full flex items-center justify-center px-4">
        <Link
          href={`/${lng}/collection/campaign?slug=silvester-sale`}
          className="text-center hover:underline font-medium text-sm md:text-base"
        >
          {text}
        </Link>
      </div>
    </div>
  )
}

