export type VariantSizeStock = {
  isActive?: boolean;
  stockBySize?: Record<string, number>;
};

/** Normalize size keys for stockBySize lookup (trim, string; collapse numeric forms). */
export function normalizeSizeKey(size: string): string {
  const trimmed = String(size).trim();
  if (!trimmed) return "";
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return String(parseFloat(trimmed));
  }
  return trimmed;
}

export function buildSizeSet(sizes: string | string[]): Set<string> {
  const list = Array.isArray(sizes) ? sizes : [sizes];
  const set = new Set<string>();
  for (const s of list) {
    const key = normalizeSizeKey(String(s));
    if (key) set.add(key);
  }
  return set;
}

function stockQtyForSize(stockBySize: Record<string, number>, sizeKey: string): number | undefined {
  if (sizeKey in stockBySize) {
    return stockBySize[sizeKey];
  }
  for (const [k, qty] of Object.entries(stockBySize)) {
    if (normalizeSizeKey(k) === sizeKey) {
      return qty;
    }
  }
  return undefined;
}

/** True if variant has any selected size in stock (qty > 0). */
export function variantHasSizeInStock(
  variant: VariantSizeStock,
  sizes: string | string[]
): boolean {
  if (variant.isActive === false) return false;
  const sizeSet = buildSizeSet(sizes);
  if (sizeSet.size === 0) return true;
  const stockBySize = variant.stockBySize || {};
  return Array.from(sizeSet).some((sizeKey) => {
    const qty = stockQtyForSize(stockBySize, sizeKey);
    return typeof qty === "number" && qty > 0;
  });
}

/** Collect in-stock size keys from a variant (for facet UI). */
export function inStockSizeKeysFromVariant(variant: VariantSizeStock): string[] {
  if (variant.isActive === false) return [];
  const keys: string[] = [];
  for (const [size, qty] of Object.entries(variant.stockBySize || {})) {
    if (typeof qty === "number" && qty > 0) {
      const key = normalizeSizeKey(size);
      if (key) keys.push(key);
    }
  }
  return keys;
}
