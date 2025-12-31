export type ParsedFavoriteKey = { baseSku: string; colorSlug: string }

/**
 * Canonical favorite key format:
 * - With color:  `${baseSku}::${colorSlug}`
 * - Without:     `${baseSku}`
 *
 * We normalize "no color" to empty string when parsing.
 */
export function buildFavoriteKey(baseSku: string, colorSlug?: string | null): string {
  const sku = (baseSku || '').trim()
  const color = (colorSlug || '').trim()
  if (!sku) return ''
  return color ? `${sku}::${color}` : sku
}

export function parseFavoriteKey(key: string): ParsedFavoriteKey {
  const trimmed = (key || '').trim()
  if (!trimmed) return { baseSku: '', colorSlug: '' }
  if (!trimmed.includes('::')) return { baseSku: trimmed, colorSlug: '' }

  const parts = trimmed.split('::')
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    // Treat malformed keys as "baseSku only" rather than throwing on the client.
    // (Server still validates strictly.)
    return { baseSku: trimmed, colorSlug: '' }
  }
  return { baseSku: parts[0], colorSlug: parts[1] }
}


