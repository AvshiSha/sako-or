import 'server-only'

import { cache } from 'react'
import { campaignService } from '@/lib/firebase'

/**
 * Per-request dedup for campaign lookups, mirroring cached-category-data.ts.
 *
 * The campaign route resolves the same campaign three times per request - the
 * layout (which owns the redirect decision), generateMetadata, and the page -
 * and every one of those reads sits in front of the first flushed byte, because
 * the layout renders outside the loading boundary. React.cache() collapses them
 * into a single Firestore read.
 *
 * Measured before this existed: 2.18s to first byte on the campaign route
 * against 0.40s on the collection listing, with two uncached getDoc round trips
 * in that window and nothing on screen for either of them.
 */
export const getCachedCampaignBySlug = cache(async (slug: string) => {
  return campaignService.getCampaignBySlug(slug)
})

export const getCachedActiveCampaign = cache(async () => {
  return campaignService.getActiveCampaign()
})
