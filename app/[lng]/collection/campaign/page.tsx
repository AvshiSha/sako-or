import { campaignService, Product } from "@/lib/firebase";
import { redirect } from "next/navigation";
import CampaignClient from "./CampaignClient";
import { Metadata } from "next";

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

  // If no campaign found, redirect to collection page
  if (!campaign) {
    redirect(`/${lng}/collection`);
  }

  // Fetch products for the campaign
  const products = await campaignService.getCampaignProducts(campaign);

  // Serialize Firestore timestamps before passing to client component
  const serializedProducts = products.map((product) => serializeValue(product));
  const serializedCampaign = serializeValue(campaign);

  return (
    <CampaignClient
      campaign={serializedCampaign}
      products={serializedProducts}
      lng={lng as 'en' | 'he'}
    />
  );
}

