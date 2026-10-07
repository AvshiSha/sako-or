import { redirect } from "next/navigation";

import { getCachedActiveCampaign } from "@/lib/server/cached-campaign-data";

export const dynamic = "force-dynamic";

interface CampaignEntryProps {
  params: Promise<{ lng: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

function buildQuery(
  searchParams: { [key: string]: string | string[] | undefined },
  drop: string[]
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (drop.includes(key)) continue;
    if (typeof value === "string") params.set(key, value);
    else if (Array.isArray(value)) params.set(key, value.join(","));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/**
 * The slug-less entry point: /[lng]/collection/campaign resolves whichever
 * campaign is currently active and sends the visitor to its own URL.
 *
 * It renders nothing on purpose, and therefore needs no loading state - every
 * path out of here is a redirect, and a route that only redirects must not have
 * a loading.tsx above it. Flushing a fallback would send the headers and pin the
 * status at 200, degrading both redirects below to a meta refresh. The listing
 * itself lives under [slug]/, where the redirect decision sits in a layout above
 * the boundary and the fallback is free to stream.
 *
 * The `?slug=` branch is a backstop. middleware.ts already 308s that shape onto
 * the path form without touching Firestore, so this only fires if a request
 * reaches the page with the query string intact - a matcher change, or a direct
 * internal navigation that skipped middleware.
 */
export default async function CampaignEntryPage({
  params,
  searchParams,
}: CampaignEntryProps) {
  const { lng } = await params;
  const resolvedSearchParams = await searchParams;

  const requestedSlug =
    typeof resolvedSearchParams.slug === "string"
      ? resolvedSearchParams.slug.trim()
      : undefined;

  if (requestedSlug) {
    redirect(
      `/${lng}/collection/campaign/${encodeURIComponent(requestedSlug)}` +
        buildQuery(resolvedSearchParams, ["slug"])
    );
  }

  const campaign = await getCachedActiveCampaign();

  if (!campaign?.slug) {
    redirect(`/${lng}/collection`);
  }

  redirect(
    `/${lng}/collection/campaign/${encodeURIComponent(campaign.slug)}` +
      buildQuery(resolvedSearchParams, ["slug"])
  );
}
