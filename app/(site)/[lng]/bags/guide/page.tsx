import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { buildMetadata } from '@/lib/seo'
import { languages } from '@/i18n/settings'
import { getCachedBagsGuide, type BagGuideEntry } from '@/lib/server/bags-guide-data'

/**
 * A single page listing every bag with its full specification.
 *
 * Two audiences, same content. A shopper gets a comparison table instead of
 * opening twenty product pages to find the one that takes an A4 folder. The
 * sales assistant gets the one thing it cannot assemble from individual product
 * pages: the whole range side by side, so "three crossbody bags under ₪500 that
 * fit a laptop" is answerable. It is reached the way every other page is — via
 * the sitemap — so no separate feed or crawler configuration is involved.
 */

const translations = {
  he: {
    title: 'מדריך התיקים',
    subtitle:
      'כל התיקים שלנו במקום אחד, עם המידות והמפרט המלא — כדי שתוכלו להשוות ולמצוא את התיק שמתאים בדיוק למה שאתם צריכים לשאת.',
    inStock: 'במלאי',
    outOfStock: 'אזל',
    colours: 'צבעים',
    from: 'מחיר',
    instead: 'במקום',
    viewProduct: 'לעמוד המוצר',
    noBags: 'אין כרגע תיקים להצגה.',
    specs: 'מפרט',
    sku: 'מספר דגם',
    updated: 'מלאי ומחירים מתעדכנים באופן שוטף.',
  },
  en: {
    title: 'Bag Guide',
    subtitle:
      'Every bag we sell, with its full measurements and specification — so you can compare them side by side and find the one that fits what you actually need to carry.',
    inStock: 'In stock',
    outOfStock: 'Out of stock',
    colours: 'Colours',
    from: 'Price',
    instead: 'was',
    viewProduct: 'View product',
    noBags: 'There are no bags to show right now.',
    specs: 'Specification',
    sku: 'SKU',
    updated: 'Stock and prices are updated continuously.',
  },
}

type GuideTranslations = (typeof translations)['en']

export const revalidate = 1800

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lng: string }>
}): Promise<Metadata> {
  const { lng } = await params
  const locale = lng as 'en' | 'he'
  const t = translations[locale] ?? translations.en

  const alternateLocales = languages
    .filter((language) => language !== locale)
    .map((altLng) => ({ locale: altLng, url: `/${altLng}/bags/guide` }))

  return buildMetadata({
    title: locale === 'he' ? 'מדריך התיקים | סכו עור' : 'Bag Guide | SAKO-OR',
    description: t.subtitle,
    url: `/${lng}/bags/guide`,
    type: 'website',
    locale,
    alternateLocales,
  })
}

function priceLabel(entry: BagGuideEntry, t: GuideTranslations): string {
  if (entry.salePrice !== null && entry.salePrice < entry.price) {
    return `₪${entry.salePrice.toFixed(2)} (${t.instead} ₪${entry.price.toFixed(2)})`
  }
  return `₪${entry.price.toFixed(2)}`
}

export default async function BagsGuidePage({
  params,
}: {
  params: Promise<{ lng: string }>
}) {
  const { lng } = await params
  if (lng !== 'en' && lng !== 'he') notFound()

  const locale = lng
  const isRTL = locale === 'he'
  const t = translations[locale] ?? translations.en
  const bags = await getCachedBagsGuide(locale)

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10" dir={isRTL ? 'rtl' : 'ltr'}>
      <header className="mb-10">
        <h1 className="text-3xl font-bold text-gray-900">{t.title}</h1>
        <p className="mt-3 max-w-3xl text-gray-600 leading-relaxed">{t.subtitle}</p>
        <p className="mt-2 text-sm text-gray-500">{t.updated}</p>
      </header>

      {bags.length === 0 ? (
        <p className="text-gray-600">{t.noBags}</p>
      ) : (
        <div className="space-y-10">
          {bags.map((entry) => {
            const primaryColour = entry.colours.find((colour) => colour.inStock) ?? entry.colours[0]
            const allRows = [...entry.measurementRows, ...entry.bagRows]

            return (
              <article
                key={entry.sku}
                className="border border-gray-200 rounded-lg p-5 sm:p-6 bg-white"
              >
                <div className="flex flex-col sm:flex-row gap-6">
                  {primaryColour?.image && (
                    <div className="shrink-0">
                      <Image
                        src={primaryColour.image}
                        alt={`${entry.title} — ${primaryColour.colorName}`}
                        width={160}
                        height={160}
                        className="w-40 h-40 object-cover rounded-md"
                      />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <h2 className="text-xl font-semibold text-gray-900">{entry.title}</h2>
                      <span
                        className={`text-sm ${entry.anyInStock ? 'text-green-700' : 'text-gray-500'}`}
                      >
                        {entry.anyInStock ? t.inStock : t.outOfStock}
                      </span>
                    </div>

                    <p className="mt-1 text-sm text-gray-500">
                      {t.sku}: {entry.sku}
                    </p>
                    <p className="mt-1 text-base text-gray-900">
                      {t.from}: {priceLabel(entry, t)}
                    </p>

                    {entry.description && (
                      <p className="mt-3 text-sm text-gray-600 leading-relaxed line-clamp-3">
                        {entry.description}
                      </p>
                    )}

                    <div className="mt-4">
                      <h3 className="text-sm font-medium text-gray-900">{t.colours}</h3>
                      <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-700">
                        {entry.colours.map((colour) => (
                          <li key={colour.colorSlug}>
                            <Link href={colour.url} className="underline hover:text-gray-900">
                              {colour.colorName}
                            </Link>
                            <span className="text-gray-500">
                              {' '}
                              — {colour.inStock ? t.inStock : t.outOfStock}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                {allRows.length > 0 && (
                  <div className="mt-6 border-t border-gray-200 pt-4">
                    <h3 className="text-sm font-medium text-gray-900 mb-3">{t.specs}</h3>
                    <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-2">
                      {allRows.map((row) => (
                        <div key={row.key} className="flex justify-between gap-4 text-sm">
                          <dt className="text-gray-600">{row.label}</dt>
                          <dd className="text-gray-900 text-right">{row.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                )}

                {primaryColour && (
                  <div className="mt-5">
                    <Link
                      href={primaryColour.url}
                      className="inline-block text-sm font-medium underline hover:text-gray-900"
                    >
                      {t.viewProduct}
                    </Link>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}
    </main>
  )
}
