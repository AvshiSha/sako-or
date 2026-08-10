import { campaignService, getCampaignCollectionProducts } from "@/lib/firebase";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import CampaignClient from "./CampaignClient";
import CampaignSkeleton from "./CampaignSkeleton";
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

export default async function CampaignPage({
  params,
  searchParams,
}: CampaignPageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const { lng } = resolvedParams;
  const slug = resolvedSearchParams.slug as string | undefined;

  // Resolve campaign
  let campaign;
  if (slug) {
    campaign = await campaignService.getCampaignBySlug(slug);
  } else {
    campaign = await campaignService.getActiveCampaign();
  }

  // If no campaign found, redirect to collection page.
  //
  // This has to stay above the Suspense boundary below. Once a fallback
  // streams, the response is committed at 200 and this redirect() would
  // silently degrade into a meta refresh instead of a real 307 - which is also
  // why this route must never grow a loading.tsx.
  if (!campaign) {
    redirect(`/${lng}/collection`);
  }

  const hasBanner = Boolean(
    campaign.bannerDesktopUrl ||
      campaign.bannerMobileUrl ||
      campaign.bannerDesktopVideoUrl ||
      campaign.bannerMobileVideoUrl
  );
  // Mirrors CampaignClient's own derivation so the fallback reserves the same height.
  const description =
    campaign.description?.[lng as "en" | "he"] ||
    campaign.description?.en ||
    campaign.description?.he;

  // Only the product query streams. The campaign itself is already resolved, so
  // the fallback can reserve the real banner and description height.
  return (
    <Suspense
      fallback={
        <CampaignSkeleton
          hasBanner={hasBanner}
          description={description}
          lng={lng as "en" | "he"}
        />
      }
    >
      <CampaignProducts
        campaign={campaign}
        resolvedSearchParams={resolvedSearchParams}
        lng={lng as "en" | "he"}
      />
    </Suspense>
  );
}

async function CampaignProducts({
  campaign,
  resolvedSearchParams,
  lng,
}: {
  campaign: NonNullable<
    Awaited<ReturnType<typeof campaignService.getActiveCampaign>>
  >;
  resolvedSearchParams: { [key: string]: string | string[] | undefined };
  lng: "en" | "he";
}) {
  // Fetch first page with filters (tag-based; filter params from URL)
  const result = await getCampaignCollectionProducts(
    campaign,
    resolvedSearchParams,
    lng
  );
  const variantItems = result.variantItems ?? [];
  const total = result.total ?? 0;
  const hasMore = result.hasMore ?? false;

  const serializedCampaign = serializeValue(campaign);
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

