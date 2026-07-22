// Pure, dependency-free deletion policy for categories — kept separate from
// lib/category-mutations.ts (which pulls in the Firebase Admin SDK and
// `server-only`) so it can be unit tested without any Firestore setup.

export type CategoryDeletionBlockReason = 'HAS_PRODUCTS' | 'HAS_CHILDREN';

export interface CategoryDeletionPlan {
  allowed: boolean;
  reason?: CategoryDeletionBlockReason;
  childCount: number;
  productCount: number;
}

/**
 * - Product references always block deletion — there's no defined business
 *   rule yet for what should happen to a product's category assignment when
 *   its category disappears, so we refuse to guess.
 * - Child categories block deletion unless the caller explicitly opted into
 *   a cascade (after being shown a confirmation listing exactly what will
 *   be removed).
 */
export function evaluateCategoryDeletion(input: {
  childCount: number;
  productCount: number;
  cascade: boolean;
}): CategoryDeletionPlan {
  const { childCount, productCount, cascade } = input;

  if (productCount > 0) {
    return { allowed: false, reason: 'HAS_PRODUCTS', childCount, productCount };
  }

  if (childCount > 0 && !cascade) {
    return { allowed: false, reason: 'HAS_CHILDREN', childCount, productCount };
  }

  return { allowed: true, childCount, productCount };
}
