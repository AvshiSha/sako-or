import type { Metadata } from 'next'
import { getImageUrl } from './image-urls'

/**
 * The locale unprefixed traffic actually lands on: middleware 308s `/` and
 * every unlocalised path to `/he`.
 *
 * Deliberately NOT `defaultLanguage` from i18n/settings, which is `'en'` and
 * governs translation fallback, not routing. Using it here pointed x-default
 * at the English URL - the opposite of where Google should send an unmatched
 * visitor to an Israeli storefront.
 */
const ROUTING_DEFAULT_LOCALE = 'he'

// Default SEO configuration
export const seoConfig = {
  siteName: 'SAKO-OR',
  baseUrl: process.env.NEXT_PUBLIC_SITE_URL || 
           process.env.APP_BASE_URL || 
           'https://www.sako-or.com',
  defaultTitle: 'SAKO-OR',
  defaultDescription: 'Quality leather products, shoes, and fashion accessories since 1977',
  defaultOGImage: getImageUrl('/images/logo/sako-logo.png'),
  defaultRobots: 'index, follow' as const,
}

// Ensure baseUrl doesn't have trailing slash
const normalizeBaseUrl = (url: string): string => {
  return url.replace(/\/$/, '')
}

const baseUrl = normalizeBaseUrl(seoConfig.baseUrl)

// SEO configuration interface
export interface SEOConfig {
  title: string
  description: string
  url: string
  image?: string
  type?: 'website' | 'product'
  locale?: 'en' | 'he'
  alternateLocales?: Array<{ locale: string; url: string }>
  robots?: 'index, follow' | 'noindex, nofollow' | 'noindex, follow'
  structuredData?: object // For JSON-LD
  /** Overrides the canonical link (e.g. pointing a supporting blog article at its
   * money-page collection). Accepts a relative path or full URL. Falls back to `url`
   * (self-canonical) when omitted or empty. */
  canonicalUrl?: string
}

/**
 * Build absolute URL from relative path
 */
export function buildAbsoluteUrl(path: string): string {
  // Remove leading slash if present
  const cleanPath = path.startsWith('/') ? path.slice(1) : path
  return `${baseUrl}/${cleanPath}`
}

/**
 * Ensure image URL is absolute.
 *
 * Exported because structured data needs it too: schema.org image and logo
 * properties must be absolute, crawlable URLs, and getImageUrl() returns the
 * raw local path for any asset without a Firebase Storage mapping.
 */
export function ensureAbsoluteImageUrl(imageUrl: string | undefined): string | undefined {
  if (!imageUrl) return seoConfig.defaultOGImage
  
  // If already absolute (starts with http:// or https://), return as is
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl
  }
  
  // If starts with /, it's a relative path - make it absolute
  if (imageUrl.startsWith('/')) {
    return buildAbsoluteUrl(imageUrl)
  }
  
  // Otherwise, assume it's already a full URL or use default
  return imageUrl || seoConfig.defaultOGImage
}

/**
 * Truncate description to optimal length for SEO (150-160 characters)
 */
function truncateDescription(description: string, maxLength: number = 160): string {
  if (description.length <= maxLength) return description
  return description.slice(0, maxLength - 3).trim() + '...'
}

/**
 * Build Next.js Metadata object from SEO configuration
 */
export function buildMetadata(config: SEOConfig): Metadata {
  const {
    title,
    description,
    url,
    image,
    type = 'website',
    locale = 'en',
    alternateLocales = [],
    robots = seoConfig.defaultRobots,
    canonicalUrl,
  } = config

  // Ensure title includes brand suffix
  const fullTitle = title.includes('| SAKO-OR') ? title : `${title} | SAKO-OR`

  // Truncate description
  const truncatedDescription = truncateDescription(description)

  // Ensure absolute URLs
  const absoluteUrl = url.startsWith('http') ? url : buildAbsoluteUrl(url)
  const absoluteImage = ensureAbsoluteImageUrl(image)

  // An explicit canonicalUrl overrides self-canonical (e.g. a supporting blog
  // article pointing at its money-page collection); falls back to absoluteUrl.
  const trimmedCanonicalUrl = canonicalUrl?.trim()
  const canonicalHref = trimmedCanonicalUrl
    ? (trimmedCanonicalUrl.startsWith('http') ? trimmedCanonicalUrl : buildAbsoluteUrl(trimmedCanonicalUrl))
    : absoluteUrl
  
  // Build hreflang alternates.
  //
  // No alternates means no hreflang at all - deliberately. A cluster of one
  // self-referencing entry says nothing, and on a page that canonicalises
  // elsewhere (a non-primary product colour, say) it is actively harmful:
  // every URL in an hreflang cluster has to self-canonicalise, and pointing
  // at one that doesn't makes Google discard the cluster. The self-reference
  // is only added once there is a real cluster for it to belong to.
  const languages: Record<string, string> = {}
  if (alternateLocales.length > 0) {
    alternateLocales.forEach(({ locale: altLocale, url: altUrl }) => {
      const absoluteAltUrl = altUrl.startsWith('http') ? altUrl : buildAbsoluteUrl(altUrl)
      languages[altLocale] = absoluteAltUrl
    })
    if (!languages[locale]) {
      languages[locale] = absoluteUrl
    }

    // x-default is not a language - it tells Google what to serve a user who
    // matches none of the declared locales. Point it at the default locale
    // (Hebrew), which is also where middleware sends unprefixed traffic, so
    // the two agree. Only valid inside a real cluster, hence its position
    // inside this branch.
    const defaultLocaleUrl = languages[ROUTING_DEFAULT_LOCALE]
    if (defaultLocaleUrl) {
      languages['x-default'] = defaultLocaleUrl
    }
  }

  const metadata: Metadata = {
    title: fullTitle,
    description: truncatedDescription,
    alternates: {
      canonical: canonicalHref,
      languages: Object.keys(languages).length > 0 ? languages : undefined,
    },
    // Note: check the "no" prefix explicitly rather than `.includes('index')` /
    // `.includes('follow')` — "noindex" and "nofollow" both contain those
    // substrings, which would otherwise flip index/follow to true even when
    // the directive says not to.
    robots: {
      index: !robots.includes('noindex'),
      follow: !robots.includes('nofollow'),
    },
    openGraph: {
      type: 'website' as const, // Next.js Metadata API only supports 'website' type (product type handled via JSON-LD)
      title: fullTitle,
      description: truncatedDescription,
      url: absoluteUrl,
      siteName: seoConfig.siteName,
      images: absoluteImage ? [
        {
          url: absoluteImage,
          width: 1200,
          height: 630,
          alt: fullTitle,
        }
      ] : undefined,
      locale: locale === 'he' ? 'he_IL' : 'en_US',
      ...(alternateLocales.length > 0 && {
        alternateLocale: alternateLocales.map(alt => alt.locale === 'he' ? 'he_IL' : 'en_US'),
      }),
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description: truncatedDescription,
      images: absoluteImage ? [absoluteImage] : undefined,
    },
  }

  return metadata
}

/**
 * Public profiles that belong to this brand, for schema.org `sameAs`.
 *
 * `sameAs` is the highest-leverage property available for entity recognition:
 * it is what ties this site to a single real-world organisation in Google's
 * Knowledge Graph, and the same signal AI Overviews and LLM-backed assistants
 * read when deciding whether "SAKO-OR" is an entity they know.
 *
 * Only add profiles the brand genuinely controls. Never list the site's own
 * homepage here - that belongs in `url`.
 */
const ORGANIZATION_SAME_AS = [
  'https://www.facebook.com/sakoorbrand',
  'https://www.instagram.com/sako.or/',
]

/**
 * Build Organization JSON-LD.
 *
 * Rendered on every storefront page rather than the homepage alone: it costs
 * a few hundred bytes and means any page that gets cited carries the entity
 * signal with it.
 */
export function buildOrganizationStructuredData(locale: 'en' | 'he' = 'he'): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: seoConfig.siteName,
    alternateName: locale === 'he' ? 'סכו עור' : 'SAKO OR',
    url: baseUrl,
    // Must be absolute and crawlable. getImageUrl() hands back the raw path
    // when an asset has no Firebase mapping, which would emit a relative
    // logo URL that Google cannot fetch.
    logo: ensureAbsoluteImageUrl(seoConfig.defaultOGImage),
    sameAs: ORGANIZATION_SAME_AS,
  }
}

/** One step in a breadcrumb trail. The final crumb ("you are here") has no url. */
export interface BreadcrumbCrumb {
  name: string
  /** Relative path or absolute URL. Omit on the current page. */
  url?: string
}

/**
 * Build BreadcrumbList JSON-LD.
 *
 * Google's rules, all of which this enforces rather than trusting the caller:
 * positions are 1-based and increment by 1 with no gaps, every `item` is an
 * absolute URL, and the final crumb omits `item` to signal "you are here".
 * The `name` values must also match the visible breadcrumb labels exactly -
 * that part is the caller's job, which is why the visible nav and this
 * function are fed from the same array.
 *
 * Returns null below two crumbs: a one-item breadcrumb is not eligible for
 * the SERP feature and emitting it is just noise.
 */
export function buildBreadcrumbStructuredData(crumbs: BreadcrumbCrumb[]): object | null {
  const usable = crumbs.filter((crumb) => !!crumb.name?.trim())
  if (usable.length < 2) return null

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: usable.map((crumb, index) => {
      const isLast = index === usable.length - 1
      return {
        '@type': 'ListItem',
        position: index + 1,
        name: crumb.name,
        // The last crumb is the current page and must not carry `item`.
        ...(!isLast && crumb.url
          ? { item: crumb.url.startsWith('http') ? crumb.url : buildAbsoluteUrl(crumb.url) }
          : {}),
      }
    }),
  }
}

/**
 * Build Product JSON-LD structured data
 */
export interface ProductStructuredData {
  name: string
  description: string
  image: string[]
  brand: string
  sku: string
  offers: {
    price: number
    currency: string
    availability: string
    url: string
  }
  model?: string
  /** Primary upper material, e.g. "Soft Nape leather". */
  material?: string
  /** Color name, e.g. "Gray". */
  color?: string
  /** Extra spec/fit facts (closure type, sole, size fit, foot width, etc.) as schema.org PropertyValue entries. */
  additionalProperty?: Array<{ name: string; value: string }>
}

export function buildProductStructuredData(
  product: ProductStructuredData,
  locale: 'en' | 'he' = 'en'
): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    image: product.image,
    brand: {
      '@type': 'Brand',
      name: product.brand,
    },
    sku: product.sku,
    ...(product.model && { model: product.model }),
    ...(product.material && { material: product.material }),
    ...(product.color && { color: product.color }),
    ...(product.additionalProperty && product.additionalProperty.length > 0 && {
      additionalProperty: product.additionalProperty.map((prop) => ({
        '@type': 'PropertyValue',
        name: prop.name,
        value: prop.value,
      })),
    }),
    offers: {
      '@type': 'Offer',
      price: product.offers.price,
      priceCurrency: product.offers.currency,
      availability: `https://schema.org/${product.offers.availability === 'InStock' ? 'InStock' : 'OutOfStock'}`,
      url: product.offers.url,
    },
  }
}
