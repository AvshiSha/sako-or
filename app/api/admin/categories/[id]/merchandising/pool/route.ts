import { NextRequest, NextResponse } from 'next/server';
import { requireUserAuth } from '@/lib/server/auth';
import { adminDb } from '@/lib/firebase-admin';
import { listCategoryMerchandisingPool } from '@/lib/category-merchandising';
import { resolveMerchandisingPreviewRows } from '@/lib/campaign-merchandising';

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  if (!(await categoryExists(id))) {
    return NextResponse.json({ error: 'Category not found' }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get('pageSize') || '40', 10) || 40)
  );
  const q = searchParams.get('q') || undefined;
  const excludeParam = searchParams.get('exclude');
  const excludeKeys = excludeParam ? excludeParam.split(',').filter(Boolean) : [];

  const pool = await listCategoryMerchandisingPool(id, {
    page,
    pageSize,
    q,
    excludeKeys,
  });

  const previews = await resolveMerchandisingPreviewRows(pool.variantKeys, { lang: 'en' });

  return NextResponse.json({
    ...pool,
    previews,
  });
}

