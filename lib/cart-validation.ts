import { productService } from './firebase'
import type { Product } from './product-types'

export type CartValidationReasonCode =
  | 'PRODUCT_NOT_FOUND'
  | 'PRODUCT_DELETED'
  | 'PRODUCT_UNPUBLISHED'
  | 'VARIANT_NOT_FOUND'
  | 'VARIANT_INACTIVE'
  | 'OUT_OF_STOCK'
  | 'STOCK_INSUFFICIENT'

export interface CartValidationInputItem {
  sku: string
  color?: string | null
  size?: string | null
  quantity: number
}

export interface CartValidationResultItem {
  sku: string
  color: string | null
  size: string | null
  requestedQuantity: number
  finalQuantity: number
  stock: number
  /** True only if the item is fully purchasable as requested, with no adjustment needed. */
  available: boolean
  /** True when the requested quantity exceeded stock and was clamped down. */
  adjusted: boolean
  reasonCode?: CartValidationReasonCode
  name: { en: string; he: string }
  price: number
  salePrice: number | null
  currency: string
  image: string | null
}

export interface CartValidationResult {
  items: CartValidationResultItem[]
  purchasableSubtotal: number
  hadAdjustments: boolean
}

function resolveVariant(product: Product, colorSlug: string | null) {
  if (!colorSlug) return null
  return product.colorVariants?.[colorSlug] || null
}

function resolvePrice(product: Product, variant: ReturnType<typeof resolveVariant>) {
  const basePrice = Number(variant?.priceOverride ?? product.price ?? 0)

  const variantSalePrice = variant?.salePrice
  if (variantSalePrice != null && variantSalePrice > 0 && variantSalePrice < basePrice) {
    return { price: basePrice, salePrice: Number(variantSalePrice) }
  }

  const productSalePrice = product.salePrice
  if (productSalePrice != null && productSalePrice > 0 && productSalePrice < basePrice) {
    return { price: basePrice, salePrice: Number(productSalePrice) }
  }

  return { price: basePrice, salePrice: null as number | null }
}

function resolveStock(product: Product, colorSlug: string | null, sizeSlug: string | null) {
  const colorVariants = product.colorVariants || {}

  if (colorSlug) {
    const variant = colorVariants[colorSlug]
    if (!variant) return { stock: 0, variantFound: false, variant: null, inactive: false }
    if (variant.isActive === false) return { stock: 0, variantFound: true, variant, inactive: true }

    const stockBySize = variant.stockBySize || {}
    const stock = sizeSlug
      ? Number(stockBySize[sizeSlug] || 0)
      : Object.values(stockBySize).reduce((sum: number, s) => sum + Number(s || 0), 0)

    return { stock, variantFound: true, variant, inactive: false }
  }

  // No color specified – aggregate across active variants only.
  const activeVariants = Object.values(colorVariants).filter(v => v.isActive !== false)

  let stock: number
  let variant: (typeof activeVariants)[number] | null

  if (sizeSlug) {
    stock = activeVariants.reduce((sum, v) => sum + Number(v.stockBySize?.[sizeSlug] || 0), 0)
    variant = activeVariants.find(v => Number(v.stockBySize?.[sizeSlug] || 0) > 0) || activeVariants[0] || null
  } else {
    stock = activeVariants.reduce((sum, v) => {
      const bySize = v.stockBySize || {}
      return sum + Object.values(bySize).reduce<number>((inner, s) => inner + Number(s || 0), 0)
    }, 0)
    variant = activeVariants[0] || null
  }

  return { stock, variantFound: true, variant, inactive: false }
}

export async function validateCartItems(
  items: CartValidationInputItem[]
): Promise<CartValidationResult> {
  const productCache = new Map<string, Product | null>()
  const resultItems: CartValidationResultItem[] = []
  let hadAdjustments = false

  for (const item of items) {
    const sku = typeof item?.sku === 'string' ? item.sku.trim() : ''
    const colorSlug = item.color || null
    const sizeSlug = item.size || null
    const requestedQuantity = Number.isFinite(item.quantity) ? Math.max(0, Math.floor(item.quantity)) : 0

    const emptyResult = (reasonCode: CartValidationReasonCode): CartValidationResultItem => ({
      sku,
      color: colorSlug,
      size: sizeSlug,
      requestedQuantity,
      finalQuantity: 0,
      stock: 0,
      available: false,
      adjusted: false,
      reasonCode,
      name: { en: '', he: '' },
      price: 0,
      salePrice: null,
      currency: 'ILS',
      image: null
    })

    if (!sku) {
      resultItems.push(emptyResult('PRODUCT_NOT_FOUND'))
      hadAdjustments = true
      continue
    }

    let product = productCache.get(sku)
    if (product === undefined) {
      product = await productService.getProductByBaseSku(sku)
      productCache.set(sku, product)
    }

    if (!product) {
      resultItems.push(emptyResult('PRODUCT_NOT_FOUND'))
      hadAdjustments = true
      continue
    }

    if (product.isDeleted) {
      resultItems.push(emptyResult('PRODUCT_DELETED'))
      hadAdjustments = true
      continue
    }

    if (product.isEnabled === false) {
      resultItems.push(emptyResult('PRODUCT_UNPUBLISHED'))
      hadAdjustments = true
      continue
    }

    if (colorSlug && !resolveVariant(product, colorSlug)) {
      resultItems.push(emptyResult('VARIANT_NOT_FOUND'))
      hadAdjustments = true
      continue
    }

    const { stock, variant, inactive } = resolveStock(product, colorSlug, sizeSlug)

    if (inactive) {
      resultItems.push(emptyResult('VARIANT_INACTIVE'))
      hadAdjustments = true
      continue
    }

    const { price, salePrice } = resolvePrice(product, variant)
    const image = variant?.primaryImage || (Array.isArray(variant?.images) ? variant.images[0] : null) || null
    const name = { en: product.title_en || product.name?.en || '', he: product.title_he || product.name?.he || '' }

    let finalQuantity = requestedQuantity
    let adjusted = false
    let reasonCode: CartValidationReasonCode | undefined

    if (stock <= 0) {
      finalQuantity = 0
      reasonCode = 'OUT_OF_STOCK'
    } else if (requestedQuantity > stock) {
      finalQuantity = stock
      adjusted = true
      reasonCode = 'STOCK_INSUFFICIENT'
    }

    if (adjusted || reasonCode) {
      hadAdjustments = true
    }

    resultItems.push({
      sku,
      color: colorSlug,
      size: sizeSlug,
      requestedQuantity,
      finalQuantity,
      stock,
      available: !reasonCode && !adjusted,
      adjusted,
      reasonCode,
      name,
      price,
      salePrice,
      currency: product.currency || 'ILS',
      image
    })
  }

  const purchasableSubtotal = resultItems.reduce((sum, item) => {
    if (!item.available) return sum
    const unitPrice = item.salePrice != null ? item.salePrice : item.price
    return sum + unitPrice * item.finalQuantity
  }, 0)

  return { items: resultItems, purchasableSubtotal, hadAdjustments }
}
