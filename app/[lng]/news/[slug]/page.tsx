import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { blogService } from '@/lib/firebase'
import { buildMetadata, buildAbsoluteUrl } from '@/lib/seo'
import { languages } from '@/i18n/settings'
import RichContent from '@/app/components/RichContent'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

interface ArticlePageProps {
  params: Promise<{ lng: string; slug: string }>
}

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const { lng, slug } = await params
  const locale = lng as 'en' | 'he'
  const article = await blogService.getArticleBySlug(slug)

  if (!article || article.status !== 'published') {
    return buildMetadata({
      title: 'Article Not Found',
      description: '',
      url: `/${lng}/news/${slug}`,
      locale,
      robots: 'noindex, nofollow',
    })
  }

  const title =
    article.seoTitle?.[locale] ||
    article.title[locale] ||
    article.title.en ||
    article.slug

  const description =
    article.seoDescription?.[locale] ||
    article.excerpt[locale] ||
    article.excerpt.en ||
    ''

  const ogTitle = article.ogTitle?.[locale] || title
  const ogDescription = article.ogDescription?.[locale] || description
  const ogImage = article.ogImage || article.featuredImage

  return buildMetadata({
    title,
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

  const article = await blogService.getArticleBySlug(slug)
  if (!article || article.status !== 'published') {
    notFound()
  }

  const title = article.title[locale] || article.title.en || article.slug
  const excerpt = article.excerpt[locale] || article.excerpt.en || ''
  const content = article.content[locale] || article.content.en || ''
  const featuredAlt = article.featuredImageAlt?.[locale] || title

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
    headline: title,
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

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 md:py-16">
        <Link
          href={`/${lng}/news`}
          className="inline-block text-sm text-[#856D55] hover:underline mb-8"
        >
          {locale === 'he' ? '← חזרה לבלוג' : '← Back to News'}
        </Link>

        <header className="mb-8">
          <time className="text-sm text-gray-500">{date}</time>
          <h1
            className="mt-2 text-3xl md:text-4xl font-bold text-black leading-tight"
            style={{ fontFamily: 'Poppins, sans-serif' }}
          >
            {title}
          </h1>
          {excerpt && (
            <p className="mt-4 text-lg text-gray-600 leading-relaxed">{excerpt}</p>
          )}
        </header>

        {article.featuredImage && (
          <div className="relative mb-10 aspect-[16/9] overflow-hidden rounded-md bg-gray-100">
            <Image
              src={article.featuredImage}
              alt={featuredAlt}
              fill
              className="object-cover"
              priority
              sizes="(max-width: 768px) 100vw, 768px"
            />
          </div>
        )}

        <RichContent
          html={content}
          dir={locale === 'he' ? 'rtl' : 'ltr'}
          className={locale === 'he' ? 'text-right' : 'text-left'}
        />
      </div>
    </article>
  )
}
