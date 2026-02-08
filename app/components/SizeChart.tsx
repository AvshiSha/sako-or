'use client'

import { useState } from 'react'
import Image from 'next/image'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from '@/app/components/ui/sheet'
import { X } from 'lucide-react'
import { FaWhatsapp } from 'react-icons/fa'

interface SizeChartProps {
  isOpen: boolean
  onClose: () => void
  lng: 'en' | 'he'
}

// Size conversion data: SAKO OR size -> [US, Foot (CM)]
const sizeData: Array<[number, number, number]> = [
  [35, 5, 22.5],
  [36, 6, 23.0],
  [37, 7, 23.5],
  [38, 8, 24.0],
  [39, 9, 24.5],
  [40, 10, 25.0],
  [41, 11, 25.5],
  [42, 12, 26.0],
  [43, 13, 26.5],
  [44, 14, 27.0],
  [45, 15, 27.5],
  [46, 16, 28.0],
]

const translations = {
  en: {
    title: 'Size Guide',
    sakoSize: 'SAKO size',
    usSize: 'US size',
    footCm: 'Foot (CM)',
    descriptionTitle: 'What size am I?',
    descriptionCollapsed: 'What size am I? The SAKO internal shoe measurement is displayed in the first column (HEEL-TOE CM). It indicates the actual internal measurement of the shoe. Use this to find your ideal size.',
    descriptionFull: `What size am I? The SAKO internal shoe measurement is displayed in the first column (HEEL-TOE CM). It indicates the actual internal measurement of the shoe. Use this to find your ideal size.

Our footwear is crafted according to European sizing. Use the Size Guide to find the right size. If you are unsure about which size is best for you, please follow the steps.

1. Measure your feet by standing up straight on a hard surface with your heel against the wall.
2. Beneath your foot, tape a blank piece of paper to the floor and mark the longest part of your foot on the paper. This is called 'heel-to-toe' length.
3. Repeat with the other foot, as left and right sizes might be different.
4. Use a ruler to measure the heel-to-toe length you have marked on the paper.
5. We recommend leaving 5–10mm of spare room for a comfortable fit.`,
    readMore: 'Read more',
    readLess: 'Read less',
    contactMessage: "Still not sure? We're here to help.",
    contactWhatsApp: 'Contact us on WhatsApp',
    contactPage: 'Contact us',
  },
  he: {
    title: 'מדריך מידות',
    sakoSize: 'SAKO size',
    usSize: 'US size',
    footCm: 'כף רגל (ס"מ)',
    descriptionTitle: 'איזו מידה אני?',
    descriptionCollapsed: 'איזו מידה אני? מידת הנעל הפנימית של SAKO מוצגת בעמודה הראשונה (SAKO size). היא מציינת את המידה הפנימית בפועל של הנעל. השתמשו בה כדי למצוא את המידה האידיאלית שלכם.',
    descriptionFull: `איזו מידה אני? מידת הנעל הפנימית של SAKO מוצגת בעמודה הראשונה (SAKO size). היא מציינת את המידה הפנימית בפועל של הנעל. השתמשו בה כדי למצוא את המידה האידיאלית שלכם.

הנעליים שלנו מיוצרות לפי מידות אירופאיות. השתמשו במדריך המידות כדי למצוא את המידה הנכונה. אם אינכם בטוחים איזו מידה מתאימה לכם ביותר, אנא בצעו את השלבים הבאים.

1. מדדו את כפות הרגליים שלכם על ידי עמידה ישרה על משטח קשה כאשר העקב צמוד לקיר.
2. מתחת לכף הרגל, הדביקו דף נייר ריק לרצפה וסמנו את החלק הארוך ביותר של כף הרגל על הנייר. זה נקרא אורך 'עקב-בוהן'.
3. חזרו על הפעולה עם כף הרגל השנייה, מכיוון שהמידות שמאל וימין עשויות להיות שונות.
4. השתמשו בסרגל כדי למדוד את אורך העקב-בוהן שסימנתם על הנייר.
5. אנו ממליצים להשאיר 5–10 מ"מ של מקום פנוי להתאמה נוחה.`,
    readMore: 'קרא עוד',
    readLess: 'קרא פחות',
    contactMessage: 'עדיין לא בטוחים? אנחנו כאן לעזור.',
    contactWhatsApp: 'צרו קשר ב-WhatsApp',
    contactPage: 'צרו קשר במייל',
  },
}

export default function SizeChart({ isOpen, onClose, lng }: SizeChartProps) {
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false)
  const t = translations[lng]
  const isRTL = lng === 'he'
  const phoneNumber = '+972504487979'
  const defaultMessage = isRTL 
    ? 'היי, אשמח לעזרה עם בחירת מידה' 
    : 'Hi, I need help choosing the right size'
  const encodedMessage = encodeURIComponent(defaultMessage)
  const whatsappUrl = `https://wa.me/${phoneNumber.replace(/[^0-9]/g, '')}?text=${encodedMessage}`

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent
        side="bottom"
        className="h-[90vh] max-h-[800px] overflow-hidden p-0 flex flex-col rounded-t-2xl [&>button]:hidden"
        dir={isRTL ? 'rtl' : 'ltr'}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-gray-200 relative">
          <SheetClose className="absolute top-7 left-6 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none z-10">
            <X className="h-6 w-6 text-gray-900" />
            <span className="sr-only">Close</span>
          </SheetClose>
          <SheetTitle className="text-2xl font-bold text-gray-900 text-center">
            {t.title}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {/* Size Table */}
          <div className="mb-8">
            <div className="overflow-x-auto -mx-8 px-2" style={{ position: 'relative'}}>
              <div className="inline-block min-w-full align-middle">
                <table className="w-full border-collapse min-w-[600px]">
                  <thead>
                    <tr className="border-b-2 border-gray-300">
                      <th 
                        className={`${isRTL ? 'text-right' : 'text-left'} py-3 px-4 font-semibold text-gray-900 border-r border-gray-200`}
                        style={{ 
                          position: 'sticky',
                          insetInlineStart: 0,
                          zIndex: 3,
                          backgroundColor: 'white',
                          minWidth: '120px',
                          maxWidth: '120px',
                          width: '120px',
                          boxShadow: isRTL 
                            ? '4px 0 6px rgba(0, 0, 0, 0.05)' 
                            : '-4px 0 6px rgba(0, 0, 0, 0.05)'
                        }}
                      >
                        {t.sakoSize}
                      </th>
                      {sizeData.map(([sakoSize], index) => (
                        <th
                          key={sakoSize}
                          className={`text-center py-3 px-3 font-semibold text-gray-900 bg-white min-w-[60px] ${
                            index < sizeData.length ? 'border-r border-gray-200' : ''
                          }`}
                        >
                          {sakoSize}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {/* US row */}
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <td 
                        className={`py-3 px-4 text-gray-900 font-semibold border-r border-gray-200`}
                        style={{ 
                          position: 'sticky',
                          insetInlineStart: 0,
                          zIndex: 3,
                          backgroundColor: '#f9fafb',
                          minWidth: '120px',
                          maxWidth: '120px',
                          width: '120px',
                          boxShadow: isRTL 
                            ? '4px 0 6px rgba(0, 0, 0, 0.05)' 
                            : '-4px 0 6px rgba(0, 0, 0, 0.05)'
                        }}
                      >
                        {t.usSize}
                      </td>
                      {sizeData.map(([sakoSize, usSize], index) => (
                        <td
                          key={`us-${sakoSize}`}
                          className={`py-3 px-3 text-center text-gray-700 ${
                            index < sizeData.length ? 'border-r border-gray-200' : ''
                          }`}
                        >
                          {usSize}
                        </td>
                      ))}
                    </tr>
                    {/* Foot (CM) row */}
                    <tr className="border-b border-gray-200 bg-white">
                      <td 
                        className={`py-3 px-4 text-gray-900 font-semibold border-r border-gray-200`}
                        style={{ 
                          position: 'sticky',
                          insetInlineStart: 0,
                          zIndex: 3,
                          backgroundColor: 'white',
                          minWidth: '120px',
                          maxWidth: '120px',
                          width: '120px',
                          boxShadow: isRTL 
                            ? '4px 0 6px rgba(0, 0, 0, 0.05)' 
                            : '-4px 0 6px rgba(0, 0, 0, 0.05)'
                        }}
                      >
                        {t.footCm}
                      </td>
                      {sizeData.map(([sakoSize, , footCm], index) => (
                        <td
                          key={`foot-${sakoSize}`}
                          className={`py-3 px-3 text-center text-gray-700 ${
                            index < sizeData.length ? 'border-r border-gray-200' : ''
                          }`}
                        >
                          {footCm.toFixed(1)}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Description Section */}
          <div className="mb-8">
            <div
              className={`text-gray-700 leading-relaxed transition-all duration-300 overflow-hidden ${
                isDescriptionExpanded ? 'max-h-none' : 'max-h-[120px]'
              }`}
            >
              <p className="whitespace-pre-line">
                {isDescriptionExpanded ? t.descriptionFull : t.descriptionCollapsed}
              </p>
            </div>
            <button
              onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
              className="mt-3 text-sm text-[#856D55] hover:text-[#6B5745] underline font-medium transition-colors"
            >
              {isDescriptionExpanded ? t.readLess : t.readMore}
            </button>
          </div>

          {/* Measurement Image */}
          <div className="mb-8">
            <div className="w-full max-w-md mx-auto">
              <div className="relative w-full aspect-[4/3.2] bg-gray-100 rounded-lg overflow-hidden">
                <Image
                  src="/images/size-guide/measurement-guide.webp"
                  alt={isRTL ? 'מדריך מדידה' : 'Measurement Guide'}
                  fill
                  className="object-contain"
                  loading="lazy"
                  onError={(e) => {
                    // Fallback if image doesn't exist - hide the container
                    const target = e.target as HTMLImageElement
                    const container = target.closest('div')
                    if (container) {
                      container.style.display = 'none'
                    }
                  }}
                />
              </div>
            </div>
          </div>

          {/* Contact Section */}
          <div className="border-t border-gray-200 pt-6 text-center">
            <p className="text-gray-600 mb-4 text-base">
              {t.contactMessage}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#856D55] hover:bg-[#6B5745] text-white rounded-md font-medium transition-colors duration-200"
              >
                <FaWhatsapp className="w-5 h-5" />
                {t.contactWhatsApp}
              </a>
              <a
                href={`/${lng}/contact`}
                className="inline-flex items-center px-6 py-3 border border-gray-300 hover:border-gray-400 text-gray-700 rounded-md font-medium transition-colors duration-200"
              >
                {t.contactPage}
              </a>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

