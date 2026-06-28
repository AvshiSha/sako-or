import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { blogService } from '@/lib/firebase'
import { buildMetadata, buildAbsoluteUrl } from '@/lib/seo'
import { languages } from '@/i18n/settings'
import { cmsHtmlToPlainText } from '@/lib/cms-html-cleanup'
import InlineHeadingContent from '@/app/components/InlineHeadingContent'
import RichContent from '@/app/components/RichContent'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

interface ArticlePageProps {
  params: Promise<{ lng: string; slug: string }>
}

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const { lng, slug } = await params
  const locale = lng as 'en' | 'he'
  const article = await blogService.getPublishedArticleBySlug(slug)

  if (!article) {
    return buildMetadata({
      title: 'Article Not Found',
      description: '',
      url: `/${lng}/news/${slug}`,
      locale,
      robots: 'noindex, nofollow',
    })
  }

  const titlePlain =
    article.seoTitle?.[locale] ||
    cmsHtmlToPlainText(article.title[locale] || article.title.en || '') ||
    article.slug

  const description =
    article.seoDescription?.[locale] ||
    article.excerpt[locale] ||
    article.excerpt.en ||
    ''

  const ogTitle = article.ogTitle?.[locale] || titlePlain
  const ogDescription = article.ogDescription?.[locale] || description
  const ogImage = article.ogImage || article.featuredImage

  return buildMetadata({
    title: titlePlain,
    description,
    url: `/${lng}/news/${slug}`,
    image: ogImage,
    locale,
    alternateLocales: languages
      .filter((l) => l !== locale)
      .map((altLng) => ({ locale: altLng, url: `/${altLng}/news/${slug}` })),
    type: 'website',
  })
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { lng, slug } = await params
  const locale = lng as 'en' | 'he'

  const article = await blogService.getPublishedArticleBySlug(slug)
  if (!article) {
    notFound()
  }

  const titleHtml = article.title[locale] || article.title.en || article.slug
  const titlePlain = cmsHtmlToPlainText(titleHtml) || article.slug
  const excerpt = article.excerpt[locale] || article.excerpt.en || ''
  const content = article.content[locale] || article.content.en || ''
  const featuredAlt = article.featuredImageAlt?.[locale] || titlePlain

  const date = article.publishedAt
    ? new Date(article.publishedAt).toLocaleDateString(locale === 'he' ? 'he-IL' : 'en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : ''

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: titlePlain,
    description: excerpt,
    image: article.featuredImage ? [article.featuredImage] : undefined,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    author: {
      '@type': 'Organization',
      name: 'SAKO-OR',
    },
    publisher: {
      '@type': 'Organization',
      name: 'SAKO-OR',
    },
    mainEntityOfPage: buildAbsoluteUrl(`/${lng}/news/${slug}`),
  }

  return (
    <article className="min-h-screen bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      {article.featuredImage && (
        <div className="relative w-full overflow-hidden bg-gray-100 aspect-[4/3] sm:aspect-[16/9] md:aspect-auto md:h-[min(60vh,720px)]">
          <Image
            src={article.featuredImage}
            alt={featuredAlt}
            fill
            className="object-cover object-center md:object-contain"
            priority
            sizes="100vw"
          />
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 md:py-12">
        <Link
          href={`/${lng}/news`}
          className="inline-block text-sm text-[#856D55] hover:underline mb-6 md:mb-8"
        >
          {locale === 'he' ? '← חזרה לבלוג' : '← Back to News'}
        </Link>

        <header className="mb-4 md:mb-6 text-center">
          <h1
            className="text-3xl md:text-4xl font-bold text-black leading-tight"
            style={{ fontFamily: 'Poppins, sans-serif' }}
          >
            <InlineHeadingContent html={titleHtml} fallback={article.slug} />
          </h1>
          {date && (
            <time className="mt-4 block text-sm text-gray-500">{date}</time>
          )}
          {excerpt && (
            <p className="mt-6 text-lg text-gray-600 leading-relaxed max-w-2xl mx-auto">
              {excerpt}
            </p>
          )}
        </header>

        <RichContent
          html={content}
          dir={locale === 'he' ? 'rtl' : 'ltr'}
          className={locale === 'he' ? 'text-right' : 'text-left'}
        />
      </div>
    </article>
  )
}
