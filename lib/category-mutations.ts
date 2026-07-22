import 'server-only';

import { adminDb } from '@/lib/firebase-admin';
import { prisma } from '@/lib/prisma';

export type { CategoryDeletionBlockReason, CategoryDeletionPlan } from '@/lib/category-deletion-policy';
export { evaluateCategoryDeletion } from '@/lib/category-deletion-policy';

export const CATEGORIES_COLLECTION = 'categories';
export const PRODUCTS_COLLECTION = 'products';

// Firestore caps `array-contains-any` at 30 values per query.
const ARRAY_CONTAINS_ANY_CHUNK_SIZE = 30;

export interface CategoryRecord {
  id: string;
  name?: { en?: string; he?: string } | string;
  level: number;
  parentId?: string | null;
  isEnabled: boolean;
}

function toCategoryRecord(id: string, data: FirebaseFirestore.DocumentData): CategoryRecord {
  return {
    id,
    name: data.name,
    level: typeof data.level === 'number' ? data.level : 0,
    parentId: data.parentId ?? null,
    isEnabled: Boolean(data.isEnabled),
  };
}

export async function getCategoryById(categoryId: string): Promise<CategoryRecord | null> {
  const snap = await adminDb.collection(CATEGORIES_COLLECTION).doc(categoryId).get();
  if (!snap.exists) return null;
  return toCategoryRecord(snap.id, snap.data() as FirebaseFirestore.DocumentData);
}

/**
 * Walks the category tree breadth-first via `parentId`, collecting every
 * descendant (sub-categories and sub-sub-categories) of `categoryId`.
 * Categories are only 3 levels deep, so this is at most 2 hops.
 */
export async function getCategoryDescendants(categoryId: string): Promise<CategoryRecord[]> {
  const descendants: CategoryRecord[] = [];
  let frontier = [categoryId];

  while (frontier.length > 0) {
    const nextFrontier: string[] = [];
    for (const parentId of frontier) {
      const snap = await adminDb
        .collection(CATEGORIES_COLLECTION)
        .where('parentId', '==', parentId)
        .get();
      for (const doc of snap.docs) {
        const record = toCategoryRecord(doc.id, doc.data());
        descendants.push(record);
        nextFrontier.push(doc.id);
      }
    }
    frontier = nextFrontier;
  }

  return descendants;
}

/**
 * Counts products that reference any of the given category IDs via
 * `categories_path_id` (populated for main/sub/sub-sub assignment alike —
 * see app/admin/products/*.tsx). Stops as soon as `sampleLimit` example
 * product ids have been collected; `count` reflects the true total.
 */
export async function countProductReferences(
  categoryIds: string[],
  sampleLimit = 5
): Promise<{ count: number; sampleProductIds: string[] }> {
  if (categoryIds.length === 0) return { count: 0, sampleProductIds: [] };

  let count = 0;
  const sampleProductIds: string[] = [];

  for (let i = 0; i < categoryIds.length; i += ARRAY_CONTAINS_ANY_CHUNK_SIZE) {
    const chunk = categoryIds.slice(i, i + ARRAY_CONTAINS_ANY_CHUNK_SIZE);
    const snap = await adminDb
      .collection(PRODUCTS_COLLECTION)
      .where('categories_path_id', 'array-contains-any', chunk)
      .get();
    count += snap.size;
    for (const doc of snap.docs) {
      if (sampleProductIds.length < sampleLimit) sampleProductIds.push(doc.id);
    }
  }

  return { count, sampleProductIds };
}

/**
 * Deletes a category and (optionally, pre-validated) descendants atomically
 * in a single batch — either every doc goes or none does.
 */
export async function deleteCategorySubtree(categoryId: string, descendantIds: string[]): Promise<void> {
  const batch = adminDb.batch();
  for (const id of [categoryId, ...descendantIds]) {
    batch.delete(adminDb.collection(CATEGORIES_COLLECTION).doc(id));
  }
  await batch.commit();
}

function categoryNameEn(name: CategoryRecord['name'] | undefined): string | null {
  if (!name) return null;
  const en = typeof name === 'string' ? name : name.en;
  return en && en.trim() ? en : null;
}

/**
 * Firestore is the source of truth for categories; the Neon/Postgres
 * `Category` table is a separate, manually-triggered one-way mirror (see
 * /admin/categories/sync and app/api/admin/categories/sync/route.ts) matched
 * by `name_en` — there's no stored Firebase-id <-> Neon-id mapping. These
 * helpers are best-effort: they keep the mirror from silently drifting
 * further out of sync on every enable/disable/delete, but never fail the
 * primary Firestore mutation if Neon is unreachable or a row doesn't exist
 * there (e.g. it was created before the first sync ran).
 */
export async function mirrorCategoryEnabledToNeon(
  name: CategoryRecord['name'] | undefined,
  isEnabled: boolean
): Promise<void> {
  const nameEn = categoryNameEn(name);
  if (!nameEn) return;
  try {
    await prisma.category.updateMany({
      where: { name_en: nameEn },
      data: { isEnabled, updatedAt: new Date() },
    });
  } catch (error) {
    console.error(`[categories] Neon mirror: failed to sync isEnabled for "${nameEn}":`, error);
  }
}

/**
 * Deletes the matching Neon rows, deepest descendant first, so the
 * self-referential `parentId` foreign key never points at an already-deleted
 * row mid-operation. `namesDeepestFirst` must already be ordered that way —
 * callers pass sub-sub-categories, then sub-categories, then the category
 * itself last.
 */
export async function mirrorCategoryDeletionToNeon(
  namesDeepestFirst: (CategoryRecord['name'] | undefined)[]
): Promise<void> {
  for (const name of namesDeepestFirst) {
    const nameEn = categoryNameEn(name);
    if (!nameEn) continue;
    try {
      await prisma.category.deleteMany({ where: { name_en: nameEn } });
    } catch (error) {
      console.error(`[categories] Neon mirror: failed to delete "${nameEn}":`, error);
    }
  }
}
