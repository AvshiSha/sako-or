import { redirect } from "next/navigation";
import { Metadata } from "next";

import { categoryService, getCampaignCollectionProducts } from "@/lib/firebase";
import { getCampaignGridBanners } from "@/lib/campaign-merchandising";
import { getCachedCampaignBySlug } from "@/lib/server/cached-campaign-data";
import { buildMetadata } from "@/lib/seo";
import { languages } from "@/i18n/settings";

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

/**
 * Campaign metadata, including the canonical.
 *
 * This route used to hand-roll its Metadata and was the one listing route that
 * never went through `buildMetadata`, so campaign pages shipped with **no
 * canonical at all**. That matters more here than it would elsewhere: the route
 * is `force-dynamic` and the listing reads filter, sort and page out of
 * `searchParams`, so every filter permutation is a separate indexable URL
 * carrying identical copy - a duplicate generator over an unbounded URL space.
 *
 * The canonical therefore keeps only `?page=`, exactly as the collection route
 * does: a filtered or sorted URL self-canonicalises onto the clean campaign
 * URL, and a paginated one onto itself. Page 2+ also has to say so in the title,
 * because a paginated series is the only place on this site where duplicate
 * titles are tolerated, and only when the number is actually appended.
 *
 * Title, description and the openGraph image keep their previous values, so the
 * only behavioural change is the addition of canonical/hreflang/robots.
 */
export async function generateMetadata(
  { params, searchParams }: CampaignPageProps
): Promise<Metadata> {
  const { lng, slug } = await params;
  const resolvedSearchParams = await searchParams;
  const locale = (lng === 'he' ? 'he' : 'en') as 'en' | 'he';

  // Free: layout.tsx already resolved this slug in the same request.
  const campaign = await getCachedCampaignBySlug(decodeURIComponent(slug));

  // Unknown slug: layout.tsx redirects (307) before this is ever indexable, so
  // there is nothing to canonicalise onto. Left without one on purpose.
  if (!campaign) {
    return {
      title: lng === 'he' ? 'מבצעים | SAKO OR' : 'Campaigns | SAKO OR',
      description: lng === 'he' ? 'מבצעים מיוחדים' : 'Special campaigns',
    };
  }

  const title = campaign.seoTitle?.[locale] || campaign.title[locale] || 'Campaign';
  const description = campaign.seoDescription?.[locale] || campaign.description?.[locale] || '';

  // Same parse as the collection route: only a positive integer counts, so
  // `?page=abc` or `?page=0` canonicalises onto page 1 rather than inventing a URL.
  let page = 1;
  if (typeof resolvedSearchParams.page === 'string') {
    const parsedPage = parseInt(resolvedSearchParams.page, 10);
    if (!isNaN(parsedPage) && parsedPage > 0 && Number.isInteger(parsedPage)) {
      page = parsedPage;
    }
  }

  // `slug` arrives percent-encoded in params; re-encode the decoded form so the
  // canonical is byte-identical to the URL middleware produces.
  const canonicalSlug = encodeURIComponent(decodeURIComponent(slug));
  const basePath = `/${lng}/collection/campaign/${canonicalSlug}`;
  const queryString = page > 1 ? `?page=${page}` : '';

  const pageSuffix = page > 1 ? (locale === 'he' ? ` – עמוד ${page}` : ` – Page ${page}`) : '';

  // No brand suffix here: `buildMetadata` appends "| SAKO-OR" unless the title
  // already contains that exact string. The old hand-rolled metadata wrote
  // "| SAKO OR" (space, no hyphen), which does not match that check - passing it
  // through produced a doubled "… | SAKO OR – עמוד 2 | SAKO-OR". Dropping it also
  // settles campaign onto the hyphenated brand every other route already uses.
  return buildMetadata({
    title: `${title}${pageSuffix}`,
    description,
    url: `${basePath}${queryString}`,
    image: campaign.bannerDesktopUrl || undefined,
    type: 'website',
    locale,
    alternateLocales: languages
      .filter((l) => l !== locale)
      .map((altLng) => ({
        locale: altLng,
        url: `/${altLng}/collection/campaign/${canonicalSlug}${queryString}`,
      })),
  });
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
