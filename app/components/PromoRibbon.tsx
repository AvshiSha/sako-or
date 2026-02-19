'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { track } from '@vercel/analytics'

const PROMOS: { textEn: string; textHe: string; link?: string }[] = [
  {
    textEn: '🎉 BOGO pair deal – Add 2 items to cart & enjoy a special discount ›',
    textHe: '🎉 מבצע 1+1 – מוסיפות 2 פריטים לעגלה וההנחה כבר מחכה לכן ›',
    link: '/collection/campaign?slug=bogosale',
  },
  {
    textEn: 'New Collection has new drop ›',
    textHe: '✨ הקולקציה החדשה כבר כאן – לחצי וצפי בקולקציה ›',
    link: '/collection/campaign?slug=new-collection',
  },
  {
    textEn: '🚚 Free delivery on all orders over 300 ILS',
    textHe: '🚚 משלוח חינם לכל הארץ בקנייה מעל 300 ש״ח',
  },
]

interface PromoRibbonProps {
  lng: 'en' | 'he'
}

export default function PromoRibbon({ lng }: PromoRibbonProps) {
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setCurrentIndex((i) => (i + 1) % PROMOS.length)
    }, 5000)
    return () => clearInterval(id)
  }, [])

  const promo = PROMOS[currentIndex]
  const href = promo.link ? `/${lng}${promo.link}` : undefined
  const text = lng === 'he' ? promo.textHe : promo.textEn

  const content = (
    <span
      className="block w-full text-center font-medium text-sm md:text-base whitespace-nowrap overflow-hidden text-ellipsis animate-promo-fade"
      suppressHydrationWarning
    >
      {text}
    </span>
  )

  return (
    <div className="fixed top-0 left-0 right-0 bg-gradient-to-r from-[#B2A28E] to-[#B2A28E] text-white h-10 z-[60]">
      <div className="max-w-7xl mx-auto h-full flex items-center justify-center px-4">
        {href ? (
          <Link
            key={currentIndex}
            href={href}
            className="block w-full h-full flex items-center justify-center min-w-0 hover:underline"
            onClick={() => track('promo_ribbon_click')}
          >
            {content}
          </Link>
        ) : (
          <span
            key={currentIndex}
            className="block w-full h-full flex items-center justify-center min-w-0"
          >
            {content}
          </span>
        )}
      </div>
    </div>
  )
}
