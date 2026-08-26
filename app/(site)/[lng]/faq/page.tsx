import Link from 'next/link'

import type { Metadata } from 'next'
import { faqService } from '@/lib/firebase'
import { buildMetadata, buildBreadcrumbStructuredData, seoConfig } from '@/lib/seo'
import { languages } from '@/i18n/settings'
import RichContent from '@/app/components/RichContent'
import {
  FAQ_AUDIENCES,
  FAQ_SETTINGS_FALLBACK,
  type FaqAudience,
  type FaqPageSettings,
} from '@/lib/faq-types'
import { groupFaqsByAudience } from '@/lib/faq-order'
import { pickLocalized, selectRenderableFaqs, getFaqLastModified } from '@/lib/faq-selectors'
import { buildFaqPageStructuredData, serializeJsonLd } from '@/lib/faq-schema'
import FaqAccordionClient from './_components/FaqAccordionClient'
import FaqAudienceSection from './_components/FaqAudienceSection'

/**
 * Statically generated with a 24-hour ISR floor, matching the terms page. Every
 * FAQ mutation calls revalidateFaqSurfaces(), so admin edits appear within
 * seconds; this is only the backstop for a revalidation that never fired.
 */
export const revalidate = 86400

const BASE_URL = seoConfig.baseUrl.replace(/\/$/, '')

interface FaqPageProps {
  params: Promise<{ lng: string }>
}

/** Settings with the fallback copy filled in, so the page is never blank. */
function resolveSettings(settings: FaqPageSettings | null) {
  return {
    ...FAQ_SETTINGS_FALLBACK,
    ...(settings ?? {}),
    sectionTitles: settings?.sectionTitles ?? FAQ_SETTINGS_FALLBACK.sectionTitles,
    primaryCta: settings?.primaryCta ?? FAQ_SETTINGS_FALLBACK.primaryCta,
    secondaryCta: settings?.secondaryCta ?? FAQ_SETTINGS_FALLBACK.secondaryCta,
  }
}

export async function generateMetadata({ params }: FaqPageProps): Promise<Metadata> {
  const { lng } = await params
  const locale = lng as 'en' | 'he'

  const [items, rawSettings] = await Promise.all([
    faqService.getPublishedFaqs(),
    faqService.getFaqPageSettings(),
  ])
  const settings = resolveSettings(rawSettings)
  const published = selectRenderableFaqs(items, locale)

  return buildMetadata({
    title: pickLocalized(settings.seoTitle, locale) || pickLocalized(settings.heading, locale),
    description: pickLocalized(settings.seoDescription, locale),
    url: `/${lng}/faq`,
    image: settings.ogImage,
    locale,
    // buildMetadata only emits hreflang when there is a real cluster, and adds
    // the self-reference plus x-default -> he itself.
    alternateLocales: languages
      .filter((l) => l !== locale)
      .map((altLng) => ({ locale: altLng, url: `/${altLng}/faq` })),
    // A page with nothing published on it has no business in the index, whatever
    // the admin set. Once questions exist, the admin's directive applies.
    robots: published.length === 0 ? 'noindex, follow' : settings.robots,
  })
}

export default async function FaqPage({ params }: FaqPageProps) {
  const { lng } = await params
  const locale = lng as 'en' | 'he'
  const isRTL = locale === 'he'
  const dir = isRTL ? 'rtl' : 'ltr'

  const [items, rawSettings] = await Promise.all([
    faqService.getPublishedFaqs(),
    faqService.getFaqPageSettings(),
  ])

  // Deliberately no notFound() for an empty result.
  //
  // The FAQ is linked from the footer on every page, so a 404 here would be a
  // broken site-wide link during the window between deploying and seeding —
  // and getPublishedFaqs() also returns [] when Firestore is briefly
  // unreachable, which must not turn a transient fault into a 404 that a
  // crawler records. Instead the page renders its heading, intro and an empty
  // state, and generateMetadata serves noindex while nothing is published, so
  // there is never a thin page in the index.
  const settings = resolveSettings(rawSettings)
  const published = selectRenderableFaqs(items, locale)
  const grouped = groupFaqsByAudience(published)
  const populatedAudiences = FAQ_AUDIENCES.filter((a) => grouped[a].length > 0)

  const heading = pickLocalized(settings.heading, locale)
  const intro = pickLocalized(settings.intro, locale)
  const pageUrl = `${BASE_URL}/${lng}/faq`

  const ctaFor = (audience: FaqAudience) => {
    if (audience === 'women') return settings.primaryCta
    if (audience === 'men') return settings.secondaryCta
    return undefined
  }

  // Built from exactly the records rendered above, in the same order, so the
  // structured data cannot drift from the visible page.
  const faqSchema = buildFaqPageStructuredData(
    populatedAudiences.flatMap((audience) =>
      grouped[audience].map((item) => ({
        slug: item.slug,
        question: pickLocalized(item.question, locale),
        answerHtml: pickLocalized(item.answerHtml, locale),
        shortAnswer: pickLocalized(item.shortAnswer, locale),
      }))
    ),
    { locale, pageUrl, baseUrl: BASE_URL }
  )

  const homeLabel = isRTL ? 'דף הבית' : 'Home'
  const breadcrumbSchema = buildBreadcrumbStructuredData([
    { name: homeLabel, url: `${BASE_URL}/${lng}` },
    { name: heading, url: pageUrl },
  ])

  const lastUpdated = getFaqLastModified(items, rawSettings, new Date()).toLocaleDateString(
    isRTL ? 'he-IL' : 'en-US',
    { year: 'numeric', month: 'long', day: 'numeric' }
  )

  return (
    <div className="bg-white min-h-screen" dir={dir}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <nav aria-label={isRTL ? 'מסלול ניווט' : 'Breadcrumb'} className="faq-breadcrumb">
          <Link href={`/${lng}`} className="faq-breadcrumb-link">
            {homeLabel}
          </Link>
          <span aria-hidden="true" className="faq-breadcrumb-sep">
            /
          </span>
          <span aria-current="page">{heading}</span>
        </nav>

        <h1 className="faq-heading">{heading}</h1>

        {intro && <RichContent html={intro} dir={dir} className="faq-intro" />}

        {populatedAudiences.length > 1 && (
          <nav aria-label={isRTL ? 'ניווט בעמוד' : 'On this page'} className="faq-jump-nav">
            <ul>
              {populatedAudiences.map((audience) => (
                <li key={audience}>
                  <a href={`#faq-section-${audience}`} className="faq-jump-link">
                    {pickLocalized(settings.sectionTitles[audience], locale)}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}

        {published.length === 0 ? (
          <p className="faq-empty">
            {isRTL ? 'התוכן בעמוד זה מתעדכן כעת. ' : 'This page is being updated. '}
            <Link href={`/${lng}/contact`} className="faq-related-link">
              {isRTL ? 'צרו קשר ונשמח לעזור' : 'Get in touch and we will help'}
            </Link>
          </p>
        ) : (
          <FaqAccordionClient
            locale={locale}
            questionCount={published.length}
            audiences={populatedAudiences}
          >
            {populatedAudiences.map((audience) => (
              <FaqAudienceSection
                key={audience}
                audience={audience}
                title={pickLocalized(settings.sectionTitles[audience], locale)}
                items={grouped[audience]}
                locale={locale}
                lng={lng}
                cta={ctaFor(audience)}
              />
            ))}
          </FaqAccordionClient>
        )}

        <p className="faq-last-updated">
          {isRTL ? `עודכן לאחרונה: ${lastUpdated}` : `Last updated: ${lastUpdated}`}
        </p>

        {/* One FAQPage per page, never two — a second one anywhere on this route
            would give crawlers conflicting answer sets for the same URL. */}
        {faqSchema && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: serializeJsonLd(faqSchema) }}
          />
        )}
        {breadcrumbSchema && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbSchema) }}
          />
        )}
      </div>
    </div>
  )
}
