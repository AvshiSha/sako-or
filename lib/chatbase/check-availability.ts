import {
  availableColors,
  availableColorsForSize,
  availableSizesForColor,
  getVariant,
  isVariantPurchasable,
  resolveVariantPricing,
} from '@/lib/chatbase/product-availability'
import { identifyProduct } from '@/lib/chatbase/product-fetch'
import { buildColor, buildProductUrl } from '@/lib/chatbase/product-presenter'
import type {
  CheckAvailabilityRequest,
  CheckAvailabilityResult,
} from '@/lib/chatbase/check-availability-schema'

export * from '@/lib/chatbase/check-availability-schema'

function titleOf(product: { shortTitle_he?: string; shortTitle_en?: string; sku: string }, locale: 'he' | 'en') {
  const short = locale === 'he' ? product.shortTitle_he : product.shortTitle_en
  return short?.trim() || product.shortTitle_he?.trim() || product.shortTitle_en?.trim() || product.sku
}

export async function checkProductAvailability(
  request: CheckAvailabilityRequest
): Promise<CheckAvailabilityResult> {
  const he = request.locale === 'he'
  const identified = await identifyProduct({
    productId: request.productId,
    sku: request.sku,
    productUrl: request.productUrl,
  })

  if (identified.status === 'not_found') {
    return {
      found: false,
      available: false,
      message: he ? 'המוצר לא נמצא.' : 'Product not found.',
    }
  }

  if (identified.status === 'ambiguous') {
    return {
      found: true,
      ambiguous: true,
      candidates: identified.candidates,
      message: he
        ? 'נמצא יותר ממוצר אחד בקוד הזה. בקשו מהלקוח לאשר את הדגם.'
        : 'More than one product matches. Ask the customer which one they mean.',
    }
  }

  const { product } = identified
  const title = titleOf(product, request.locale)
  // An explicit colour parameter always beats one inferred from a URL: the
  // customer may be looking at the black page and asking about the beige.
  const colorSlug = request.color ?? identified.colorSlug
  const inStockColors = availableColors(product)

  if (!colorSlug) {
    // The question cannot be answered without a colour, and guessing one would
    // answer a different question than the one asked.
    return {
      found: true,
      requiresClarification: true,
      missingParameters: ['color'],
      sku: product.sku,
      title,
      availableColors: inStockColors.map((slug) => buildColor(slug, request.locale)),
      availableSizes: request.size
        ? []
        : [...new Set(inStockColors.flatMap((slug) => availableSizesForColor(product, slug)))].sort(
            (a, b) => Number(a) - Number(b)
          ),
      url: buildProductUrl(product.sku, inStockColors[0] ?? '', request.locale),
    }
  }

  const variant = getVariant(product, colorSlug)
  const available = isVariantPurchasable(product, variant, request.size ?? null)
  const { price, originalPrice } = resolveVariantPricing(product, variant)
  const url = buildProductUrl(product.sku, colorSlug, request.locale)
  const color = buildColor(colorSlug, request.locale)

  if (available) {
    return {
      found: true,
      available: true,
      sku: product.sku,
      title,
      color,
      size: request.size ?? null,
      price,
      originalPrice,
      currency: product.currency || 'ILS',
      url,
    }
  }

  // Unavailable: say what IS there, without ever crossing colour and size.
  return {
    found: true,
    available: false,
    sku: product.sku,
    title,
    color,
    size: request.size ?? null,
    price,
    originalPrice,
    currency: product.currency || 'ILS',
    url,
    availableSizesInRequestedColor: availableSizesForColor(product, colorSlug),
    availableColorsInRequestedSize: request.size
      ? availableColorsForSize(product, request.size).map((slug) =>
          buildColor(slug, request.locale)
        )
      : inStockColors.map((slug) => buildColor(slug, request.locale)),
    canSearchForAlternatives: true,
  }
}
