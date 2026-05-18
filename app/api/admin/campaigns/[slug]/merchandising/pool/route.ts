import { NextRequest, NextResponse } from 'next/server';
import { requireUserAuth } from '@/lib/server/auth';
import { campaignService } from '@/lib/firebase';
import {
  listCampaignMerchandisingPool,
  resolveMerchandisingPreviewRows,
} from '@/lib/campaign-merchandising';

async function requireAdmin(request: NextRequest) {
  const auth = await requireUserAuth(request);
  if (auth instanceof NextResponse) return auth;
  if (!auth.isAdmin) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }
  return auth;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { slug } = await params;
  const campaign = await campaignService.getCampaignBySlug(slug);
  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }

  const tag = campaign.productFilter?.tag;
  if (!tag) {
    return NextResponse.json({ error: 'Campaign has no product tag configured' }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '40', 10) || 40));
  const q = searchParams.get('q') || undefined;
  const excludeParam = searchParams.get('exclude');
  const excludeKeys = excludeParam ? excludeParam.split(',').filter(Boolean) : [];

  const pool = await listCampaignMerchandisingPool(slug, tag, {
    page,
    pageSize,
    q,
    excludeKeys,
    productLimit: campaign.productFilter?.limit,
  });

  const previews = await resolveMerchandisingPreviewRows(pool.variantKeys, {
    campaignTag: tag,
    lang: 'en',
  });

  return NextResponse.json({
    ...pool,
    previews,
  });
}
