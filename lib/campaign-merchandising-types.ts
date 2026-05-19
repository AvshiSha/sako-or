export type CampaignMerchandisingMode = 'auto' | 'pinned' | 'manual';

export const CAMPAIGN_MERCHANDISING_VERSION = 1;
export const MAX_MERCHANDISING_VARIANT_KEYS = 2000;
export const MERCHANDISING_COLLECTION = 'campaignMerchandising';

export interface CampaignMerchandising {
  campaignSlug: string;
  mode: CampaignMerchandisingMode;
  orderedVariantKeys: string[];
  updatedAt: string;
  updatedBy?: string;
  version: number;
}

export interface MerchandisingPreviewRow {
  variantKey: string;
  productId: string;
  colorSlug: string;
  productName: string;
  colorName?: string;
  sku?: string;
  imageUrl?: string;
  isActive: boolean;
  isStale?: boolean;
  totalStock?: number;
}

/**
 * Variant keys are built as `${productId}-${colorSlug}` (see expandProductsToVariants).
 * Product IDs are Firestore doc IDs (no hyphens). Color slugs may contain hyphens (e.g. "dark-brown"),
 * so we split on the **first** hyphen only — not the last.
 */
export function parseVariantKey(variantKey: string): { productId: string; colorSlug: string } | null {
  const trimmed = variantKey.trim();
  if (!trimmed) return null;
  const firstDash = trimmed.indexOf('-');
  if (firstDash <= 0 || firstDash >= trimmed.length - 1) return null;
  return {
    productId: trimmed.slice(0, firstDash),
    colorSlug: trimmed.slice(firstDash + 1),
  };
}

export function buildVariantKey(productId: string, colorSlug: string): string {
  return `${productId}-${colorSlug}`;
}

export function isValidVariantKey(key: string): boolean {
  return parseVariantKey(key) !== null;
}

export function dedupeVariantKeys(keys: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const key of keys) {
    const trimmed = key.trim();
    if (!trimmed || !isValidVariantKey(trimmed) || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

/** Campaign slugs: lowercase alphanumeric + hyphens (matches admin CampaignForm). */
export function parseCampaignSlug(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || !/^[a-z0-9-]+$/.test(trimmed)) return null;
  return trimmed;
}

export function defaultCampaignMerchandising(campaignSlug: string): CampaignMerchandising {
  return {
    campaignSlug,
    mode: 'auto',
    orderedVariantKeys: [],
    updatedAt: new Date().toISOString(),
    version: CAMPAIGN_MERCHANDISING_VERSION,
  };
}
