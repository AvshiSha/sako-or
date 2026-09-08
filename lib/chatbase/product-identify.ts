import type { Product } from '@/lib/product-types'
import { getBaseSku } from '@/lib/sku-parser'

/**
 * Resolving "which product is the customer talking about".
 *
 * Identification is exact by design. A fuzzy or prefix SKU match could answer a
 * stock question about the wrong shoe, which is worse than admitting we are not
 * sure - so when the input is ambiguous this returns the candidates and lets
 * Chatbase ask, rather than guessing.
 */

export type ProductIdentifier = {
  productId?: string
  sku?: string
  productUrl?: string
}

export type ParsedIdentifier = {
  /** Base SKU to look up, exactly. */
  sku: string
  /** Colour carried by the identifier itself (a URL path or a productId). */
  colorSlug?: string
}

export type IdentifyResult =
  | { status: 'found'; product: Product; colorSlug?: string }
  | { status: 'not_found' }
  | { status: 'ambiguous'; candidates: Array<{ sku: string; title: string }> }

/**
 * Pull a SKU, and a colour when present, out of any identifier the agent has.
 *
 * `productId` is the `sku:colour` pair this API hands out; `productUrl` is a
 * storefront link, whose path already names both. An explicit `color` parameter
 * always wins over one inferred here - see resolveRequestedColor().
 */
export function parseIdentifier(identifier: ProductIdentifier): ParsedIdentifier | null {
  const { productId, sku, productUrl } = identifier

  if (productId?.trim()) {
    const [rawSku, colorSlug] = productId.trim().split(':')
    if (rawSku) {
      return { sku: getBaseSku(rawSku.trim()), colorSlug: colorSlug?.trim() || undefined }
    }
  }

  if (sku?.trim()) {
    return { sku: getBaseSku(sku.trim()) }
  }

  if (productUrl?.trim()) {
    const parsed = parseProductUrl(productUrl.trim())
    if (parsed) return parsed
  }

  return null
}

/**
 * `/{locale}/product/{baseSku}/{colorSlug}` - the storefront's product route.
 * Accepts an absolute URL or a bare path, and tolerates a query string or
 * trailing slash. Anything that is not that shape returns null rather than a
 * half-guess.
 */
export function parseProductUrl(url: string): ParsedIdentifier | null {
  let pathname = url
  try {
    if (/^https?:\/\//i.test(url)) {
      pathname = new URL(url).pathname
    } else {
      pathname = url.split('?')[0].split('#')[0]
    }
  } catch {
    return null
  }

  const segments = pathname.split('/').filter(Boolean).map((segment) => {
    try {
      return decodeURIComponent(segment)
    } catch {
      return segment
    }
  })

  const productIndex = segments.indexOf('product')
  if (productIndex === -1) return null

  const sku = segments[productIndex + 1]
  if (!sku) return null

  const colorSlug = segments[productIndex + 2]
  return { sku: getBaseSku(sku), colorSlug: colorSlug || undefined }
}
