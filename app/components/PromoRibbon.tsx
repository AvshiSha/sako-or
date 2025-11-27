'use client'

import Link from 'next/link'

interface PromoRibbonProps {
  lng: 'en' | 'he'
}

export default function PromoRibbon({ lng }: PromoRibbonProps) {
  const text = lng === 'he' 
    ? '25% הנחה על מוצרים נבחרים + 10% הנחה באאוטלט עם הקוד: OUT10 ✨' 
    : '25% off on selected products + 10% discount with code: OUT10 ✨'

  return (
    <div className="fixed top-0 left-0 right-0 bg-gradient-to-r from-black to-gray-900 text-white h-10 z-[60]">
      <div className="max-w-7xl mx-auto h-full flex items-center justify-center px-4">
        <Link
          href={`/${lng}/collection/campaign?slug=black-friday`}
          className="text-center hover:underline font-medium text-sm md:text-base"
        >
          {text}
        </Link>
      </div>
    </div>
  )
}

