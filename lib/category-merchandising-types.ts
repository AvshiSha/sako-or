export type CategoryMerchandisingMode = 'auto' | 'pinned' | 'manual';

export const CATEGORY_MERCHANDISING_VERSION = 1;
export const MAX_CATEGORY_MERCHANDISING_VARIANT_KEYS = 2000;
export const CATEGORY_MERCHANDISING_COLLECTION = 'categoryMerchandising';

export interface CategoryMerchandising {
  categoryId: string;
  mode: CategoryMerchandisingMode;
  orderedVariantKeys: string[];
  updatedAt: string;
  updatedBy?: string;
  version: number;
}

export function defaultCategoryMerchandising(categoryId: string): CategoryMerchandising {
  return {
    categoryId,
    mode: 'auto',
    orderedVariantKeys: [],
    updatedAt: new Date().toISOString(),
    version: CATEGORY_MERCHANDISING_VERSION,
  };
}

