export type ParsedCartKey = { 
  baseSku: string
  colorSlug: string | null
  sizeSlug: string | null
}

/**
 * Canonical cart key format (Favorites-style, extended with size):
 * - With color and size:  `${baseSku}::${colorSlug}::${sizeSlug}`
 * - With color only:      `${baseSku}::${colorSlug}`
 * - With size only:       `${baseSku}::${sizeSlug}`
 * - Without either:       `${baseSku}`
 *
 * We normalize "no color/size" to empty string / null when parsing.
 */
export function buildCartKey(
  baseSku: string,
  colorSlug?: string | null,
  sizeSlug?: string | null
): string {
  const sku = (baseSku || '').trim()
  const color = (colorSlug || '').trim()
  const size = (sizeSlug || '').trim()
  
  if (!sku) return ''
  
  if (color && size) {
    return `${sku}::${color}::${size}`
  } else if (color) {
    return `${sku}::${color}`
  } else if (size) {
    return `${sku}::${size}`
  } else {
    return sku
  }
}

export function parseCartKey(key: string): ParsedCartKey {
  const trimmed = (key || '').trim()
  if (!trimmed) return { baseSku: '', colorSlug: null, sizeSlug: null }
  
  if (!trimmed.includes('::')) {
    return { baseSku: trimmed, colorSlug: null, sizeSlug: null }
  }
  
  const parts = trimmed.split('::')
  
  if (parts.length === 2) {
    // Could be baseSku::color or baseSku::size
    // We can't distinguish without context, so we treat it as baseSku::color for consistency
    return { 
      baseSku: parts[0] || '', 
      colorSlug: parts[1] || null,
      sizeSlug: null
    }
  }
  
  if (parts.length === 3) {
    return { 
      baseSku: parts[0] || '', 
      colorSlug: parts[1] || null,
      sizeSlug: parts[2] || null
    }
  }
  
  // Malformed keys: treat as baseSku only
  return { baseSku: trimmed, colorSlug: null, sizeSlug: null }
}

