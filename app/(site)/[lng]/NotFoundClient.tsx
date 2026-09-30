'use client'

import { useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import type { Product } from '@/lib/firebase'
import ProductCarousel from '@/app/components/ProductCarousel'

interface Props {
  products: Product[]
}

/**
 * Copy is line-addressed rather than one string per field because both frames
 * break the headline over four lines and the desktop frame breaks the body over
 * two. Rendering the breaks from data keeps them out of the markup.
 *
 * Only Hebrew is drawn (404 / Desktop 438:3397, 404 / Mobile 438:3853). The
 * English set mirrors it line for line so the layout holds in both directions.
 *
 * The two frames disagree on the body copy and the button label - mobile offers
 * a collection link that neither frame actually draws, so the desktop wording is
 * used at both sizes rather than swapping strings at a breakpoint.
 */
const copy = {
  en: {
    label: '404',
    headline: ['Oops!', 'This page', "doesn't lead", 'anywhere'],
    body: [
      'The page you were looking for moved, changed or simply was never here.',
      'You can head back to the home page.',
    ],
    cta: 'Take me back',
    carouselTitle: 'Best Sellers',
  },
  he: {
    label: '404',
    headline: ['אופס!', 'הדף הזה', 'לא מוביל', 'לשום מקום'],
    body: [
      'העמוד שחיפשת זז, השתנה או פשוט לא היה כאן.',
      'אפשר לחזור חזרה לדף הבית.',
    ],
    cta: 'קח אותי בחזרה',
    carouselTitle: 'הנמכרים ביותר',
  },
}

export default function NotFoundClient({ products }: Props) {
  const params = useParams()
  const lng = (params?.lng as string) || 'he'
  const isRTL = lng !== 'en'
  const t = isRTL ? copy.he : copy.en

  // Analytics: fire once on mount, matching the product-level 404 event so both
  // land in the same report with the same shape.
  useEffect(() => {
    window.dataLayer = window.dataLayer || []
    window.dataLayer.push({
      event: 'page_not_found',
      requested_url: window.location.href,
      referrer: document.referrer || null,
      timestamp: new Date().toISOString(),
    })
  }, [])

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'}>
      {/* ── 404 hero (438:3397 desktop / 438:3853 mobile) ──
          Both frames are a full-viewport olive-900 ground with the type block on
          the inline-start edge and the numeral art on the opposite bottom corner.
          Everything below is written with logical properties, so the English
          build mirrors rather than keeping the Hebrew frame's physical sides.

          The min-height floors the frames' own heights (844 / 1080) but yields to
          the content on a short viewport - it is a floor, not a cap, so nothing
          clips when the headline is tall. */}
      <section className="relative flex min-h-[calc(100svh-71px)] flex-col justify-between overflow-clip bg-sako-olive-900 lg:min-h-[min(1080px,calc(100svh-73px))]">
        {/* The desktop frame indents the type block by 97px of its 1728 - 5.614% -
            and sets the headline at 154px, 8.912% of the same width. Both are held
            as that fraction of the viewport up to the frame width and pinned to the
            drawn pixel value beyond it. Keeping the pair in proportion is what
            preserves the ~97px channel between the type and the numeral art at
            every desktop width; fixing either one in pixels closes it. */}
        <div className="relative z-10 flex flex-col items-start pt-[70px] pb-[70px] ps-[16px] pe-[16px] text-start lg:pt-[98px] lg:pb-[22px] lg:ps-[min(5.614vw,97px)] lg:pe-0">
          <div className="flex w-full flex-col items-start lg:max-w-[767px]">
            <p className="font-ploni text-[9px] leading-none tracking-[1.17px] text-sako-gray-100 lg:text-[12px]">
              {t.label}
            </p>

            {/* Mobile draws this in Ploni UltraBold, desktop in Black. Only 400 /
                600 / 700 / 900 are loaded (RootShell), and the design system's own
                H1 style is Black, so both sizes render Black rather than pulling a
                fifth weight over the wire for one page. */}
            <h1 className="mt-[10px] font-ploni text-[60px] font-black leading-[50px] text-sako-gray-100 lg:text-[min(8.912vw,154px)] lg:leading-[0.779]">
              {t.headline.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </h1>

            {/* The second line is its own break only from lg: the mobile frame runs
                the body as one wrapped paragraph. A span that goes block at the
                breakpoint gives both without a styled <br>. */}
            <p className="mt-[20px] font-ploni text-[14px] leading-normal text-sako-gray-100 lg:mt-[47px] lg:text-[21px] lg:leading-[32.55px]">
              {t.body[0]}{' '}
              <span className="lg:block">{t.body[1]}</span>
            </p>

            {/* Label first, arrow second: under RTL that lands the label on the
                right and the arrow on the left, which is how both frames draw it,
                and it mirrors correctly for English without a reversal.
                The hover and focus treatments are not in the design - neither frame
                draws a state - so they are the plainest inversion of the resting
                bar rather than anything invented on top of it. */}
            <Link
              href={`/${lng}`}
              className="group/cta mt-[20px] flex h-[58px] w-full items-center justify-between border border-sako-white bg-sako-white px-[19px] transition-colors hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sako-white focus-visible:ring-offset-2 focus-visible:ring-offset-sako-olive-900 lg:mt-[47px] lg:w-[298px]"
            >
              <span className="font-ploni text-[13px] font-bold text-sako-black transition-colors group-hover/cta:text-sako-white">
                {t.cta}
              </span>
              {/* Decorative. The mobile frame sets the glyph upright and the
                  desktop frame rotates it 90°, which is reproduced as drawn. */}
              <span
                aria-hidden="true"
                className="font-ploni text-[23px] font-bold leading-none text-sako-black transition-colors group-hover/cta:text-sako-white lg:rotate-90"
              >
                ↙
              </span>
            </Link>
          </div>
        </div>

        {/* Numeral art. Two different drawings, not one asset at two sizes: mobile
            is a solid full-bleed numeral, desktop a stroked outline across 57.38%
            of the frame. <picture> so only the one in play is fetched. They share
            an aspect ratio, so a single width per breakpoint sizes both.

            In flow at the bottom of the column on mobile (the frame's own
            justify-between), absolute on the opposite bottom corner from lg, where
            the frame overlaps it with the type block's vertical band. */}
        <div className="relative w-full shrink-0 lg:absolute lg:bottom-0 lg:end-0 lg:w-[57.38%]">
          <picture>
            <source media="(min-width: 1024px)" srcSet="/images/404-outline.svg" />
            <img
              src="/images/404-solid.svg"
              alt=""
              aria-hidden="true"
              className="block h-auto w-full"
            />
          </picture>
        </div>
      </section>

      {/* ── Best sellers ──
          Same carousel the product-level 404 already runs, on the same
          fetchHomeBestSellers feed. */}
      {products.length > 0 && (
        <ProductCarousel
          products={products}
          title={t.carouselTitle}
          language={isRTL ? 'he' : 'en'}
        />
      )}
    </div>
  )
}
