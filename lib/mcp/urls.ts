import { getIssuer } from '@/lib/mcp/oauth/config'

/**
 * Public URLs for the content this integration touches.
 *
 * The blog's public path segment is `news`, not `blog` -- the admin UI and the
 * Firestore collection say "blog" while every storefront route says
 * `/{lng}/news/{slug}`. Returning a `/blog/` URL would be a plausible-looking
 * 404 for the specialist to paste into Search Console, so the mapping lives in
 * one place.
 *
 * Hebrew is the primary locale, so a single returned URL points at /he. The
 * English alternate exists for every article and is returned alongside it where
 * both are useful.
 */

const PRIMARY_LOCALE = 'he'
const SECONDARY_LOCALE = 'en'

export function articlePublicUrl(slug: string, locale: string = PRIMARY_LOCALE): string {
  if (!slug) return ''
  return `${getIssuer()}/${locale}/news/${slug}`
}

export function articlePublicUrls(slug: string): { he: string; en: string } {
  return {
    he: articlePublicUrl(slug, PRIMARY_LOCALE),
    en: articlePublicUrl(slug, SECONDARY_LOCALE),
  }
}

export function categoryPublicUrl(path: string, locale: string = PRIMARY_LOCALE): string {
  if (!path) return ''
  return `${getIssuer()}/${locale}/collection/${path}`
}

/** The paths to flush after a publish. Both locales, listing and article. */
export function articleRevalidationPaths(slug: string): string[] {
  const paths = [`/${PRIMARY_LOCALE}/news`, `/${SECONDARY_LOCALE}/news`]
  if (slug) {
    paths.push(`/${PRIMARY_LOCALE}/news/${slug}`, `/${SECONDARY_LOCALE}/news/${slug}`)
  }
  return paths
}
