import { Suspense } from "react";
import { campaignService, getCampaignCollectionProducts } from "@/lib/firebase";
import { redirect } from "next/navigation";
import CampaignClient from "./CampaignClient";
import CampaignHero from "@/app/components/collection/CampaignHero";
import CollectionListingSkeleton from "@/app/components/collection/CollectionListingSkeleton";
import { Metadata } from "next";

// This page is dynamic because it uses searchParams
export const dynamic = 'force-dynamic';

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
  }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata(
  { params, searchParams }: CampaignPageProps
): Promise<Metadata> {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const { lng } = resolvedParams;
  const slug = resolvedSearchParams.slug as string | undefined;

  let campaign;
  if (slug) {
    campaign = await campaignService.getCampaignBySlug(slug);
  } else {
    campaign = await campaignService.getActiveCampaign();
  }

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
 * The products half of the page. Everything slow lives in here on purpose: this
 * is what the <Suspense> below waits on, so the hero and the campaign copy can
 * paint from the campaign document alone while the product query is still
 * running.
 */
async function CampaignProducts({
  campaign,
  serializedCampaign,
  resolvedSearchParams,
  lng,
}: {
  campaign: Awaited<ReturnType<typeof campaignService.getCampaignBySlug>>;
  serializedCampaign: any;
  resolvedSearchParams: { [key: string]: string | string[] | undefined };
  lng: string;
}) {
  // Fetch first page with filters (tag-based; filter params from URL)
  const result = await getCampaignCollectionProducts(
    campaign!,
    resolvedSearchParams,
    lng as "en" | "he"
  );
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

  return (
    <CampaignClient
      key={campaignFilterKey}
      campaign={serializedCampaign}
      initialVariantItems={serializedVariantItems}
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

export default async function CampaignPage({
  params,
  searchParams,
}: CampaignPageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const { lng } = resolvedParams;
  const slug = resolvedSearchParams.slug as string | undefined;

  // Resolve campaign. One document read, and nothing below is allowed to start
  // until it lands — which is also what makes the redirect below a real 307
  // again. While this route had a loading.tsx, its fallback went out before this
  // line ran, which sent the headers and pinned the status at 200, degrading the
  // redirect to a meta refresh. That file is gone; the Suspense boundary further
  // down covers the slow part instead, and it sits *inside* the page, so the
  // status is still ours to set here.
  let campaign;
  if (slug) {
    campaign = await campaignService.getCampaignBySlug(slug);
  } else {
    campaign = await campaignService.getActiveCampaign();
  }

  // If no campaign found, redirect to collection page
  if (!campaign) {
    redirect(`/${lng}/collection`);
  }

  const serializedCampaign = serializeValue(campaign);

  return (
    <div className="min-h-screen bg-white">
      {/* Outside the boundary: this is known as soon as the campaign document is,
          so it paints with the first chunk and never moves the listing. */}
      <CampaignHero campaign={serializedCampaign} lng={lng as "en" | "he"} />

      <Suspense
        fallback={
          <CollectionListingSkeleton
            label="Loading campaign products"
            fullHeight={false}
          />
        }
      >
        <CampaignProducts
          campaign={campaign}
          serializedCampaign={serializedCampaign}
          resolvedSearchParams={resolvedSearchParams}
          lng={lng}
        />
      </Suspense>
    </div>
  );
}
