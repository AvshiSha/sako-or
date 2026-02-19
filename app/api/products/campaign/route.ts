import { NextRequest, NextResponse } from "next/server";
import { campaignService, getCampaignCollectionProducts } from "@/lib/firebase";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get("slug") || undefined;
    const language = (searchParams.get("language") || "en") as "en" | "he";

    const campaign = slug
      ? await campaignService.getCampaignBySlug(slug)
      : await campaignService.getActiveCampaign();

    if (!campaign) {
      return NextResponse.json(
        { variantItems: [], total: 0, page: 1, hasMore: false },
        { status: 404 }
      );
    }

    // Build searchParams object for getCampaignCollectionProducts (same keys as client sends)
    const params: { [key: string]: string | string[] | undefined } = {};
    searchParams.forEach((value, key) => {
      params[key] = value;
    });

    const result = await getCampaignCollectionProducts(
      campaign,
      params,
      language
    );

    return NextResponse.json({
      variantItems: result.variantItems ?? [],
      total: result.total ?? 0,
      page: result.page ?? 1,
      hasMore: result.hasMore ?? false,
    });
  } catch (error) {
    console.error("Error fetching campaign products:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch campaign products",
        variantItems: [],
        total: 0,
        page: 1,
        hasMore: false,
      },
      { status: 500 }
    );
  }
}
