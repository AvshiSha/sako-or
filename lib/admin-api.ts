import { getAuth, User } from 'firebase/auth';

export async function getAdminAuthHeaders(user: User): Promise<HeadersInit> {
  const token = await user.getIdToken();
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Same headers, resolved from the current session instead of a passed-in user.
 *
 * For the few admin helpers that are plain functions with no component context
 * to take a `user` from. Every /api/admin route begins with requireAdmin, so a
 * request without this header is a 401 — which is exactly what was happening to
 * revalidateCmsPaths(), silently, because it never checked res.ok.
 *
 * Falls back to a Content-Type-only header when there is no signed-in user, so
 * the caller still gets a well-formed (if unauthorized) request rather than a
 * thrown error.
 */
export async function getAdminAuthHeadersFromSession(): Promise<HeadersInit> {
  try {
    const user = getAuth().currentUser;
    if (user) return await getAdminAuthHeaders(user);
  } catch (error) {
    console.error('Could not resolve admin auth headers:', error);
  }
  return { 'Content-Type': 'application/json' };
}
