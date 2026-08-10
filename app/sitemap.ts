import type { MetadataRoute } from 'next'
import { seoConfig } from '@/lib/seo'
import { languages } from '@/i18n/settings'
import { productService, categoryService, blogService } from '@/lib/firebase'
import { getPrimaryColorSlug } from '@/lib/product-seo'

const baseUrl = seoConfig.baseUrl.replace(/\/$/, '')

// Firestore's client SDK returns Timestamp objects (with a `.toDate()`
// method) for timestamp fields at runtime, not plain JS Dates - even though
// our TS types say `Date`. `new Date(timestamp)` on one of those silently
// produces an Invalid Date (no throw until something calls .toISOString()),
// which crashed the whole sitemap prerender. Normalize defensively and never
// return a value that can fail toISOString().
function toValidDate(value: unknown, fallback: Date): Date {
  if (!value) return fallback
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? fallback : value
  }
  if (typeof value === 'object' && typeof (value as { toDate?: unknown }).toDate === 'function') {
    const date = (value as { toDate: () => Date }).toDate()
    return isNaN(date.getTime()) ? fallback : date
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value)
    return isNaN(date.getTime()) ? fallback : date
  }
  return fallback
}

// Next.js's sitemap XML serializer does not escape entities in `<loc>`, so a
// raw `&` (or `<`/`>`) in a category/product slug corrupts the entire feed's
// XML, not just that one entry - happened with a "slides-&-sandals" category
// path. Escape defensively rather than relying on slugs always being clean.
function escapeXmlEntities(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

// Static marketing pages. NOTE: `/favorites` is intentionally excluded - it's
// a per-user page (guest localStorage or signed-in account state), not
// indexable content.
const staticPaths = [
  '',
  '/about',
  '/contact',
  '/privacy',
  '/terms',
  '/collection',
  '/news',
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  // No changeFrequency / priority anywhere in this file: Google ignores both,
  // and a feed where everything claims priority 1.0 actively misleads Bing,
  // which does read the field. Only <loc> and <lastmod> carry signal.
  const entries: MetadataRoute.Sitemap = languages.flatMap((lng) =>
    staticPaths.map((path) => ({
      url: `${baseUrl}/${lng}${path}`,
      lastModified: now,
    }))
  )

  // Category / collection filter pages. Category.path is a single,
  // locale-neutral slug path (always built from the English slug - see
  // categoryService.generateCategoryPath), reused as-is under both locale
  // prefixes, matching how the collection page builds its own canonical URL.
  try {
    const categories = await categoryService.getEnabledCategories()
    for (const category of categories) {
      if (!category.path) continue
      for (const lng of languages) {
        entries.push({
          url: `${baseUrl}/${lng}/collection/${category.path}`,
          lastModified: toValidDate(category.updatedAt, now),
        })
      }
    }
  } catch (error) {
    console.error('sitemap: failed to load categories:', error)
  }

  // Product pages - one URL per product, not one per colour variant.
  //
  // A sitemap must only contain URLs that canonicalise to themselves. Every
  // colour of a product now canonicalises to its primary colour (see
  // lib/product-seo.ts), so listing all of them here would advertise ~276
  // URLs that immediately point somewhere else - which wastes crawl budget
  // and suppresses the "Discovered URLs" count that makes sitemap problems
  // diagnosable in Search Console.
  try {
    const products = await productService.getAllProducts({ isActive: true })
    for (const product of products) {
      const primaryColorSlug = getPrimaryColorSlug(product)
      if (!primaryColorSlug) continue
      const lastModified = toValidDate(product.updatedAt, now)
      for (const lng of languages) {
        entries.push({
          url: `${baseUrl}/${lng}/product/${product.sku}/${primaryColorSlug}`,
          lastModified,
        })
      }
    }
  } catch (error) {
    console.error('sitemap: failed to load products:', error)
  }

  // Published blog articles.
  try {
    const { articles } = await blogService.getPublishedArticles(1, 10000)
    for (const article of articles) {
      // A supporting article can be pointed at its money-page collection via
      // `canonicalUrl` (see SEOConfig in lib/seo.ts). Those URLs canonicalise
      // elsewhere, so they do not belong in the sitemap.
      if (article.canonicalUrl?.trim()) continue
      const lastModified = toValidDate(article.updatedAt, now)
      for (const lng of languages) {
        entries.push({
          url: `${baseUrl}/${lng}/news/${article.slug}`,
          lastModified,
        })
      }
    }
  } catch (error) {
    console.error('sitemap: failed to load blog articles:', error)
  }

  return entries.map((entry) => ({ ...entry, url: escapeXmlEntities(entry.url) }))
}
