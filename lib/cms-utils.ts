import { getAdminAuthHeadersFromSession } from '@/lib/admin-api'

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Flush the given public paths after a CMS write made through the client SDK.
 *
 * The Authorization header is required: /api/admin/revalidate begins with
 * requireAdmin. Without it every call 401s — and because the old version only
 * caught network errors and never checked res.ok, that failure was completely
 * silent, leaving CMS pages stale until their 24-hour ISR window expired.
 *
 * Still non-throwing: a failed cache flush must not lose the admin's saved
 * content, which is already committed by this point. It is now logged instead
 * of swallowed.
 */
export async function revalidateCmsPaths(
  paths: string[],
  options?: { navigation?: boolean }
): Promise<void> {
  try {
    const headers = await getAdminAuthHeadersFromSession()
    const response = await fetch('/api/admin/revalidate', {
      method: 'POST',
      headers,
      body: JSON.stringify({ paths, navigation: options?.navigation === true }),
    })
    if (!response.ok) {
      console.error(
        `Revalidation request failed (HTTP ${response.status}). Public pages may stay stale until the ISR window expires.`
      )
    }
  } catch (error) {
    console.error('Failed to revalidate paths:', error)
  }
}

/**
 * Flush the storefront navigation after a category create, edit or delete made
 * through the client SDK. Category mutations change the nav even when no
 * collection path is affected - a brand new category has no old path to
 * revalidate, so path-based revalidation alone misses it.
 */
export async function revalidateNavigationCategories(): Promise<void> {
  await revalidateCmsPaths([], { navigation: true })
}
