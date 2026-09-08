import type { Product } from '@/lib/product-types'
import {
  inStockSizeKeysFromVariant,
  normalizeSizeKey,
  variantHasSizeInStock,
} from '@/lib/product-size'

/**
 * Stage B: the authoritative availability layer.
 *
 * Firestore is what the storefront, the cart and lib/cart-validation.ts all
 * read, so it decides here too. The rules below are the same ones
 * `resolveStock`/`resolveVariant` apply at checkout - product enabled and not
 * deleted, variant present and active, stock above zero for that exact size on
 * that exact variant. This module is the only place in the Chatbase API that
 * answers "can the customer buy this", so the two definitions cannot drift.
 *
 * Firestore is itself refreshed from Verifone every three hours, so "available"
 * means "available according to what the customer sees on the site", not
 * "reconciled with the till". Sharing the storefront's lag is the point: a bot
 * that contradicts the product page is worse than one that agrees with it.
 */

export type ProductVariant = Product['colorVariants'][string]

/** Product-level gate: the same three checks validateCartItems makes first. */
export function isProductPurchasable(product: Product | null | undefined): product is Product {
  if (!product) return false
  if (product.isDeleted) return false
  if (product.isEnabled === false) return false
  return true
}

export function activeVariants(product: Product): ProductVariant[] {
  return Object.values(product.colorVariants || {}).filter(
    (variant) => variant && variant.isActive !== false
  )
}

/**
 * Can this exact colour variant be bought, in this exact size?
 *
 * With no size, "purchasable" means some size of this colour is in stock -
 * never merely that the variant exists.
 */
export function isVariantPurchasable(
  product: Product,
  variant: ProductVariant | null | undefined,
  size?: string | null
): boolean {
  if (!isProductPurchasable(product)) return false
  if (!variant) return false
  if (variant.isActive === false) return false

  if (size) {
    return variantHasSizeInStock(variant, [normalizeSizeKey(size)])
  }
  return inStockSizeKeysFromVariant(variant).length > 0
}

export function getVariant(
  product: Product,
  colorSlug: string
): ProductVariant | undefined {
  return product.colorVariants?.[colorSlug]
}

/**
 * Every variant of this product that satisfies the requested colour AND size
 * together.
 *
 * Both conditions are tested against the same variant. Checking them
 * independently is what would let a black variant and a size-39 variant satisfy
 * a request for "black in 39" between them, while the combination is not
 * actually buyable.
 */
export function purchasableVariants(
  product: Product,
  filters: { colors?: string[]; sizes?: string[] } = {}
): ProductVariant[] {
  const colors = filters.colors?.length ? new Set(filters.colors) : null
  const sizes = filters.sizes?.length ? filters.sizes.map(normalizeSizeKey) : null

  return activeVariants(product).filter((variant) => {
    if (!variant.colorSlug) return false
    if (colors && !colors.has(variant.colorSlug)) return false
    if (sizes) return variantHasSizeInStock(variant, sizes)
    return inStockSizeKeysFromVariant(variant).length > 0
  })
}

/** In-stock sizes for one colour. Empty when the colour is absent or inactive. */
export function availableSizesForColor(product: Product, colorSlug: string): string[] {
  const variant = getVariant(product, colorSlug)
  if (!variant || variant.isActive === false) return []
  return sortSizes(inStockSizeKeysFromVariant(variant))
}

/** Colour slugs with this size in stock. Never reports another size's stock. */
export function availableColorsForSize(product: Product, size: string): string[] {
  const normalized = normalizeSizeKey(size)
  return activeVariants(product)
    .filter((variant) => !!variant.colorSlug && variantHasSizeInStock(variant, [normalized]))
    .map((variant) => variant.colorSlug)
    .sort()
}

/** Every colour slug with any stock at all. */
export function availableColors(product: Product): string[] {
  return activeVariants(product)
    .filter((variant) => !!variant.colorSlug && inStockSizeKeysFromVariant(variant).length > 0)
    .map((variant) => variant.colorSlug)
    .sort()
}

export function sortSizes(sizes: string[]): string[] {
  return [...new Set(sizes)].sort((a, b) => {
    const aNum = Number(a)
    const bNum = Number(b)
    if (Number.isFinite(aNum) && Number.isFinite(bNum)) return aNum - bNum
    return a.localeCompare(b)
  })
}

/**
 * Payable price for a variant, mirroring resolvePrice() in lib/cart-validation.ts.
 *
 * `originalPrice` is only set when a discount is actually in force, so a caller
 * can never render a struck-through price equal to the price beside it. No
 * product uses variant-level overrides today, but the storefront honours them,
 * so this does too.
 */
export function resolveVariantPricing(
  product: Product,
  variant: ProductVariant | null | undefined
): { price: number; originalPrice: number | null } {
  const basePrice = Number(variant?.priceOverride ?? product.price ?? 0)

  const variantSale = variant?.salePrice
  if (variantSale != null && variantSale > 0 && variantSale < basePrice) {
    return { price: Number(variantSale), originalPrice: basePrice }
  }

  const productSale = product.salePrice
  if (productSale != null && productSale > 0 && productSale < basePrice) {
    return { price: Number(productSale), originalPrice: basePrice }
  }

  return { price: basePrice, originalPrice: null }
}
