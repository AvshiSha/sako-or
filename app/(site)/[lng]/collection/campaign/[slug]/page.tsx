import { redirect } from "next/navigation";
import { Metadata } from "next";

import { categoryService, getCampaignCollectionProducts } from "@/lib/firebase";
import { getCampaignGridBanners } from "@/lib/campaign-merchandising";
import { getCachedCampaignBySlug } from "@/lib/server/cached-campaign-data";

import CampaignClient from "../CampaignClient";

// Still dynamic: the listing reads filter/sort/page out of searchParams.
export const dynamic = "force-dynamic";

// Helper to serialize Firestore timestamps or other complex objects
const serializeValue = (value: any): any => {
  if (value === null || value === undefined) return value;

  // Firestore Timestamp-like object
  if (
    typeof value === "object" &&
    "seconds" in value &&
    "nanoseconds" in value
  ) {
    const milliseconds =
      (value.seconds as number) * 1000 + (value.nanoseconds as number) / 1_000_000;
    return new Date(milliseconds).toISOString();
  }

  if (Array.isArray(value)) {
    return value.map(serializeValue);
  }

  if (typeof value === "object") {
    const serialized: Record<string, any> = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      serialized[key] = serializeValue(nestedValue);
    }
    return serialized;
  }

  return value;
};

interface CampaignPageProps {
  params: Promise<{
    lng: string;
    slug: string;
  }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata(
  { params }: CampaignPageProps
): Promise<Metadata> {
  const { lng, slug } = await params;

  // Free: layout.tsx already resolved this slug in the same request.
  const campaign = await getCachedCampaignBySlug(decodeURIComponent(slug));

  if (!campaign) {
    return {
      title: lng === 'he' ? 'מבצעים | SAKO OR' : 'Campaigns | SAKO OR',
      description: lng === 'he' ? 'מבצעים מיוחדים' : 'Special campaigns',
    };
  }

  const title = campaign.seoTitle?.[lng as 'en' | 'he'] || campaign.title[lng as 'en' | 'he'] || 'Campaign';
  const description = campaign.seoDescription?.[lng as 'en' | 'he'] || campaign.description?.[lng as 'en' | 'he'] || '';

  return {
    title: `${title} | SAKO OR`,
    description,
    openGraph: {
      title: `${title} | SAKO OR`,
      description,
      images: campaign.bannerDesktopUrl ? [campaign.bannerDesktopUrl] : [],
    },
  };
}

/**
 * The products half of the page, and now the whole of it: the hero and the
 * redirect decision moved up to layout.tsx so they sit outside the route's
 * loading boundary.
 *
 * Everything slow is therefore inside loading.tsx's boundary by construction,
 * which is what this file exists to guarantee - there is no longer an await on
 * this route that can block the first byte. The in-page <Suspense> that used to
 * wrap this work is gone with it: the route fallback is the one that shows, and
 * two nested fallbacks for the same wait only gave the listing a second chance
 * to resettle.
 *
 * Next renders a layout and its page concurrently, so the null guard below is not
 * dead code - this component can start before layout.tsx's redirect throws. The
 * lookup is cached per request, so the guard costs nothing.
 */
export default async function CampaignPage({
  params,
  searchParams,
}: CampaignPageProps) {
  const { lng, slug } = await params;
  const resolvedSearchParams = await searchParams;

  const campaign = await getCachedCampaignBySlug(decodeURIComponent(slug));

  if (!campaign) {
    redirect(`/${lng}/collection`);
  }

  const serializedCampaign = serializeValue(campaign);

  // The category tree rides along because the filter panel's sub-subcategory
  // section needs names and parents for the ids the product query reports back -
  // availableFilterOptions carries ids only. Issued alongside the product query
  // rather than after it: it depends on nothing above.
  const [result, categories] = await Promise.all([
    getCampaignCollectionProducts(
      campaign,
      resolvedSearchParams,
      lng as "en" | "he"
    ),
    categoryService.getAllCategories(),
  ]);

  const variantItems = result.variantItems ?? [];
  const total = result.total ?? 0;
  const hasMore = result.hasMore ?? false;

  const serializedVariantItems = variantItems.map((item) => ({
    product: serializeValue(item.product),
    variant: serializeValue(item.variant),
    variantKey: item.variantKey,
  }));

  const initialSort =
    typeof resolvedSearchParams.sort === "string"
      ? resolvedSearchParams.sort
      : "relevance";
  const initialMinPrice =
    typeof resolvedSearchParams.minPrice === "string"
      ? resolvedSearchParams.minPrice
      : undefined;
  const initialMaxPrice =
    typeof resolvedSearchParams.maxPrice === "string"
      ? resolvedSearchParams.maxPrice
      : undefined;

  const filterSearchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(resolvedSearchParams)) {
    if (key === "page" || key === "slug") continue;
    if (typeof value === "string") filterSearchParams.set(key, value);
    else if (Array.isArray(value)) filterSearchParams.set(key, value.join(","));
  }
  const campaignFilterKey = [...filterSearchParams.entries()]
    .map(([k, v]) => `${k}:${v}`)
    .sort()
    .join("|");

  // Grid banners are merchandising, same as on a category listing.
  const gridBanners = campaign.slug
    ? await getCampaignGridBanners(campaign.slug)
    : [];

  return (
    <CampaignClient
      key={campaignFilterKey}
      campaign={serializedCampaign}
      gridBanners={gridBanners}
      initialVariantItems={serializedVariantItems}
      categories={categories.map((category) => serializeValue(category))}
      initialAvailableFilterOptions={result.availableFilterOptions}
      totalProducts={total}
      hasMore={hasMore}
      lng={lng as "en" | "he"}
      initialSort={initialSort}
      initialMinPrice={initialMinPrice}
      initialMaxPrice={initialMaxPrice}
    />
  );
}
