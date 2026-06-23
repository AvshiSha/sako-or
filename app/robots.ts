import type { MetadataRoute } from 'next'
import { seoConfig } from '@/lib/seo'

const baseUrl = seoConfig.baseUrl.replace(/\/$/, '')

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/', '/api/'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
