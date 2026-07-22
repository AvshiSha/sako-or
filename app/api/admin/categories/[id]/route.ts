import * as Sentry from '@sentry/nextjs';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/server/auth';
import { adminDb } from '@/lib/firebase-admin';
import {
  CATEGORIES_COLLECTION,
  countProductReferences,
  deleteCategorySubtree,
  evaluateCategoryDeletion,
  getCategoryById,
  getCategoryDescendants,
  mirrorCategoryDeletionToNeon,
  mirrorCategoryEnabledToNeon,
} from '@/lib/category-mutations';

const patchSchema = z.object({
  isEnabled: z.boolean(),
});

// PATCH /api/admin/categories/:id — currently only supports toggling
// isEnabled. Full field edits still go through the client SDK form; this
// endpoint exists so enable/disable is validated and logged server-side
// instead of relying solely on Firestore security rules.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid payload', issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const category = await getCategoryById(id);
  if (!category) {
    return NextResponse.json({ error: 'Category not found' }, { status: 404 });
  }

  try {
    await adminDb.collection(CATEGORIES_COLLECTION).doc(id).update({
      isEnabled: parsed.data.isEnabled,
      updatedAt: new Date(),
    });

    // Best-effort — Firestore is already the source of truth and the write
    // above already succeeded; a Neon hiccup here must not fail the request.
    await mirrorCategoryEnabledToNeon(category.name, parsed.data.isEnabled);

    return NextResponse.json({
      id,
      isEnabled: parsed.data.isEnabled,
    });
  } catch (error) {
    Sentry.captureException(error);
    console.error(`[categories] Failed to update isEnabled for category ${id}:`, error);
    return NextResponse.json({ error: 'Failed to update category' }, { status: 500 });
  }
}

// DELETE /api/admin/categories/:id?cascade=true
//
// Safety rules:
// - Blocked entirely (no override) if any product — anywhere in the
//   category's subtree — references it via categories_path_id. There's no
//   defined behavior yet for what should happen to a product's category
//   assignment when the category disappears, so we refuse to guess and
//   leave the data intact.
// - Blocked unless `cascade=true` if the category has sub-categories or
//   sub-sub-categories, so an admin can't silently wipe out a branch of the
//   tree with one click. The client is expected to show the child count and
//   ask for explicit confirmation before retrying with `cascade=true`.
// - Deletion of the category + all validated descendants happens in a
//   single atomic batch.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const cascade = request.nextUrl.searchParams.get('cascade') === 'true';

  const category = await getCategoryById(id);
  if (!category) {
    return NextResponse.json({ error: 'Category not found' }, { status: 404 });
  }

  try {
    const descendants = await getCategoryDescendants(id);
    const descendantIds = descendants.map((d) => d.id);
    const { count: productCount, sampleProductIds } = await countProductReferences([
      id,
      ...descendantIds,
    ]);

    const plan = evaluateCategoryDeletion({
      childCount: descendants.length,
      productCount,
      cascade,
    });

    if (!plan.allowed) {
      return NextResponse.json(
        {
          error:
            plan.reason === 'HAS_PRODUCTS'
              ? 'Category (or its sub-categories) still has products assigned to it'
              : 'Category has sub-categories',
          code: plan.reason,
          childCount: plan.childCount,
          productCount: plan.productCount,
          children: descendants.map((d) => ({ id: d.id, name: d.name, level: d.level })),
          sampleProductIds,
        },
        { status: 409 }
      );
    }

    await deleteCategorySubtree(id, descendantIds);

    // Best-effort mirror cleanup — deepest descendants first so the Neon
    // self-referential parentId FK never points at an already-deleted row.
    const namesDeepestFirst = [...descendants].reverse().map((d) => d.name);
    namesDeepestFirst.push(category.name);
    await mirrorCategoryDeletionToNeon(namesDeepestFirst);

    return NextResponse.json({
      deletedId: id,
      deletedDescendantIds: descendantIds,
    });
  } catch (error) {
    Sentry.captureException(error);
    console.error(`[categories] Failed to delete category ${id} (cascade=${cascade}):`, error);
    return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 });
  }
}
