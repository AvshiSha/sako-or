import * as Sentry from '@sentry/nextjs';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUserAuth } from '@/lib/server/auth';
import { adminDb } from '@/lib/firebase-admin';
import {
  getCategoryMerchandisingAdmin,
  saveCategoryBannersAdmin,
} from '@/lib/category-merchandising';

/**
 * Banners are shaped by sanitizeCollectionBanners rather than by a zod schema, so
 * there is one definition of a valid banner - the unit-tested one - instead of two
 * that can disagree. Zod only checks that an array arrived.
 */
const bannersSchema = z.object({
  banners: z.array(z.unknown()),
});

async function requireAdmin(request: NextRequest) {
  const auth = await requireUserAuth(request);
  if (auth instanceof NextResponse) return auth;
  if (!auth.isAdmin) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }
  return auth;
}

async function getCategoryMeta(categoryId: string) {
  const snap = await adminDb.collection('categories').doc(categoryId).get();
  if (!snap.exists) return null;
  const data = snap.data() as any;
  return {
    id: snap.id,
    name: data?.name,
    slug: data?.slug,
    path: data?.path,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  // The meta comes back with the banners so the editor can title itself without a
  // second request to the merchandising endpoint, which also resolves previews.
  const category = await getCategoryMeta(id);
  if (!category) {
    return NextResponse.json({ error: 'Category not found' }, { status: 404 });
  }

  const merchandising = await getCategoryMerchandisingAdmin(id);
  // `meta` rather than `category`: the campaign twin of this route returns the
  // same two keys, which is what lets one editor component serve both.
  return NextResponse.json({
    banners: merchandising.banners,
    meta: {
      title: category.name?.en || category.name?.he || category.id,
      storefrontHref: category.path ? `/en/collection/${category.path}` : undefined,
    },
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  if (!(await getCategoryMeta(id))) {
    return NextResponse.json({ error: 'Category not found' }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = bannersSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid payload', issues: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const merchandising = await saveCategoryBannersAdmin(
      id,
      parsed.data.banners,
      auth.email ?? undefined
    );

    // Returning what was stored rather than what was sent: sanitising drops
    // entries, and the editor should show the saved truth instead of silently
    // keeping a row that never persisted.
    return NextResponse.json({ banners: merchandising.banners });
  } catch (error) {
    Sentry.captureException(error);
    const message = error instanceof Error ? error.message : 'Failed to save banners';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
