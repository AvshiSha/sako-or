import * as Sentry from '@sentry/nextjs';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/auth';
import { updateFaqStatusSchema } from '@/lib/schemas/faq-schema';
import { getFaqAdmin, updateFaqDoc } from '@/lib/server/faq-mutations';
import { revalidateFaqSurfaces } from '@/lib/faq-revalidate';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/admin/faq/:id/status — publish, unpublish or hide.
 *
 * Split from the general PATCH so the list screen's one-click publish/hide
 * toggle sends a payload that cannot accidentally carry stale content fields
 * from a form the admin never opened.
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  const body = await request.json().catch(() => null);
  const parsed = updateFaqStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid payload', issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const { status } = parsed.data;

  try {
    const existing = await getFaqAdmin(id);
    if (!existing) return NextResponse.json({ error: 'FAQ not found' }, { status: 404 });

    if (existing.status === status) {
      // Idempotent: a double-clicked toggle must not rewrite updatedAt and
      // move the sitemap's lastmod for a change that did not happen.
      return NextResponse.json({ id, status, unchanged: true });
    }

    const now = new Date().toISOString();
    await updateFaqDoc(id, {
      status,
      // First publication only, so unhiding never makes the question look newer.
      ...(status === 'published' && !existing.publishedAt ? { publishedAt: now } : {}),
      updatedAt: now,
      updatedBy: auth.email ?? 'unknown',
    });

    revalidateFaqSurfaces();

    return NextResponse.json({ id, status, previousStatus: existing.status });
  } catch (error) {
    Sentry.captureException(error);
    console.error('[ADMIN_FAQ_STATUS_ERROR]', error);
    return NextResponse.json({ error: 'Failed to update FAQ status' }, { status: 500 });
  }
}
