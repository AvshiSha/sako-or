import Link from 'next/link'
import { blogService } from '@/lib/firebase'
import { buildMetadata } from '@/lib/seo'
import { languages } from '@/i18n/settings'
import { cmsHtmlToPlainText } from '@/lib/cms-html-cleanup'
import BlogCard from '@/app/components/blog/BlogCard'
import BlogCoverStory from '@/app/components/blog/BlogCoverStory'
import { BlogInlineLink, BLOG_GRID, BLOG_GRID_CLIP } from '@/app/components/blog/blogChrome'
import { cn } from '@/lib/utils'
import type { Metadata } from 'next'

/**
 * Blog listing, from Blog / Desktop (438:3311) in Figma file
 * Q7WqJRF5rqxc4V7zqdpQUM.
 *
 * Two bands below the header: a 740px cover story and a ruled "רשימת בלוגים"
 * section over a four-across tile grid. Announcement banner, header and footer
 * come from app/(site)/[lng]/layout.tsx and are not redrawn here.
 *
 * The frame also draws a WOMEN / MEN department split between the grid and the
 * footer. It is not implemented: the designer confirmed it landed on this
 * artboard by accident and does not belong to the blog.
 *
 * Two things the frame does not account for, both kept from the page it
 * replaces. Pagination: the frame shows a single row of four tiles and no way
 * past it, but the collection runs longer than one page, so the existing
 * controls stay, restyled into the design's language. And the cover story: it
 * is the newest article, which only exists on page 1 - deeper pages open
 * straight into the ruled list.
 */

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 12

const translations = {
  en: {
    title: 'News & Blog',
    description: 'Style tips, product guides, and news from SAKO-OR.',
    /** 438:3319. Latin on the frame in both languages. */
    coverEyebrow: 'COVER STORY / 01',
    read: 'Read',
    listTitle: 'All articles',
    allProducts: 'All products',
    readStory: 'Read the story ↙',
    empty: 'No articles yet.',
    page: 'Page',
    of: 'of',
    previous: 'Previous',
    next: 'Next',
  },
  he: {
    title: 'הבלוג של סכו עור',
    description: 'טיפים לסגנון, מדריכי מוצרים וחדשות מסכו עור.',
    coverEyebrow: 'COVER STORY / 01',
    read: 'לקריאה',
    listTitle: 'רשימת בלוגים',
    allProducts: 'לכל המוצרים',
    readStory: 'לקריאת הסיפור ↙',
    empty: 'אין מאמרים עדיין.',
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

  // Newest article leads the page as the cover story; the rest fill the grid.
  // Only on page 1 - on a deeper page the newest article is not in `articles`.
  const coverArticle = page === 1 ? articles[0] : undefined
  const gridArticles = coverArticle ? articles.slice(1) : articles

  const titleOf = (article: (typeof articles)[number]) =>
    article.title[locale] || article.title.en || article.slug

  return (
    <div className="bg-surface-secondary">
      {/* The frame's own h1 is the section heading below, which sits after the
          cover story in the document. Rather than open the page on an h2, the
          page title carries the h1 for assistive tech and the visible headings
          keep the design's order. */}
      <h1 className="sr-only">{t.title}</h1>

      {coverArticle && (
        <BlogCoverStory
          href={`/${lng}/news/${coverArticle.slug}`}
          image={coverArticle.featuredImage}
          imageAlt={
            coverArticle.featuredImageAlt?.[locale] ||
            cmsHtmlToPlainText(titleOf(coverArticle)) ||
            coverArticle.slug
          }
          titleHtml={titleOf(coverArticle)}
          titleFallback={coverArticle.slug}
          excerpt={coverArticle.excerpt[locale] || coverArticle.excerpt.en || ''}
          eyebrow={t.coverEyebrow}
          readLabel={t.read}
        />
      )}

      {/* 438:3331 */}
      <section>
        {/* 438:3332 - ruled top and bottom, heading on the inline start with the
            link opposite. 48/34.56 is a 1728px figure; it steps down on phones.
            Only border-t here: the rule below comes from the first grid row's
            own border-t, so the two do not stack into a 2px line. */}
        <header className="flex items-end justify-between gap-[16px] border-t border-sako-black px-[16px] py-[20px] lg:px-[30px] lg:py-[33px]">
          <h2
            dir="auto"
            className="font-ploni text-[32px] font-black leading-[28px] text-text-primary lg:text-[48px] lg:leading-[34.56px]"
          >
            {t.listTitle}
          </h2>
          <Link
            href={`/${lng}/collection`}
            className="shrink-0 transition-opacity hover:opacity-70"
          >
            <BlogInlineLink>{t.allProducts}</BlogInlineLink>
          </Link>
        </header>

        {gridArticles.length === 0 ? (
          /* The header draws no bottom rule of its own, so the empty state
             carries the one the grid would have supplied. */
          <p
            dir="auto"
            className="border-t border-sako-black px-[16px] py-[60px] text-center font-ploni text-[16px] text-text-secondary lg:px-[30px]"
          >
            {t.empty}
          </p>
        ) : (
          /* 438:3338 - four across on the frame. */
          <div className={BLOG_GRID_CLIP}>
            <div className={cn(BLOG_GRID, 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4')}>
              {gridArticles.map((article) => (
                <BlogCard
                  key={article.id}
                  href={`/${lng}/news/${article.slug}`}
                  image={article.featuredImage}
                  imageAlt={
                    article.featuredImageAlt?.[locale] ||
                    cmsHtmlToPlainText(titleOf(article)) ||
                    article.slug
                  }
                  titleHtml={titleOf(article)}
                  titleFallback={article.slug}
                  readLabel={t.readStory}
                />
              ))}
            </div>
          </div>
        )}
      </section>

      {totalPages > 1 && (
        <nav
          className="flex items-center justify-center gap-[24px] border-t border-sako-black px-[16px] py-[30px] font-ploni text-[12px] tracking-[1.2px] text-text-primary lg:px-[30px]"
          aria-label="Pagination"
        >
          {page > 1 && (
            <Link
              href={`/${lng}/news?page=${page - 1}`}
              className="border-b border-border-default pb-[6px] transition-opacity hover:opacity-70"
            >
              {t.previous}
            </Link>
          )}
          <span className="text-text-secondary">
            {t.page} {page} {t.of} {totalPages}
          </span>
          {hasMore && (
            <Link
              href={`/${lng}/news?page=${page + 1}`}
              className="border-b border-border-default pb-[6px] transition-opacity hover:opacity-70"
            >
              {t.next}
            </Link>
          )}
        </nav>
      )}
    </div>
  )
}
