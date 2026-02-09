import { NextRequest, NextResponse } from "next/server";
import { campaignService } from "@/lib/firebase";

const PAGE_SIZE = 24;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get("slug") || undefined;
    const pageParam = searchParams.get("page");
    let page = 1;
    if (pageParam) {
      const parsed = parseInt(pageParam, 10);
      if (!isNaN(parsed) && parsed > 0 && Number.isInteger(parsed)) {
        page = parsed;
      }
    }

    const campaign = slug
      ? await campaignService.getCampaignBySlug(slug)
      : await campaignService.getActiveCampaign();

    if (!campaign) {
      return NextResponse.json(
        { variantItems: [], total: 0, page: 1, hasMore: false },
        { status: 404 }
      );
    }

    const result = await campaignService.getCampaignVariantItemsPaginated(
      campaign,
      page,
      PAGE_SIZE
    );

    return NextResponse.json({
      variantItems: result.variantItems,
      total: result.total,
      page: result.page,
      hasMore: result.hasMore,
    });
  } catch (error) {
    console.error("Error fetching campaign products:", error);
    return NextResponse.json(
      { error: "Failed to fetch campaign products", variantItems: [], total: 0, page: 1, hasMore: false },
      { status: 500 }
    );
  }
}
