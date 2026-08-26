import { faqService } from '@/lib/firebase'
import { seoConfig } from '@/lib/seo'
import { buildLlmsTxt } from '@/lib/llms-txt'
import { languages } from '@/i18n/settings'
import type { FaqLocale } from '@/lib/faq-selectors'

/**
 * GET /llms.txt
 *
 * A Markdown index of the site for assistants that fetch one. Supplementary
 * only: it does not replace indexable server-rendered HTML, internal links,
 * structured data or the XML sitemap, and plenty of AI crawlers ignore it.
 *
 * Generated rather than static so the FAQ deep links can never advertise a
 * question that has been unpublished or deleted — buildLlmsTxt filters to
 * published records, and revalidateFaqSurfaces() flushes this route on every
 * FAQ mutation.
 *
 * middleware.ts already exempts *.txt from locale redirection, so this is
 * reachable at the bare path.
 */
export const revalidate = 86400

// Hebrew first: it is the routing default and where unprefixed traffic lands.
const LOCALE_ORDER: FaqLocale[] = ['he', 'en']

export async function GET() {
  const baseUrl = seoConfig.baseUrl.replace(/\/$/, '')

  let faqs: Awaited<ReturnType<typeof faqService.getPublishedFaqs>> = []
  try {
    faqs = await faqService.getPublishedFaqs()
  } catch (error) {
    // The site index is still worth serving without the per-question deep
    // links; failing the whole route over them would be worse.
    console.error('llms.txt: failed to load FAQs:', error)
  }

  const locales = LOCALE_ORDER.filter((locale) =>
    (languages as readonly string[]).includes(locale)
  )

  const body = buildLlmsTxt({ faqs, baseUrl, locales })

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800',
    },
  })
}
