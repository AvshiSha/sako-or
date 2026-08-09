import type { MetadataRoute } from 'next'
import { seoConfig } from '@/lib/seo'

const baseUrl = seoConfig.baseUrl.replace(/\/$/, '')

/**
 * Paths no crawler should fetch, for any purpose.
 *
 * Spread into every rule group rather than written once. A named user-agent
 * group in robots.txt REPLACES the `*` group for that crawler - directives are
 * not merged - so a group that lists only `Allow: /` would hand that bot the
 * admin panel. Keeping one constant means the two can never drift apart.
 *
 * Do NOT add /_next/ here. Those are the JS/CSS chunks Google's renderer needs
 * to paint the page; blocking them makes the collection grid and header render
 * blank in the crawler's screenshot, which costs far more than the crawl
 * budget it saves. (Crawl-budget tuning only pays off above ~500K URLs.)
 */
const DISALLOWED_PATHS = ['/admin/', '/api/']

/**
 * AI crawlers that read the site in order to answer a question and cite the
 * source. These send traffic back, and they are the audience for the
 * structured data, breadcrumbs and self-contained product copy on the site.
 *
 * They inherit the same access as any search engine - listed explicitly so the
 * decision is visible in the served file rather than implied by omission.
 *
 * Google-Extended governs Gemini and grounding only; it has no bearing on
 * normal Google Search indexing either way.
 */
const CITATION_CRAWLERS = [
  'OAI-SearchBot',
  'ChatGPT-User',
  'PerplexityBot',
  'ClaudeBot',
  'Google-Extended',
]

/**
 * AI crawlers that harvest content to train models. No traffic comes back, and
 * the product photography and written descriptions are brand assets.
 *
 * This replaces Cloudflare's "Managed robots.txt" toggle, which was injecting
 * its own block above these rules. That toggle was all-or-nothing and, despite
 * describing itself as an AI-training signal, also emitted `Disallow: /` for
 * ClaudeBot and Google-Extended - i.e. it silently opted the site out of being
 * cited, not just out of being trained on. Turn it back on and it will prepend
 * its block to this file again.
 */
const TRAINING_CRAWLERS = [
  'GPTBot',
  'CCBot',
  'Bytespider',
  'Amazonbot',
  'Applebot-Extended',
  'meta-externalagent',
]

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: DISALLOWED_PATHS,
      },
      {
        userAgent: CITATION_CRAWLERS,
        allow: '/',
        disallow: DISALLOWED_PATHS,
      },
      {
        userAgent: TRAINING_CRAWLERS,
        disallow: '/',
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
