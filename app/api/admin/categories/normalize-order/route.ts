import * as Sentry from '@sentry/nextjs';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/auth';
import {
  ORPHAN_SIBLING_GROUP,
  getAllCategoriesUnordered,
  siblingGroupKey,
  writeSortOrders,
  type OrderableCategoryRecord,
} from '@/lib/category-mutations';
import { sortCategories } from '@/lib/category-order';
import { revalidateNavigationCategories } from '@/lib/navigation-revalidate';

/**
 * One-time normalization of category sortOrder.
 *
 * Historically the admin edit form sent a literal `sortOrder: 0` on every save,
 * so edited categories all collapsed to 0 and their displayed order fell back
 * to Firestore's arbitrary document-id tiebreak. Some documents never had the
 * field at all, which is worse: an orderBy excludes them, so those categories
 * were invisible in the storefront navigation entirely.
 *
 * This rewrites each sibling group to a dense 0..n-1 sequence using the shared
 * comparator, so the order becomes explicit and every document has the field.
 *
 *   GET  — dry run. Reports the before/after of every group, writes nothing.
 *   POST — applies the same plan and revalidates the navigation.
 */

interface PlannedChange {
  id: string;
  name: string;
  from: number | null;
  to: number;
  changed: boolean;
}

interface PlannedGroup {
  group: string;
  categories: PlannedChange[];
}

function displayName(cat: OrderableCategoryRecord): string {
  if (typeof cat.name === 'string') return cat.name;
  return cat.name?.en || cat.name?.he || '(unnamed)';
}

function buildPlan(categories: OrderableCategoryRecord[]) {
  const buckets = new Map<string, OrderableCategoryRecord[]>();
  for (const cat of categories) {
    const key = siblingGroupKey(cat);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(cat);
    else buckets.set(key, [cat]);
  }

  const groups: PlannedGroup[] = [];
  const updates: Array<{ id: string; sortOrder: number }> = [];

  for (const [group, members] of buckets) {
    const ordered = sortCategories(members);
    groups.push({
      group,
      categories: ordered.map((cat, index) => {
        const from = typeof cat.sortOrder === 'number' ? cat.sortOrder : null;
        if (from !== index) updates.push({ id: cat.id, sortOrder: index });
        return {
          id: cat.id,
          name: displayName(cat),
          from,
          to: index,
          changed: from !== index,
        };
      }),
    });
  }

  // Non-root categories with no parentId are broken data that no bucketing rule
  // can guess at. Surface them rather than quietly numbering them.
  const orphans = (buckets.get(ORPHAN_SIBLING_GROUP) ?? []).map((cat) => ({
    id: cat.id,
    name: displayName(cat),
    level: cat.level,
  }));

  // A count mismatch here means the missing-sortOrder hazard was live: these
  // documents are the ones an orderBy('sortOrder') query silently dropped.
  const missingSortOrder = categories.filter((c) => typeof c.sortOrder !== 'number').length;

  return { groups, updates, orphans, missingSortOrder };
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const categories = await getAllCategoriesUnordered();
    const { groups, updates, orphans, missingSortOrder } = buildPlan(categories);

    return NextResponse.json({
      dryRun: true,
      totalCategories: categories.length,
      missingSortOrder,
      pendingUpdates: updates.length,
      orphans,
      groups,
    });
  } catch (error) {
    Sentry.captureException(error);
    console.error('Error planning category order normalization:', error);
    return NextResponse.json({ error: 'Failed to plan normalization' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const categories = await getAllCategoriesUnordered();
    const { groups, updates, orphans, missingSortOrder } = buildPlan(categories);

    const updated = await writeSortOrders(updates);
    revalidateNavigationCategories();

    return NextResponse.json({
      dryRun: false,
      totalCategories: categories.length,
      missingSortOrder,
      updated,
      orphans,
      groups,
    });
  } catch (error) {
    Sentry.captureException(error);
    console.error('Error normalizing category order:', error);
    return NextResponse.json({ error: 'Failed to normalize category order' }, { status: 500 });
  }
}
