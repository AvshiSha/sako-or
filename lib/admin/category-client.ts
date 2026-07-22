'use client';

import type { User } from 'firebase/auth';
import { getAdminAuthHeaders } from '@/lib/admin-api';

export type CategoryMutationError = {
  ok: false;
  status: number;
  error: string;
  code?: 'HAS_PRODUCTS' | 'HAS_CHILDREN';
  childCount?: number;
  productCount?: number;
  children?: { id: string; name?: { en?: string; he?: string } | string; level?: number }[];
};

export type CategoryMutationResult<T> = { ok: true; data: T } | CategoryMutationError;

async function parseResult<T>(res: Response): Promise<CategoryMutationResult<T>> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: data.error || `Request failed (HTTP ${res.status})`,
      code: data.code,
      childCount: data.childCount,
      productCount: data.productCount,
      children: data.children,
    };
  }
  return { ok: true, data: data as T };
}

/**
 * Centralized enable/disable + delete mutations for categories at every
 * hierarchy level. Both go through the server-validated
 * /api/admin/categories/:id route (admin-authorized, checks existence,
 * blocks unsafe deletes) rather than writing to Firestore directly from the
 * browser, so every caller gets the same validation and error shape.
 */
export async function setCategoryEnabled(
  user: User,
  categoryId: string,
  isEnabled: boolean
): Promise<CategoryMutationResult<{ id: string; isEnabled: boolean }>> {
  const headers = await getAdminAuthHeaders(user);
  const res = await fetch(`/api/admin/categories/${categoryId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ isEnabled }),
  });
  return parseResult(res);
}

export async function deleteCategory(
  user: User,
  categoryId: string,
  options?: { cascade?: boolean }
): Promise<CategoryMutationResult<{ deletedId: string; deletedDescendantIds: string[] }>> {
  const headers = await getAdminAuthHeaders(user);
  const query = options?.cascade ? '?cascade=true' : '';
  const res = await fetch(`/api/admin/categories/${categoryId}${query}`, {
    method: 'DELETE',
    headers,
  });
  return parseResult(res);
}
