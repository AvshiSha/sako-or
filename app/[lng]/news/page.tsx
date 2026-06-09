import Link from 'next/link'
import Image from 'next/image'
import { blogService } from '@/lib/firebase'
import { buildMetadata } from '@/lib/seo'
import { languages } from '@/i18n/settings'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 12

const translations = {
  en: {
    title: 'News & Blog',
    description: 'Style tips, product guides, and news from SAKO-OR.',
    readMore: 'Read article',
    page: 'Page',
    of: 'of',
    previous: 'Previous',
    next: 'Next',
  },
  he: {
    title: 'חדשות ובלוג',
    description: 'טיפים לסגנון, מדריכי מוצרים וחדשות מסכו עור.',
    readMore: 'קרא את המאמר',
    page: 'עמוד',
    of: 'מתוך',
    previous: 'הקודם',
    next: 'הבא',
  },
}

interface NewsPageProps {
  params: Promise<{ lng: string }>
  searchParams: Promise<{ page?: string }>
}

export async function generateMetadata({ params }: NewsPageProps): Promise<Metadata> {
  const { lng } = await params
  const locale = lng as 'en' | 'he'
  const t = translations[locale] || translations.en

  return buildMetadata({
    title: t.title,
    description: t.description,
    url: `/${lng}/news`,
    locale,
    alternateLocales: languages
      .filter((l) => l !== locale)
      .map((altLng) => ({ locale: altLng, url: `/${altLng}/news` })),
  })
}

export default async function NewsPage({ params, searchParams }: NewsPageProps) {
  const { lng } = await params
  const resolvedSearchParams = await searchParams
  const locale = lng as 'en' | 'he'
  const t = translations[locale] || translations.en

  let page = 1
  if (typeof resolvedSearchParams.page === 'string') {
    const parsed = parseInt(resolvedSearchParams.page, 10)
    if (!isNaN(parsed) && parsed > 0) page = parsed
  }

  const { articles, total, hasMore } = await blogService.getPublishedArticles(page, PAGE_SIZE)
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 md:py-16">
        <header className="mb-12 text-center">
          <h1
            className="text-3xl md:text-4xl font-bold text-black mb-4"
            style={{ fontFamily: 'Poppins, sans-serif' }}
          >
            {t.title}
          </h1>
        </header>

        {articles.length === 0 ? (
          <p className="text-center text-gray-500">{locale === 'he' ? 'אין מאמרים עדיין.' : 'No articles yet.'}</p>
        ) : (
          <div className="space-y-10">
            {articles.map((article) => {
              const title = article.title[locale] || article.title.en || article.slug
              const excerpt = article.excerpt[locale] || article.excerpt.en || ''
              const date = article.publishedAt
                ? new Date(article.publishedAt).toLocaleDateString(locale === 'he' ? 'he-IL' : 'en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })
                : ''

              return (
                <article
                  key={article.id}
                  className="group border-b border-gray-100 pb-10 last:border-0"
                >
                  <Link href={`/${lng}/news/${article.slug}`} className="block">
                    {article.featuredImage && (
                      <div className="relative mb-5 aspect-[16/9] overflow-hidden rounded-md bg-gray-100">
                        <Image
                          src={article.featuredImage}
                          alt={article.featuredImageAlt?.[locale] || title}
                          fill
                          className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                          sizes="(max-width: 768px) 100vw, 896px"
                        />
                      </div>
                    )}
                    <time className="text-sm text-gray-500">{date}</time>
                    <h2 className="mt-2 text-xl md:text-2xl font-semibold text-black group-hover:text-[#856D55] transition-colors">
                      {title}
                    </h2>
                    {excerpt && (
                      <p className="mt-3 text-gray-600 leading-relaxed line-clamp-3">{excerpt}</p>
                    )}
                    <span className="mt-4 inline-block text-sm font-medium text-[#856D55]">
                      {t.readMore} →
                    </span>
                  </Link>
                </article>
              )
            })}
          </div>
        )}

        {totalPages > 1 && (
          <nav
            className="mt-12 flex items-center justify-center gap-4"
            aria-label="Pagination"
          >
            {page > 1 && (
              <Link
                href={`/${lng}/news?page=${page - 1}`}
                className="text-sm text-[#856D55] hover:underline"
              >
                ← {t.previous}
              </Link>
            )}
            <span className="text-sm text-gray-500">
              {t.page} {page} {t.of} {totalPages}
            </span>
            {hasMore && (
              <Link
                href={`/${lng}/news?page=${page + 1}`}
                className="text-sm text-[#856D55] hover:underline"
              >
                {t.next} →
              </Link>
            )}
          </nav>
        )}
      </div>
    </div>
  )
}
