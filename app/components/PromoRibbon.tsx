'use client'

import Link from 'next/link'

interface PromoRibbonProps {
  lng: 'en' | 'he'
}

export default function PromoRibbon({ lng }: PromoRibbonProps) {
  const text = lng === 'he' 
    ? '❤️ Love comes in pairs - מבצע זוגות בדף ולנטיינס › לחצי כאן'  
    : '❤️ Love comes in pairs 💕 BOGO pair sale on the page and newsletter › Click here to see them'

  return (
    <div className="fixed top-0 left-0 right-0 bg-gradient-to-r from-[#B2A28E] to-[#B2A28E] text-white h-10 z-[60]">
      <div className="max-w-7xl mx-auto h-full flex items-center justify-center px-4">
        <Link
          href={`/${lng}/collection/campaign?slug=bogosale`}
          className="text-center hover:underline font-medium text-sm md:text-base"
        >
          {text}
        </Link>
      </div>
    </div>
  )
}

