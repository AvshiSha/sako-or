'use client';

import type { User } from 'firebase/auth';
import { getAdminAuthHeaders } from '@/lib/admin-api';
import type { FaqAudience, FaqPageSettings, FaqStatus } from '@/lib/faq-types';

/**
 * Typed wrappers for every FAQ mutation.
 *
 * Mirrors lib/admin/category-client.ts, including its discriminated result
 * type. Every call carries the Firebase ID token via getAdminAuthHeaders —
 * the routes all begin with requireAdmin and will 401 without it. (The coupons
 * admin UI omits this header today and its routes 401 as a result; do not copy
 * that pattern.)
 */

export type FaqMutationError = {
  ok: false;
  status: number;
  error: string;
  code?: 'SLUG_TAKEN' | 'INVALID_SLUG' | 'EMPTY_ANSWER';
  /** 409 reorder conflict: ids the server has that the client did not send. */
  missing?: string[];
  /** 409 reorder conflict: ids the client sent that the server does not have. */
  unknown?: string[];
  duplicates?: string[];
  issues?: Array<{ path: (string | number)[]; message: string }>;
};

export type FaqMutationResult<T> = { ok: true; data: T } | FaqMutationError;

async function parseResult<T>(res: Response): Promise<FaqMutationResult<T>> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: data.error || `Request failed (HTTP ${res.status})`,
      code: data.code,
      missing: data.missing,
      unknown: data.unknown,
      duplicates: data.duplicates,
      issues: data.issues,
    };
  }
  return { ok: true, data: data as T };
}

/** Turn a zod issue list into the flat field->message map the forms render. */
export function issuesToFieldMap(
  issues: FaqMutationError['issues']
): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of issues ?? []) {
    const key = issue.path.join('.') || 'root';
    if (!fields[key]) fields[key] = issue.message;
  }
  return fields;
}

export interface FaqWritePayload {
  slug?: string;
  audience: FaqAudience;
  topic: string;
  question: { he: string; en: string };
  answerHtml: { he: string; en: string };
  shortAnswer?: { he: string; en: string };
  relatedLinks?: Array<{ label: { he: string; en: string }; href: string }>;
  status?: 'draft' | 'published';
  featured?: boolean;
}

export type FaqWriteResponse = { id: string; slug: string; warnings: string[] };

export async function createFaq(
  user: User,
  payload: FaqWritePayload
): Promise<FaqMutationResult<FaqWriteResponse>> {
  const headers = await getAdminAuthHeaders(user);
  const res = await fetch('/api/admin/faq', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  return parseResult(res);
}

/**
 * `status` is Omit-ed and re-declared rather than intersected: an intersection
 * with FaqWritePayload's own `'draft' | 'published'` narrows to that pair
 * instead of widening, which would make 'hidden' unassignable here even though
 * the update route accepts it.
 */
export async function updateFaq(
  user: User,
  id: string,
  payload: Omit<Partial<FaqWritePayload>, 'status'> & { status?: FaqStatus }
): Promise<FaqMutationResult<{ id: string; warnings: string[] }>> {
  const headers = await getAdminAuthHeaders(user);
  const res = await fetch(`/api/admin/faq/${id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(payload),
  });
  return parseResult(res);
}

export async function setFaqStatus(
  user: User,
  id: string,
  status: FaqStatus
): Promise<FaqMutationResult<{ id: string; status: FaqStatus }>> {
  const headers = await getAdminAuthHeaders(user);
  const res = await fetch(`/api/admin/faq/${id}/status`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ status }),
  });
  return parseResult(res);
}

export async function deleteFaq(
  user: User,
  id: string
): Promise<FaqMutationResult<{ deletedId: string; slug: string }>> {
  const headers = await getAdminAuthHeaders(user);
  const res = await fetch(`/api/admin/faq/${id}`, { method: 'DELETE', headers });
  return parseResult(res);
}

/**
 * `orderedIds` must be the complete current membership of that audience,
 * including drafts and hidden questions — the server answers 409 with
 * `missing`/`unknown` rather than applying a partial order.
 */
export async function reorderFaqs(
  user: User,
  audience: FaqAudience,
  orderedIds: string[]
): Promise<FaqMutationResult<{ audience: FaqAudience; updated: number }>> {
  const headers = await getAdminAuthHeaders(user);
  const res = await fetch('/api/admin/faq/reorder', {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ audience, orderedIds }),
  });
  return parseResult(res);
}

export async function saveFaqSettings(
  user: User,
  payload: Record<string, unknown>
): Promise<FaqMutationResult<{ saved: true }>> {
  const headers = await getAdminAuthHeaders(user);
  const res = await fetch('/api/admin/faq/settings', {
    method: 'PUT',
    headers,
    body: JSON.stringify(payload),
  });
  return parseResult(res);
}

export async function loadFaqSettings(
  user: User
): Promise<FaqMutationResult<{ settings: FaqPageSettings | null }>> {
  const headers = await getAdminAuthHeaders(user);
  const res = await fetch('/api/admin/faq/settings', { headers });
  return parseResult(res);
}

export type FaqPreviewResponse = {
  question: string;
  answerHtml: string;
  warnings: string[];
};

export async function previewFaqAnswer(
  user: User,
  question: string,
  answerHtml: string
): Promise<FaqMutationResult<FaqPreviewResponse>> {
  const headers = await getAdminAuthHeaders(user);
  const res = await fetch('/api/admin/faq/preview', {
    method: 'POST',
    headers,
    body: JSON.stringify({ question, answerHtml }),
  });
  return parseResult(res);
}
