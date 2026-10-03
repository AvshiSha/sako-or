'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import GridBannersEditor from '../../../_components/GridBannersEditor';

/**
 * Grid banners for a campaign listing — the campaign twin of
 * /admin/categories/[id]/banners, driven by the same editor so the two cannot
 * drift apart.
 *
 * Banners save through their own endpoint, so nothing here can collide with an
 * ordering save on the merchandising board.
 */
function CampaignBannersPageContent() {
  const params = useParams();
  const rawSlug = params?.slug;
  const slug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug;

  if (!slug || typeof slug !== 'string') {
    return (
      <div className="min-h-screen bg-gray-50 pt-16 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <h1 className="text-lg font-semibold text-gray-900">Campaign not found</h1>
          <p className="mt-2 text-sm text-gray-600">
            The campaign slug in this URL is missing or invalid.
          </p>
          <Link
            href="/admin/campaigns"
            className="mt-4 inline-block text-sm text-indigo-600 hover:text-indigo-800"
          >
            ← Back to campaigns
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-16 pb-12">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <GridBannersEditor
          endpoint={`/api/admin/campaigns/${slug}/merchandising/banners`}
          backHref="/admin/campaigns"
          backLabel="Back to campaigns"
          orderHref={`/admin/campaigns/${slug}/merchandising`}
          scopeNoun="campaign"
          fallbackTitle={slug}
        />
      </div>
    </div>
  );
}

export default function CampaignBannersPage() {
  return (
    <ProtectedRoute>
      <Suspense
        fallback={
          <div className="min-h-screen bg-gray-50 pt-16 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
          </div>
        }
      >
        <CampaignBannersPageContent />
      </Suspense>
    </ProtectedRoute>
  );
}
