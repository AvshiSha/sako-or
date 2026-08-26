import * as Sentry from '@sentry/nextjs';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/auth';
import { reorderFaqSchema } from '@/lib/schemas/faq-schema';
import { getAllFaqsAdmin, writeFaqOrders } from '@/lib/server/faq-mutations';
import { orderUpdatesFromSequence, validateReorderMembership } from '@/lib/faq-order';
import { revalidateFaqSurfaces } from '@/lib/faq-revalidate';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/admin/faq/reorder
 *
 * Rewrites one audience group to a dense 0..n-1 sequence in the order given.
 *
 * `orderedIds` must be exactly the current membership of that group — including
 * its draft and hidden questions, which is why the admin board shows all
 * statuses. Ordering over published items only would leave a gap the moment one
 * was hidden, and that gap would then decide where the next publish lands.
 *
 * A mismatch means the admin's view was stale (someone else added or deleted a
 * question), so it is rejected rather than reconciled: applying a partial order
 * would silently drop or resurrect an item. Same contract as
 * /api/admin/categories/reorder.
 */
export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => null);
  const parsed = reorderFaqSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid payload', issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const { audience, orderedIds } = parsed.data;

  try {
    const all = await getAllFaqsAdmin();
    const currentIds = all.filter((item) => item.audience === audience).map((item) => item.id);

    if (currentIds.length === 0) {
      return NextResponse.json({ error: 'No FAQs found for that audience' }, { status: 404 });
    }

    const membership = validateReorderMembership(currentIds, orderedIds);
    if (membership.duplicates.length > 0) {
      return NextResponse.json(
        { error: 'orderedIds contains duplicates', duplicates: membership.duplicates },
        { status: 400 }
      );
    }
    if (!membership.valid) {
      return NextResponse.json(
        {
          error: 'orderedIds must list exactly the current questions in this audience',
          missing: membership.missing,
          unknown: membership.unknown,
        },
        { status: 409 }
      );
    }

    const updated = await writeFaqOrders(orderUpdatesFromSequence(orderedIds));

    revalidateFaqSurfaces();

    return NextResponse.json({ audience, updated, orderedIds });
  } catch (error) {
    Sentry.captureException(error);
    console.error('[ADMIN_FAQ_REORDER_ERROR]', error);
    return NextResponse.json({ error: 'Failed to reorder FAQs' }, { status: 500 });
  }
}
