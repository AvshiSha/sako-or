import * as Sentry from '@sentry/nextjs';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/server/auth';
import {
  ROOT_SIBLING_GROUP,
  getAllCategoriesUnordered,
  siblingGroupKey,
  writeSortOrders,
} from '@/lib/category-mutations';
import { revalidateNavigationCategories } from '@/lib/navigation-revalidate';

const reorderSchema = z.object({
  // null means the level-0 root group.
  parentId: z.string().min(1).nullable(),
  orderedIds: z.array(z.string().min(1)).min(1),
});

/**
 * PATCH /api/admin/categories/reorder
 *
 * Rewrites one sibling group to a dense 0..n-1 sequence in the order given.
 * Order is per sibling group, so a request only ever touches the children of a
 * single parent.
 *
 * `orderedIds` must be exactly the current membership of that group. A
 * mismatch means the admin's view was stale (someone added, moved or deleted a
 * category in the meantime), and applying a partial order would leave gaps or
 * duplicate positions — so it is rejected rather than reconciled.
 *
 * Neon is deliberately not mirrored here: nothing reads sortOrder from Postgres
 * (the storefront navigation reads Firestore), so a mirror write would only add
 * a failure path. /api/admin/categories/sync backfills it when it next runs.
 */
export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => null);
  const parsed = reorderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid payload', issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const { parentId, orderedIds } = parsed.data;

  if (new Set(orderedIds).size !== orderedIds.length) {
    return NextResponse.json({ error: 'orderedIds contains duplicates' }, { status: 400 });
  }

  try {
    const all = await getAllCategoriesUnordered();
    const targetGroup = parentId === null ? ROOT_SIBLING_GROUP : parentId;
    const actualIds = all
      .filter((cat) => siblingGroupKey(cat) === targetGroup)
      .map((cat) => cat.id);

    if (actualIds.length === 0) {
      return NextResponse.json({ error: 'No categories found for that parent' }, { status: 404 });
    }

    const actualSet = new Set(actualIds);
    const requestedSet = new Set(orderedIds);
    const missing = actualIds.filter((id) => !requestedSet.has(id));
    const unknown = orderedIds.filter((id) => !actualSet.has(id));

    if (missing.length > 0 || unknown.length > 0) {
      return NextResponse.json(
        {
          error: 'orderedIds must list exactly the current members of this group',
          missing,
          unknown,
        },
        { status: 409 }
      );
    }

    const updated = await writeSortOrders(
      orderedIds.map((id, sortOrder) => ({ id, sortOrder }))
    );
    revalidateNavigationCategories();

    return NextResponse.json({ parentId, updated, orderedIds });
  } catch (error) {
    Sentry.captureException(error);
    console.error('Error reordering categories:', error);
    return NextResponse.json({ error: 'Failed to reorder categories' }, { status: 500 });
  }
}
