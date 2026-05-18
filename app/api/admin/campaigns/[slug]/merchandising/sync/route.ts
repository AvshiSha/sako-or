import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUserAuth } from '@/lib/server/auth';
import { campaignService } from '@/lib/firebase';
import {
  getCampaignMerchandisingAdmin,
  resolveMerchandisingPreviewRows,
  saveCampaignMerchandisingAdmin,
  syncCampaignMerchandisingVariantKeys,
} from '@/lib/campaign-merchandising';

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

export async function POST(
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

  const body = await request.json().catch(() => ({}));
  const parsed = syncSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid payload', issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const syncedKeys = await syncCampaignMerchandisingVariantKeys(
    slug,
    tag,
    campaign.productFilter?.limit
  );

  const existing = await getCampaignMerchandisingAdmin(slug);
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
    merchandising = await saveCampaignMerchandisingAdmin(slug, {
      mode,
      orderedVariantKeys,
      updatedBy: auth.email ?? undefined,
    });
  } else {
    merchandising = { ...existing, orderedVariantKeys };
  }

  const previews = await resolveMerchandisingPreviewRows(orderedVariantKeys, {
    campaignTag: tag,
    lang: 'en',
  });

  return NextResponse.json({
    merchandising,
    previews,
    syncedCount: syncedKeys.length,
  });
}
