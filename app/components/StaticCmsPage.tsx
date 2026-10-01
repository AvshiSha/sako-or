import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { staticPageService } from '@/lib/firebase'
import { buildMetadata } from '@/lib/seo'
import { languages } from '@/i18n/settings'
import { cmsHtmlToPlainText } from '@/lib/cms-html-cleanup'
import InlineHeadingContent from './InlineHeadingContent'
import LegalPage, { LEGAL_ORDINALS } from './LegalPage'
import RichContent from './RichContent'

// Shared shell for every CMS-managed static page in STATIC_PAGE_DEFINITIONS.
// Route files stay thin: they pin the Firestore key + public path, set their
// own `revalidate`, and delegate both metadata and rendering here.

interface StaticCmsPageParams {
  /** Firestore doc ID in the `staticPages` collection. */
  pageKey: string
  /** Locale-less public path, e.g. '/terms'. */
  publicPath: string
  lng: string
}

export async function buildStaticCmsPageMetadata({
  pageKey,
  publicPath,
  lng,
}: StaticCmsPageParams): Promise<Metadata> {
  const locale = lng as 'en' | 'he'
  const page = await staticPageService.getPublishedStaticPage(pageKey)

  if (!page) {
    return buildMetadata({
      title: 'Not Found',
      description: '',
      url: `/${lng}${publicPath}`,
      locale,
      robots: 'noindex, nofollow',
    })
  }

  const titlePlain =
    page.seoTitle?.[locale] || cmsHtmlToPlainText(page.title[locale] || page.title.en || '')
  const description =
    page.seoDescription?.[locale] ||
    cmsHtmlToPlainText(page.content[locale] || page.content.en || '').slice(0, 160)

  return buildMetadata({
    title: titlePlain,
    description,
    url: `/${lng}${publicPath}`,
    image: page.ogImage,
    locale,
    alternateLocales: languages
      .filter((l) => l !== locale)
      .map((altLng) => ({ locale: altLng, url: `/${altLng}${publicPath}` })),
    robots: page.robots,
  })
}

export default async function StaticCmsPage({ pageKey, lng }: Omit<StaticCmsPageParams, 'publicPath'>) {
  const locale = lng as 'en' | 'he'

  const page = await staticPageService.getPublishedStaticPage(pageKey)
  if (!page) {
    notFound()
  }

  const titleHtml = page.title[locale] || page.title.en || ''
  const content = page.content[locale] || page.content.en || ''
  const isRTL = locale === 'he'

  const lastUpdated = page.updatedAt
    ? new Date(page.updatedAt).toLocaleDateString(locale === 'he' ? 'he-IL' : 'en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : ''

  // The back link the previous layout carried is gone: the Legal frames show no
  // such control, and the site header above it already goes home.
  return (
    <LegalPage
      ordinal={LEGAL_ORDINALS[pageKey]}
      title={<InlineHeadingContent html={titleHtml} />}
      lastUpdated={
        lastUpdated
          ? locale === 'he'
            ? `עודכן לאחרונה: ${lastUpdated}`
            : `Last updated: ${lastUpdated}`
          : undefined
      }
      body={<RichContent html={content} dir={isRTL ? 'rtl' : 'ltr'} className="legal-content" />}
    />
  )
}
