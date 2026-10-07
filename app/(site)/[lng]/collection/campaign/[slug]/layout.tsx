import { redirect } from "next/navigation";

import CampaignHero from "@/app/components/collection/CampaignHero";

import { getCachedCampaignBySlug } from "@/lib/server/cached-campaign-data";

const serializeValue = (value: any): any => {
  if (value === null || value === undefined) return value;

  if (
    typeof value === "object" &&
    "seconds" in value &&
    "nanoseconds" in value
  ) {
    const milliseconds =
      (value.seconds as number) * 1000 + (value.nanoseconds as number) / 1_000_000;
    return new Date(milliseconds).toISOString();
  }

  if (Array.isArray(value)) return value.map(serializeValue);

  if (typeof value === "object") {
    const serialized: Record<string, any> = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      serialized[key] = serializeValue(nestedValue);
    }
    return serialized;
  }

  return value;
};

/**
 * Everything on the campaign route that has to be decided before a single byte
 * is flushed: does this campaign exist, and what does its hero look like.
 *
 * It is a layout rather than part of the page on purpose. loading.tsx creates a
 * Suspense boundary around a folder's *children*, so a layout in the same folder
 * renders outside that boundary - which is what makes both of these safe here:
 *
 *  - `redirect()` below throws before the fallback can be rendered, so an unknown
 *    slug is still a real 307 rather than the meta refresh a redirect degrades to
 *    once headers have gone out. That hazard is why campaign/loading.tsx was
 *    deleted in the first place; moving the decision up here is what lets the
 *    file come back.
 *  - The hero paints with the first chunk, from this campaign's own data. The
 *    fallback below it therefore never has to guess a hero height - the problem
 *    CampaignHero's own comment describes, where a campaign with a banner and one
 *    without disagree by 713px on a phone and no route-level skeleton could
 *    reserve the right box. It no longer has to: the box is already drawn.
 *
 * The slug is a path segment rather than `?slug=` precisely so this layout can
 * read it. Layouts receive `params`, never `searchParams`, so the query-string
 * form could not have been resolved above the boundary at all. middleware.ts
 * 308s the old `?slug=` URLs onto this shape without touching Firestore.
 */
export default async function CampaignLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lng: string; slug: string }>;
}) {
  const { lng, slug } = await params;

  const campaign = await getCachedCampaignBySlug(decodeURIComponent(slug));

  if (!campaign) {
    redirect(`/${lng}/collection`);
  }

  return (
    <div className="min-h-screen bg-surface-secondary">
      <CampaignHero
        campaign={serializeValue(campaign)}
        lng={lng as "en" | "he"}
      />
      {children}
    </div>
  );
}
