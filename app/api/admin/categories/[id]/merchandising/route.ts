import * as Sentry from '@sentry/nextjs';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUserAuth } from '@/lib/server/auth';
import { adminDb } from '@/lib/firebase-admin';
import {
  getCategoryMerchandisingAdmin,
  saveCategoryMerchandisingAdmin,
} from '@/lib/category-merchandising';
import { resolveMerchandisingPreviewRows } from '@/lib/campaign-merchandising';

const merchandisingSchema = z.object({
  mode: z.enum(['auto', 'pinned', 'manual']),
  orderedVariantKeys: z.array(z.string()).max(2000),
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
    level: data?.level,
    parentId: data?.parentId,
    isEnabled: data?.isEnabled,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const category = await getCategoryMeta(id);
  if (!category) {
    return NextResponse.json({ error: 'Category not found' }, { status: 404 });
  }

  const merchandising = await getCategoryMerchandisingAdmin(id);
  const previews = await resolveMerchandisingPreviewRows(merchandising.orderedVariantKeys, {
    lang: 'en',
  });

  return NextResponse.json({ merchandising, previews, category });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const category = await getCategoryMeta(id);
  if (!category) {
    return NextResponse.json({ error: 'Category not found' }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = merchandisingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid payload', issues: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const merchandising = await saveCategoryMerchandisingAdmin(id, {
      mode: parsed.data.mode,
      orderedVariantKeys: parsed.data.orderedVariantKeys,
      updatedBy: auth.email ?? undefined,
    });

    const previews = await resolveMerchandisingPreviewRows(merchandising.orderedVariantKeys, {
      lang: 'en',
    });

    return NextResponse.json({ merchandising, previews });
  } catch (error) {
    Sentry.captureException(error);
    const message = error instanceof Error ? error.message : 'Failed to save merchandising';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

