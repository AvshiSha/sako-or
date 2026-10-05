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
import { FaWhatsapp } from 'react-icons/fa'
import { Button } from '@/app/components/ui/button'

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
    faqLink: 'Read the full sizing and fit guide',
    close: 'Close',
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
    faqLink: 'למדריך המלא למידות והתאמת נעליים',
    close: 'סגירה',
  },
}

/* The sheet is laid out on the Product Filter drawer's construction (438:3094 /
   438:3579): a section label over its content, closed by a hairline that runs
   edge to edge while the content stays inset. Inset is 24px, 30px from md up.

   Rules carry two weights on purpose - border-default (ink) frames the table and
   divides header from body, border-subtle (the warm #e1dbd6) does the internal
   gridlines. That is the same hierarchy the size selector just above it uses. */
const INSET = 'px-[24px] md:px-[30px]'
/* Pulls the scroller out to the sheet edge so the table can bleed while the
   prose stays inset. The old -mx-8/px-2 pairing did not match its container's
   px-6 and let the first column sit under the padding. */
const BLEED = '-mx-[24px] px-[24px] md:-mx-[30px] md:px-[30px]'

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

  /* Ploni's digits are proportional, so a size table without tabular-nums does
     not align its columns and 22.5 / 23.0 put their decimal points in different
     places. Same reason prices carry it. */
  const numericCell =
    'py-[12px] px-[12px] text-center font-ploni text-[14px] tabular-nums text-text-primary'
  /* The row label column is sticky. The old build faked its edge with a
     box-shadow; the design system documents no elevation, so the edge is a 1px
     ink rule on the inline end - which reads as a table rule, not a float. */
  const stickyLabel =
    'sticky start-0 z-[3] w-[128px] min-w-[128px] max-w-[128px] border-e border-border-default py-[12px] px-[16px] text-start font-ploni text-[14px] font-bold text-text-primary'

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent
        side="bottom"
        className="flex h-[90vh] max-h-[800px] flex-col overflow-hidden rounded-none border-t border-border-default bg-surface-primary p-0 [&>button]:hidden"
        dir={isRTL ? 'rtl' : 'ltr'}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <SheetHeader
          className={`relative border-b border-border-default pb-[16px] pt-[24px] ${INSET}`}
        >
          <SheetClose
            aria-label={t.close}
            className="absolute top-[22px] end-[24px] z-10 p-[8px] text-text-primary opacity-60 transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-default md:end-[30px]"
          >
            {/* Drawn, not imported - the system has no round outline icon set.
                Same hairline cross the toast uses. */}
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </SheetClose>
          {/* Heading/H3 - Ploni Black 20, the system's product-name weight. */}
          <SheetTitle className="text-center font-ploni text-[20px] font-black leading-none text-text-primary">
            {t.title}
          </SheetTitle>
        </SheetHeader>

        <div className={`flex-1 overflow-y-auto py-[24px] ${INSET}`}>
          {/* Size table */}
          <div className={`mb-[32px] overflow-x-auto ${BLEED}`}>
            <table className="w-full min-w-[600px] border-collapse border border-border-default">
              <thead>
                <tr className="border-b border-border-default bg-surface-secondary">
                  <th
                    scope="row"
                    className={`${stickyLabel} bg-surface-secondary`}
                  >
                    {t.sakoSize}
                  </th>
                  {sizeData.map(([sakoSize]) => (
                    <th
                      key={sakoSize}
                      scope="col"
                      className={`${numericCell} min-w-[56px] border-e border-border-subtle font-bold last:border-e-0`}
                    >
                      {sakoSize}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border-subtle">
                  <th scope="row" className={`${stickyLabel} bg-surface-primary`}>
                    {t.usSize}
                  </th>
                  {sizeData.map(([sakoSize, usSize]) => (
                    <td
                      key={`us-${sakoSize}`}
                      className={`${numericCell} border-e border-border-subtle last:border-e-0`}
                    >
                      {usSize}
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row" className={`${stickyLabel} bg-surface-primary`}>
                    {t.footCm}
                  </th>
                  {sizeData.map(([sakoSize, , footCm]) => (
                    <td
                      key={`foot-${sakoSize}`}
                      className={`${numericCell} border-e border-border-subtle last:border-e-0`}
                    >
                      {footCm.toFixed(1)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Description */}
          <div className="mb-[32px]">
            <div
              className={`overflow-hidden font-ploni text-[14px] leading-[1.6] text-text-secondary transition-all duration-300 ${
                isDescriptionExpanded ? 'max-h-none' : 'max-h-[120px]'
              }`}
            >
              <p className="whitespace-pre-line">
                {isDescriptionExpanded ? t.descriptionFull : t.descriptionCollapsed}
              </p>
            </div>
            {/* Same underline idiom as the toast action and the cookie notice
                link, so every secondary link in the system reads alike. */}
            <button
              type="button"
              onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
              className="mt-[12px] font-ploni text-[14px] text-text-primary underline decoration-1 underline-offset-4 transition-opacity hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-default"
            >
              {isDescriptionExpanded ? t.readLess : t.readMore}
            </button>
          </div>

          {/* Measurement image */}
          <div className="mb-[32px]">
            <div className="mx-auto w-full max-w-[448px]">
              <div className="relative aspect-[4/3.2] w-full overflow-hidden bg-surface-secondary">
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

          {/* Contact */}
          <div className="border-t border-border-subtle pt-[24px] text-center">
            <p className="mb-[16px] font-ploni text-[14px] text-text-secondary">
              {t.contactMessage}
            </p>
            <div className="flex flex-col gap-[12px] sm:flex-row sm:justify-center">
              <Button asChild variant="sako" size="sakoBar" className="sm:w-auto sm:px-[32px]">
                <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                  <FaWhatsapp className="h-5 w-5" />
                  {t.contactWhatsApp}
                </a>
              </Button>
              <Button asChild variant="sakoOutlined" size="sakoBar" className="sm:w-auto sm:px-[32px]">
                <a href={`/${lng}/contact`}>{t.contactPage}</a>
              </Button>
            </div>
            <p className="mt-[16px]">
              <a
                href={`/${lng}/faq#faq-section-women`}
                className="font-ploni text-[14px] text-text-primary underline decoration-1 underline-offset-4 transition-opacity hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-default"
              >
                {t.faqLink}
              </a>
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
