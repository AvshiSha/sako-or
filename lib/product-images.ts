import type { ProductImageType } from '@/lib/product-enums'

/**
 * Structured metadata for a single product image (alt text, type/view, order).
 * Stored as a *parallel* array alongside the existing `images: string[]` URL
 * list (colorVariants[colorSlug].imageDetails), keyed by URL — this keeps the
 * existing `images`/`primaryImage` string contract completely unchanged for
 * every current consumer (cart, quick-view, payment receipts, exports, etc.)
 * while still letting new products carry richer per-image metadata.
 */
export interface ProductImageDetail {
  url: string
  altEn?: string
  altHe?: string
  type?: ProductImageType
  order?: number
}

/** A fully-resolved image: a URL from `images` merged with its (optional) detail entry. */
export interface ProductImageMeta {
  url: string
  altEn?: string
  altHe?: string
  type?: ProductImageType
  order: number
}

export interface ProductImageAltFallback {
  titleEn?: string
  titleHe?: string
}

function toDetailMap(imageDetails: unknown): Map<string, Partial<ProductImageDetail>> {
  const map = new Map<string, Partial<ProductImageDetail>>()
  if (!Array.isArray(imageDetails)) return map
  for (const detail of imageDetails) {
    if (detail && typeof detail === 'object' && typeof (detail as { url?: unknown }).url === 'string') {
      map.set((detail as { url: string }).url, detail as Partial<ProductImageDetail>)
    }
  }
  return map
}

/**
 * Combines the legacy `images: string[]` URL list with the new, optional
 * `imageDetails` metadata array into one structured, ordered list. Existing
 * products with no `imageDetails` still work exactly as before — they just
 * get a generic, non-keyword-stuffed alt-text fallback derived from the
 * product title instead of an empty alt attribute.
 */
export function normalizeProductImages(
  images: unknown,
  imageDetails: unknown,
  fallback: ProductImageAltFallback = {}
): ProductImageMeta[] {
  if (!Array.isArray(images)) return []
  const detailsByUrl = toDetailMap(imageDetails)

  return images
    .filter((url): url is string => typeof url === 'string' && url.length > 0)
    .map((url, index) => {
      const detail = detailsByUrl.get(url)
      return {
        url,
        altEn: detail?.altEn || fallback.titleEn,
        altHe: detail?.altHe || fallback.titleHe,
        type: detail?.type,
        order: typeof detail?.order === 'number' ? detail.order : index,
      }
    })
    .sort((a, b) => a.order - b.order)
}

/** Picks the alt text for the requested locale, falling back to the other locale. */
export function getProductImageAlt(image: ProductImageMeta, locale: 'en' | 'he'): string {
  const primary = locale === 'he' ? image.altHe : image.altEn
  const secondary = locale === 'he' ? image.altEn : image.altHe
  return primary || secondary || ''
}
