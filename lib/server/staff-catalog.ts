import 'server-only'

import { getCachedProductByBaseSku } from '@/lib/server/cached-product-data'
import { getProductImageAlt, normalizeProductImages } from '@/lib/product-images'
import type { StaffCatalogEnrichment } from '@/lib/staff/combine-stock'

/**
 * Optional catalog enrichment for the warehouse screen: the product name, and
 * one image per colour.
 *
 * Strictly optional, and the brief is emphatic about it. Verifone is the source
 * of truth for what exists in the warehouse; the website is a separate system
 * that may never have listed a model, may have delisted it, or may have a
 * colour with no photography. None of that may prevent a lookup, a stock
 * figure, or a location edit.
 *
 * So: this function is called alongside the Verifone and database reads rather
 * than before them, it is allowed to fail, and a failure degrades to "no name,
 * no images" instead of failing the request. Nothing here filters on
 * `isActive` -- a colour pulled from the storefront still occupies a drawer.
 */

/**
 * Builds the enrichment for one model.
 *
 * Returns null when the website does not know the model at all, which is a
 * normal outcome rather than an error.
 *
 * Images are keyed by colour slug and only ever hold that colour's own
 * pictures. There is no cross-colour fallback anywhere in this module: showing
 * a picker the black shoe when they asked about the red one sends them to the
 * wrong drawer, which is worse than showing no image.
 */
export async function loadStaffCatalogEnrichment(
  modelCode: string
): Promise<StaffCatalogEnrichment | null> {
  const product = (await getCachedProductByBaseSku(modelCode)) as
    | {
        title_he?: string | null
        title_en?: string | null
        colorVariants?: Record<string, unknown> | null
      }
    | null
    | undefined

  if (!product) return null

  const titleHe = typeof product.title_he === 'string' ? product.title_he.trim() : ''
  const titleEn = typeof product.title_en === 'string' ? product.title_en.trim() : ''
  const productName = titleHe || titleEn || null

  const imagesByColorSlug: StaffCatalogEnrichment['imagesByColorSlug'] = {}

  const colorVariants = product.colorVariants
  if (colorVariants && typeof colorVariants === 'object') {
    for (const [colorSlug, rawVariant] of Object.entries(colorVariants)) {
      const variant = rawVariant as
        | {
            images?: unknown
            imageDetails?: unknown
            primaryImage?: unknown
          }
        | null
        | undefined

      if (!variant) {
        imagesByColorSlug[colorSlug] = null
        continue
      }

      const normalized = normalizeProductImages(variant.images, variant.imageDetails, {
        titleEn: titleEn || undefined,
        titleHe: titleHe || undefined,
      })

      // Prefer the variant's declared primary image, which is what the
      // storefront shows on a card; otherwise the first by `order`.
      const primaryUrl =
        typeof variant.primaryImage === 'string' && variant.primaryImage
          ? variant.primaryImage
          : null

      const chosen =
        (primaryUrl && normalized.find((image) => image.url === primaryUrl)) ||
        normalized[0] ||
        null

      if (!chosen) {
        imagesByColorSlug[colorSlug] = null
        continue
      }

      imagesByColorSlug[colorSlug] = {
        url: chosen.url,
        // May be empty; the component treats an empty alt as a decorative
        // image rather than inventing a description.
        alt: getProductImageAlt(chosen, 'he'),
      }
    }
  }

  return { productName, imagesByColorSlug }
}
