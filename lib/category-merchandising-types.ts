import type { CollectionBanner } from '@/lib/collection-banners';

export type CategoryMerchandisingMode = 'auto' | 'pinned' | 'manual';

export const CATEGORY_MERCHANDISING_VERSION = 1;
export const MAX_CATEGORY_MERCHANDISING_VARIANT_KEYS = 2000;
export const CATEGORY_MERCHANDISING_COLLECTION = 'categoryMerchandising';

export interface CategoryMerchandising {
  categoryId: string;
  mode: CategoryMerchandisingMode;
  orderedVariantKeys: string[];
  /**
   * Grid banners for this category's listing. They live on the merchandising
   * document rather than on the category itself because that is where ordering
   * and placement already get edited - one place a merchandiser goes.
   */
  banners: CollectionBanner[];
  updatedAt: string;
  updatedBy?: string;
  version: number;
}

export function defaultCategoryMerchandising(categoryId: string): CategoryMerchandising {
  return {
    categoryId,
    mode: 'auto',
    orderedVariantKeys: [],
    banners: [],
    updatedAt: new Date().toISOString(),
    version: CATEGORY_MERCHANDISING_VERSION,
  };
}

