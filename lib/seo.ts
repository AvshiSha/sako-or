import type { Metadata } from 'next'
import { getImageUrl } from './image-urls'

// Default SEO configuration
export const seoConfig = {
  siteName: 'SAKO-OR',
  baseUrl: process.env.NEXT_PUBLIC_SITE_URL || 
           process.env.APP_BASE_URL || 
           'https://sako-or.com',
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
  robots?: 'index, follow' | 'noindex, nofollow'
  structuredData?: object // For JSON-LD
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
 * Ensure image URL is absolute
 */
function ensureAbsoluteImageUrl(imageUrl: string | undefined): string | undefined {
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
  } = config

  // Ensure title includes brand suffix
  const fullTitle = title.includes('| SAKO-OR') ? title : `${title} | SAKO-OR`
  
  // Truncate description
  const truncatedDescription = truncateDescription(description)
  
  // Ensure absolute URLs
  const absoluteUrl = url.startsWith('http') ? url : buildAbsoluteUrl(url)
  const absoluteImage = ensureAbsoluteImageUrl(image)
  
  // Build hreflang alternates
  const languages: Record<string, string> = {}
  if (alternateLocales.length > 0) {
    alternateLocales.forEach(({ locale: altLocale, url: altUrl }) => {
      const absoluteAltUrl = altUrl.startsWith('http') ? altUrl : buildAbsoluteUrl(altUrl)
      languages[altLocale] = absoluteAltUrl
    })
  }
  
  // Add current locale if not already in alternates
  if (!languages[locale]) {
    languages[locale] = absoluteUrl
  }

  const metadata: Metadata = {
    title: fullTitle,
    description: truncatedDescription,
    alternates: {
      canonical: absoluteUrl,
      languages: Object.keys(languages).length > 0 ? languages : undefined,
    },
    robots: {
      index: robots.includes('index'),
      follow: robots.includes('follow'),
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
    offers: {
      '@type': 'Offer',
      price: product.offers.price,
      priceCurrency: product.offers.currency,
      availability: `https://schema.org/${product.offers.availability === 'InStock' ? 'InStock' : 'OutOfStock'}`,
      url: product.offers.url,
    },
  }
}
