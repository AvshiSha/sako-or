'use client'

import Link from 'next/link'
import { track } from '@vercel/analytics'

interface PromoRibbonProps {
  lng: 'en' | 'he'
}

export default function PromoRibbon({ lng }: PromoRibbonProps) {
  const text = lng === 'he' 
    ? 'לאור המצב הבטחוני ❤️ 7% הנחה על כל האתר | קוד: SAKO7'
    : 'Due to the security situation ❤️ 7% discount on all products | Code: SAKO7'

  return (
    <div className="fixed top-0 left-0 right-0 bg-gradient-to-r from-[#B2A28E] to-[#B2A28E] text-white h-10 z-[60]">
      <div className="max-w-7xl mx-auto h-full flex items-center justify-center px-4">
        <Link
          href={`/${lng}/collection/women/shoes`}
          className="text-center hover:underline font-medium text-sm md:text-base"
          suppressHydrationWarning
          onClick={() => track('promo_ribbon_click')}
        >
          {text}
        </Link>
      </div>
    </div>
  )
}

