import type { MetadataRoute } from 'next'
import { seoConfig } from '@/lib/seo'
import { languages } from '@/i18n/settings'
import { productService, categoryService, blogService } from '@/lib/firebase'

const baseUrl = seoConfig.baseUrl.replace(/\/$/, '')

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

  const entries: MetadataRoute.Sitemap = languages.flatMap((lng) =>
    staticPaths.map((path) => ({
      url: `${baseUrl}/${lng}${path}`,
      lastModified: now,
      changeFrequency: path === '' ? 'daily' : 'weekly',
      priority: path === '' ? 1 : 0.7,
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
          lastModified: category.updatedAt ? new Date(category.updatedAt) : now,
          changeFrequency: 'weekly',
          priority: 0.8,
        })
      }
    }
  } catch (error) {
    console.error('sitemap: failed to load categories:', error)
  }

  // Product pages - one URL per enabled color variant.
  try {
    const products = await productService.getAllProducts({ isActive: true })
    for (const product of products) {
      const colorSlugs = Object.keys(product.colorVariants || {})
      if (colorSlugs.length === 0) continue
      const lastModified = product.updatedAt ? new Date(product.updatedAt) : now
      for (const lng of languages) {
        for (const colorSlug of colorSlugs) {
          entries.push({
            url: `${baseUrl}/${lng}/product/${product.sku}/${colorSlug}`,
            lastModified,
            changeFrequency: 'weekly',
            priority: 0.9,
          })
        }
      }
    }
  } catch (error) {
    console.error('sitemap: failed to load products:', error)
  }

  // Published blog articles.
  try {
    const { articles } = await blogService.getPublishedArticles(1, 10000)
    for (const article of articles) {
      const lastModified = article.updatedAt ? new Date(article.updatedAt) : now
      for (const lng of languages) {
        entries.push({
          url: `${baseUrl}/${lng}/news/${article.slug}`,
          lastModified,
          changeFrequency: 'monthly',
          priority: 0.6,
        })
      }
    }
  } catch (error) {
    console.error('sitemap: failed to load blog articles:', error)
  }

  return entries
}
