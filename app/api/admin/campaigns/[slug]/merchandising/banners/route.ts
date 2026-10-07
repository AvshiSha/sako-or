import * as Sentry from '@sentry/nextjs';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUserAuth } from '@/lib/server/auth';
import { campaignService } from '@/lib/firebase';
import {
  getCampaignMerchandisingAdmin,
  saveCampaignBannersAdmin,
} from '@/lib/campaign-merchandising';

/**
 * Grid banners for a campaign listing — the campaign twin of
 * /api/admin/categories/[id]/merchandising/banners, and deliberately the same
 * shape so one editor component can drive both.
 *
 * Banners are shaped by sanitizeCollectionBanners rather than by a zod schema,
 * so there is one definition of a valid banner - the unit-tested one - instead
 * of two that can disagree. Zod only checks that an array arrived.
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

  // The meta comes back with the banners so the editor can title itself without
  // a second request to the merchandising endpoint, which also resolves previews.
  const merchandising = await getCampaignMerchandisingAdmin(slug);
  return NextResponse.json({
    banners: merchandising.banners,
    meta: {
      title: campaign.title?.en || campaign.title?.he || slug,
      // `slug`, matching the storefront page's own searchParam.
      storefrontHref: `/en/collection/campaign/${encodeURIComponent(slug)}`,
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
  if (!(await campaignService.getCampaignBySlug(slug))) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
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
    const banners = await saveCampaignBannersAdmin(
      slug,
      parsed.data.banners,
      auth.email ?? undefined
    );

    // Returning what was stored rather than what was sent: sanitising drops
    // entries, and the editor should show the saved truth instead of silently
    // keeping a row that never persisted.
    return NextResponse.json({ banners });
  } catch (error) {
    Sentry.captureException(error);
    const message = error instanceof Error ? error.message : 'Failed to save banners';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
