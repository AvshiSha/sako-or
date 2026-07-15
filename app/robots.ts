import type { MetadataRoute } from 'next'
import { seoConfig } from '@/lib/seo'

const baseUrl = seoConfig.baseUrl.replace(/\/$/, '')

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // /_next/ build assets (JS/CSS chunks) are not pages; Google shouldn't
      // spend crawl budget on them or keep retrying ones that 404 after a
      // redeploy changes the chunk hashes.
      disallow: ['/admin/', '/api/', '/_next/'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
