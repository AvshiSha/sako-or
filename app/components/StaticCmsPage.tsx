import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { staticPageService } from '@/lib/firebase'
import { buildMetadata } from '@/lib/seo'
import { languages } from '@/i18n/settings'
import { cmsHtmlToPlainText } from '@/lib/cms-html-cleanup'
import InlineHeadingContent from './InlineHeadingContent'
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

  return (
    <div className={`bg-white min-h-screen ${isRTL ? 'text-right' : 'text-left'}`}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-12">
          <Link
            href={`/${lng}`}
            className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-6 transition-colors duration-200"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {locale === 'he' ? 'חזרה לעמוד הבית' : 'Back to Home'}
          </Link>

          <h1 className="text-4xl font-light text-gray-900 mb-4">
            <InlineHeadingContent html={titleHtml} />
          </h1>
          {lastUpdated && (
            <p className="text-gray-500 text-sm">
              {locale === 'he' ? `עודכן לאחרונה: ${lastUpdated}` : `Last updated: ${lastUpdated}`}
            </p>
          )}
        </div>

        <RichContent html={content} dir={isRTL ? 'rtl' : 'ltr'} />
      </div>
    </div>
  )
}
