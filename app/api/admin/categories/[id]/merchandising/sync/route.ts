import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUserAuth } from '@/lib/server/auth';
import { adminDb } from '@/lib/firebase-admin';
import {
  getCategoryMerchandisingAdmin,
  saveCategoryMerchandisingAdmin,
  syncCategoryMerchandisingVariantKeys,
} from '@/lib/category-merchandising';
import { resolveMerchandisingPreviewRows } from '@/lib/campaign-merchandising';

const syncSchema = z.object({
  strategy: z.enum(['replace', 'append']).default('replace'),
  save: z.boolean().default(false),
});

async function requireAdmin(request: NextRequest) {
  const auth = await requireUserAuth(request);
  if (auth instanceof NextResponse) return auth;
  if (!auth.isAdmin) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }
  return auth;
}

async function categoryExists(categoryId: string): Promise<boolean> {
  const snap = await adminDb.collection('categories').doc(categoryId).get();
  return snap.exists;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  if (!(await categoryExists(id))) {
    return NextResponse.json({ error: 'Category not found' }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = syncSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid payload', issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const syncedKeys = await syncCategoryMerchandisingVariantKeys(id);
  const existing = await getCategoryMerchandisingAdmin(id);

  let orderedVariantKeys: string[];
  if (parsed.data.strategy === 'append') {
    const seen = new Set(existing.orderedVariantKeys);
    orderedVariantKeys = [...existing.orderedVariantKeys];
    for (const key of syncedKeys) {
      if (!seen.has(key)) {
        seen.add(key);
        orderedVariantKeys.push(key);
      }
    }
  } else {
    orderedVariantKeys = syncedKeys;
  }

  let merchandising = existing;
  if (parsed.data.save) {
    const mode =
      existing.mode === 'auto' && orderedVariantKeys.length > 0 ? 'manual' : existing.mode;
    merchandising = await saveCategoryMerchandisingAdmin(id, {
      mode,
      orderedVariantKeys,
      updatedBy: auth.email ?? undefined,
    });
  } else {
    merchandising = { ...existing, orderedVariantKeys };
  }

  const previews = await resolveMerchandisingPreviewRows(orderedVariantKeys, { lang: 'en' });

  return NextResponse.json({
    merchandising,
    previews,
    syncedCount: syncedKeys.length,
  });
}

