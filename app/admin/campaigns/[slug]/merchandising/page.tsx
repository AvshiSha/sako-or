'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import { parseCampaignSlug } from '@/lib/campaign-merchandising-types';
import CampaignMerchandisingBoard from '../../_components/CampaignMerchandisingBoard';

function MerchandisingPageContent() {
  const params = useParams();
  const rawSlug = params?.slug;
  const slug = parseCampaignSlug(Array.isArray(rawSlug) ? rawSlug[0] : rawSlug);

  if (!slug) {
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

  return <CampaignMerchandisingBoard slug={slug} />;
}

export default function CampaignMerchandisingPage() {
  return (
    <ProtectedRoute>
      <Suspense
        fallback={
          <div className="min-h-screen bg-gray-50 pt-16 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
          </div>
        }
      >
        <MerchandisingPageContent />
      </Suspense>
    </ProtectedRoute>
  );
}
