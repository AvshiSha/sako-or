import type { MetadataRoute } from 'next'
import { seoConfig } from '@/lib/seo'
import { languages } from '@/i18n/settings'

const baseUrl = seoConfig.baseUrl.replace(/\/$/, '')

const staticPaths = [
  '',
  '/about',
  '/contact',
  '/collection',
  '/favorites',
  '/news',
]

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  return languages.flatMap((lng) =>
    staticPaths.map((path) => ({
      url: `${baseUrl}/${lng}${path}`,
      lastModified: now,
      changeFrequency: path === '' ? 'daily' : 'weekly',
      priority: path === '' ? 1 : 0.7,
    }))
  )
}
