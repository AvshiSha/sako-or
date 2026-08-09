'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import CategoryMerchandisingBoard from '../../_components/CategoryMerchandisingBoard';

function MerchandisingPageContent() {
  const params = useParams();
  const rawId = params?.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;

  if (!id || typeof id !== 'string') {
    return (
      <div className="min-h-screen bg-gray-50 pt-16 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <h1 className="text-lg font-semibold text-gray-900">Category not found</h1>
          <p className="mt-2 text-sm text-gray-600">
            The category id in this URL is missing or invalid.
          </p>
          <Link
            href="/admin/categories"
            className="mt-4 inline-block text-sm text-indigo-600 hover:text-indigo-800"
          >
            ← Back to categories
          </Link>
        </div>
      </div>
    );
  }

  return <CategoryMerchandisingBoard categoryId={id} />;
}

export default function CategoryMerchandisingPage() {
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

