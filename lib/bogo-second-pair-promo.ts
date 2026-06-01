/** Base SKUs with automatic BOGO: 40% off the second pair in cart. */
export const BOGO_SECOND_PAIR_PROMO_SKUS = [
  '5024-0017',
  '5024-0019',
  '5024-0020',
] as const

const NORMALIZED_SKUS = new Set(
  BOGO_SECOND_PAIR_PROMO_SKUS.map((sku) => sku.trim().toLowerCase())
)

function normalizeSku(sku: string): string {
  return sku.trim().toLowerCase()
}

export function isBogoSecondPairPromoSku(
  sku: string | undefined | null,
  baseSku?: string | undefined | null
): boolean {
  const candidates = [sku, baseSku].filter(Boolean) as string[]
  return candidates.some((candidate) => NORMALIZED_SKUS.has(normalizeSku(candidate)))
}

export function getBogoSecondPairPromoLabel(
  language: 'en' | 'he',
  options?: { compact?: boolean }
): string {
  if (language === 'he') {
    return options?.compact ? 'זוג שני ב-40% הנחה' : '40% הנחה על הזוג השני'
  }
  return options?.compact ? '40% off · 2nd pair' : '40% off on the 2nd pair'
}
