'use client'

import Link from 'next/link'

interface PromoRibbonProps {
  lng: 'en' | 'he'
}

export default function PromoRibbon({ lng }: PromoRibbonProps) {
  const text = lng === 'he'
    ? '✨ סוף שבוע בסכו עור | 15% על הזוג השני | קוד: BOG15'
    : '✨ End of week at Sako Or | 15% on the second pair | Code: BOG15'

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

