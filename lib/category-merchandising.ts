import 'server-only';

import type { QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import {
  dedupeVariantKeys,
  isValidVariantKey,
} from '@/lib/campaign-merchandising-types';
import {
  CATEGORY_MERCHANDISING_COLLECTION,
  CATEGORY_MERCHANDISING_VERSION,
  CategoryMerchandising,
  CategoryMerchandisingMode,
  MAX_CATEGORY_MERCHANDISING_VARIANT_KEYS,
  defaultCategoryMerchandising,
} from '@/lib/category-merchandising-types';
import { resolveMerchandisingPreviewRows } from '@/lib/campaign-merchandising';
import { sanitizeCollectionBanners, type CollectionBanner } from '@/lib/collection-banners';

export type { CategoryMerchandising, CategoryMerchandisingMode } from '@/lib/category-merchandising-types';
export {
  CATEGORY_MERCHANDISING_COLLECTION,
  CATEGORY_MERCHANDISING_VERSION,
  defaultCategoryMerchandising,
} from '@/lib/category-merchandising-types';

function docRef(categoryId: string) {
  return adminDb.collection(CATEGORY_MERCHANDISING_COLLECTION).doc(categoryId);
}

export async function getCategoryMerchandisingAdmin(categoryId: string): Promise<CategoryMerchandising> {
  const snap = await docRef(categoryId).get();
  if (!snap.exists) {
    return defaultCategoryMerchandising(categoryId);
  }
  const data = snap.data() as Partial<CategoryMerchandising>;
  return {
    categoryId,
    mode: data.mode ?? 'auto',
    orderedVariantKeys: Array.isArray(data.orderedVariantKeys)
      ? dedupeVariantKeys(data.orderedVariantKeys)
      : [],
    // Sanitised on read as well as on write: these documents predate the field,
    // and a banner saved by an older shape should cost that banner rather than
    // the listing it sits in.
    banners: sanitizeCollectionBanners(data.banners),
    updatedAt: data.updatedAt ?? new Date().toISOString(),
    updatedBy: data.updatedBy,
    version: data.version ?? CATEGORY_MERCHANDISING_VERSION,
  };
}

/**
 * Enabled grid banners for a category listing, for the storefront.
 *
 * Reads the field directly rather than going through getCategoryMerchandisingAdmin
 * so a page render does not also deserialise up to 2000 ordered variant keys it
 * has no use for.
 */
export async function getCategoryGridBanners(categoryId: string): Promise<CollectionBanner[]> {
  const snap = await docRef(categoryId).get();
  if (!snap.exists) return [];
  const data = snap.data() as { banners?: unknown } | undefined;
  return sanitizeCollectionBanners(data?.banners).filter((banner) => banner.enabled);
}

/**
 * Save only the banners.
 *
 * Deliberately separate from saveCategoryMerchandisingAdmin: that one needs a
 * mode and a full ordering, so a banner edit routed through it would have to echo
 * both back and could clobber a reorder saved from the board in between. This
 * touches one field and leaves the rest of the document alone.
 */
export async function saveCategoryBannersAdmin(
  categoryId: string,
  banners: unknown,
  updatedBy?: string
): Promise<CategoryMerchandising> {
  const sanitized = sanitizeCollectionBanners(banners);
  const now = new Date().toISOString();

  await docRef(categoryId).set(
    {
      categoryId,
      banners: sanitized,
      updatedAt: now,
      updatedBy,
      version: CATEGORY_MERCHANDISING_VERSION,
    },
    { merge: true }
  );

  return getCategoryMerchandisingAdmin(categoryId);
}

export async function saveCategoryMerchandisingAdmin(
  categoryId: string,
  payload: {
    mode: CategoryMerchandisingMode;
    orderedVariantKeys: string[];
    /** Omitted leaves the stored banners untouched, so ordering saves cannot wipe them. */
    banners?: unknown;
    updatedBy?: string;
  }
): Promise<CategoryMerchandising> {
  const orderedVariantKeys = dedupeVariantKeys(payload.orderedVariantKeys);
  if (orderedVariantKeys.length > MAX_CATEGORY_MERCHANDISING_VARIANT_KEYS) {
    throw new Error(
      `Cannot save more than ${MAX_CATEGORY_MERCHANDISING_VARIANT_KEYS} variant keys`
    );
  }
  for (const key of orderedVariantKeys) {
    if (!isValidVariantKey(key)) {
      throw new Error(`Invalid variant key: ${key}`);
    }
  }

  // The board saves ordering and the banner editor saves banners; each posts only
  // its own field, so an absent `banners` means "leave them alone" rather than
  // "there are none".
  const banners =
    payload.banners === undefined
      ? (await getCategoryMerchandisingAdmin(categoryId)).banners
      : sanitizeCollectionBanners(payload.banners);

  const now = new Date().toISOString();
  const doc: CategoryMerchandising = {
    categoryId,
    mode: payload.mode,
    orderedVariantKeys,
    banners,
    updatedAt: now,
    updatedBy: payload.updatedBy,
    version: CATEGORY_MERCHANDISING_VERSION,
  };

  await docRef(categoryId).set(doc, { merge: true });
  return doc;
}

type AdminColorVariant = {
  colorSlug?: string;
  isActive?: boolean;
};

type AdminProduct = {
  id: string;
  isEnabled?: boolean;
  isDeleted?: boolean;
  createdAt?: unknown;
  colorVariants?: Record<string, AdminColorVariant>;
};

async function loadColorVariantsAdmin(product: AdminProduct): Promise<Record<string, AdminColorVariant>> {
  const embedded = product.colorVariants && Object.keys(product.colorVariants).length > 0;
  if (embedded) {
    const normalized: Record<string, AdminColorVariant> = {};
    for (const [, variant] of Object.entries(product.colorVariants!)) {
      if (!variant.colorSlug) continue;
      normalized[variant.colorSlug] = {
        colorSlug: variant.colorSlug,
        isActive: variant.isActive,
      };
    }
    return normalized;
  }

  const snap = await adminDb.collection('colorVariants').where('productId', '==', product.id).get();
  const variants: Record<string, AdminColorVariant> = {};
  for (const doc of snap.docs) {
    const data = doc.data() as { colorSlug?: string; isActive?: boolean };
    if (!data.colorSlug) continue;
    variants[data.colorSlug] = { colorSlug: data.colorSlug, isActive: data.isActive };
  }
  return variants;
}

export async function syncCategoryMerchandisingVariantKeys(
  categoryId: string,
  productLimit?: number
): Promise<string[]> {
  const keys: string[] = [];
  let matchedProducts = 0;
  let lastDoc: QueryDocumentSnapshot | undefined;

  while (true) {
    let q = adminDb
      .collection('products')
      .where('categories_path_id', 'array-contains', categoryId)
      .where('isEnabled', '==', true)
      .where('isDeleted', '==', false)
      .orderBy('createdAt', 'desc')
      .limit(75);

    if (lastDoc) {
      q = q.startAfter(lastDoc);
    }

    const snap = await q.get();
    if (snap.empty) break;

    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      if (data.isDeleted) continue;
      if (productLimit && productLimit > 0 && matchedProducts >= productLimit) {
        return keys;
      }

      const product = { id: docSnap.id, ...data } as AdminProduct;
      const variants = await loadColorVariantsAdmin(product);
      let addedForProduct = 0;
      for (const variant of Object.values(variants)) {
        if (variant.isActive === false || !variant.colorSlug) continue;
        keys.push(`${product.id}-${variant.colorSlug}`);
        addedForProduct += 1;
      }
      if (addedForProduct > 0) {
        matchedProducts += 1;
      }
    }

    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.docs.length < 75) break;
  }

  return keys;
}

export async function listCategoryMerchandisingPool(
  categoryId: string,
  options: {
    page: number;
    pageSize: number;
    q?: string;
    excludeKeys?: string[];
    productLimit?: number;
  }
): Promise<{ variantKeys: string[]; total: number; page: number; hasMore: boolean }> {
  const allKeys = await syncCategoryMerchandisingVariantKeys(categoryId, options.productLimit);
  const exclude = new Set(options.excludeKeys ?? []);
  let filtered = allKeys.filter((k) => !exclude.has(k));

  const query = options.q?.trim().toLowerCase();
  if (query) {
    // Search must consider the full pool, not just an arbitrary prefix,
    // otherwise matches beyond the cutoff are invisible to admins.
    const matchingKeys: string[] = [];
    const chunkSize = 200;
    for (let i = 0; i < filtered.length; i += chunkSize) {
      const chunk = filtered.slice(i, i + chunkSize);
      const previews = await resolveMerchandisingPreviewRows(chunk, { lang: 'en' });
      for (const p of previews) {
        const haystack =
          `${p.productName} ${p.sku ?? ''} ${p.colorSlug} ${p.variantKey}`.toLowerCase();
        if (haystack.includes(query)) {
          matchingKeys.push(p.variantKey);
        }
      }
    }
    const matchingSet = new Set(matchingKeys);
    filtered = filtered.filter((k) => matchingSet.has(k));
  }

  const page = Math.max(1, options.page);
  const pageSize = Math.min(100, Math.max(1, options.pageSize));
  const start = (page - 1) * pageSize;
  const slice = filtered.slice(start, start + pageSize);

  return {
    variantKeys: slice,
    total: filtered.length,
    page,
    hasMore: start + pageSize < filtered.length,
  };
}

