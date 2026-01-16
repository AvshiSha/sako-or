'use client'

import Link from 'next/link'

interface PromoRibbonProps {
  lng: 'en' | 'he'
}

export default function PromoRibbon({ lng }: PromoRibbonProps) {
  const text = lng === 'he' 
    ? 'עד מוצש! 15% הנחה על הזוג השני בהקלדת קופון: BOG15' 
    : 'Until January 17th! 15% discount on the second pair when using coupon: BOG15'

  return (
    <div className="fixed top-0 left-0 right-0 bg-gradient-to-r from-black to-gray-900 text-white h-10 z-[60]">
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

