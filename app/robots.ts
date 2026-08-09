import type { MetadataRoute } from 'next'
import { seoConfig } from '@/lib/seo'

const baseUrl = seoConfig.baseUrl.replace(/\/$/, '')

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Do NOT add /_next/ here. Those are the JS/CSS chunks Google's renderer
      // needs to paint the page - blocking them makes the collection grid and
      // header render blank in the crawler's screenshot, which costs far more
      // than the crawl budget it saves. (Crawl-budget tuning only pays off
      // above ~500K URLs; we are nowhere near that.)
      disallow: ['/admin/', '/api/'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
