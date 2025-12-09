'use client'

import Link from 'next/link'

interface PromoRibbonProps {
  lng: 'en' | 'he'
}

export default function PromoRibbon({ lng }: PromoRibbonProps) {
  const text = lng === 'he' 
    ? '✨ סוף העונה הגיע! מבצעים שווים על כל קולקציית החורף! ✨' 
    : '✨ The end of the year is here! 30% off on all the new collection! ✨'

  return (
    <div className="fixed top-0 left-0 right-0 bg-gradient-to-r from-black to-gray-900 text-white h-10 z-[60]">
      <div className="max-w-7xl mx-auto h-full flex items-center justify-center px-4">
        <Link
          href={`/${lng}/collection/women/shoes`}
          className="text-center hover:underline font-medium text-sm md:text-base"
        >
          {text}
        </Link>
      </div>
    </div>
  )
}

