import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUserAuth } from '@/lib/server/auth';
import { campaignService } from '@/lib/firebase';
import {
  getCampaignMerchandisingAdmin,
  resolveMerchandisingPreviewRows,
  saveCampaignMerchandisingAdmin,
} from '@/lib/campaign-merchandising';
import { CampaignMerchandisingMode } from '@/lib/campaign-merchandising-types';

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

  const merchandising = await getCampaignMerchandisingAdmin(slug);
  const tag = campaign.productFilter?.tag;
  const previews = await resolveMerchandisingPreviewRows(merchandising.orderedVariantKeys, {
    campaignTag: tag,
    lang: 'en',
  });

  return NextResponse.json({
    merchandising,
    previews,
    campaign: {
      slug: campaign.slug,
      title: campaign.title,
      productFilter: campaign.productFilter,
    },
  });
}

export async function PUT(
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

  const body = await request.json().catch(() => null);
  const parsed = merchandisingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid payload', issues: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const merchandising = await saveCampaignMerchandisingAdmin(slug, {
      mode: parsed.data.mode as CampaignMerchandisingMode,
      orderedVariantKeys: parsed.data.orderedVariantKeys,
      updatedBy: auth.email ?? undefined,
    });

    const previews = await resolveMerchandisingPreviewRows(merchandising.orderedVariantKeys, {
      campaignTag: campaign.productFilter?.tag,
      lang: 'en',
    });

    return NextResponse.json({ merchandising, previews });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save merchandising';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
