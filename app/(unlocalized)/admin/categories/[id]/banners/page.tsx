'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import CategoryBannersEditor from '../../_components/CategoryBannersEditor';

function CategoryBannersPageContent() {
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

  // Banners save through their own endpoint, so nothing here can collide with an
  // ordering save on the merchandising page.
  return (
    <div className="min-h-screen bg-gray-50 pt-16 pb-12">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <CategoryBannersEditor categoryId={id} />
      </div>
    </div>
  );
}

export default function CategoryBannersPage() {
  return (
    <ProtectedRoute>
      <Suspense
        fallback={
          <div className="min-h-screen bg-gray-50 pt-16 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
          </div>
        }
      >
        <CategoryBannersPageContent />
      </Suspense>
    </ProtectedRoute>
  );
}
