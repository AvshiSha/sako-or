import { mutate } from 'swr'

/**
 * Shared SWR cache plumbing for the signed-in user's Neon profile row.
 *
 * Three endpoints all return the same `{ user, needsProfileCompletion }` shape:
 *   - POST  /api/me/sync      (on every sign-in, from AuthProvider)
 *   - GET   /api/me/profile   (the useUserProfile fetcher)
 *   - PATCH /api/me/profile   (profile edits and profile completion)
 *
 * Because they agree on the shape, the two writers can seed the reader's cache
 * directly instead of every consumer firing its own GET. The cache key is
 * uid-scoped so switching accounts can never read the previous user's row.
 */

export interface UserProfile {
  id: string
  firstName: string | null
  lastName: string | null
  email: string | null
  phone: string | null
  interestedIn: string | null
  isNewsletter: boolean
  addressStreet: string | null
  addressStreetNumber: string | null
  addressFloor: string | null
  addressApt: string | null
  addressCity: string | null
  language: string | null
  [key: string]: unknown
}

/**
 * What the cache holds. `user: null` is a real, valid state - it means the
 * Firebase account is authenticated but has no Neon row yet (signup never
 * reached /api/auth/complete-signup). It is NOT an error, and caching it is
 * what stops the endless 404 refetch loop.
 */
export interface UserProfileSnapshot {
  ok: true
  user: UserProfile | null
  needsProfileCompletion: boolean
}

/**
 * What the writers actually hand us. The endpoints all return the full Prisma
 * row, but the call sites type their own responses more narrowly (each page
 * declares only the fields it renders), so the input is accepted as a partial
 * and widened on the way in.
 */
export type UserProfileLike = Partial<UserProfile> & Record<string, unknown>

export interface UserProfileResponseBody {
  user?: UserProfileLike | null
  needsProfileCompletion?: boolean
}

export const USER_PROFILE_KEY_PREFIX = '/api/me/profile:'

export function userProfileKey(uid: string): string {
  return `${USER_PROFILE_KEY_PREFIX}${uid}`
}

/** The snapshot for an authenticated account that has no Neon row yet. */
export const NO_PROFILE_SNAPSHOT: UserProfileSnapshot = {
  ok: true,
  user: null,
  needsProfileCompletion: true
}

/**
 * Normalizes any of the three endpoints' bodies into a snapshot. `sync` sends
 * `user: null` with no profile row; `PATCH` always sends a row. Both send
 * `needsProfileCompletion`, but we fall back to deriving it so a missing flag
 * can never cache as "complete".
 */
export function toUserProfileSnapshot(body: UserProfileResponseBody): UserProfileSnapshot {
  const user = (body.user ?? null) as UserProfile | null
  return {
    ok: true,
    user,
    needsProfileCompletion:
      typeof body.needsProfileCompletion === 'boolean'
        ? body.needsProfileCompletion
        : !user
  }
}

/**
 * Writes a profile payload straight into the SWR cache for `uid`.
 *
 * `revalidate: false` is the point of this function: the data is already fresh
 * (it is the response body of a request that just completed), so revalidating
 * would re-fetch exactly what we just stored. Paired with the hook's
 * `revalidateIfStale: false`, a seeded cache means zero GET /api/me/profile.
 */
export function primeUserProfileCache(uid: string, body: UserProfileResponseBody): void {
  void mutate(userProfileKey(uid), toUserProfileSnapshot(body), { revalidate: false })
}

/**
 * Drops every cached profile row. Called on sign-out and on account switch so
 * one account's name can never be shown to the next one, and so a later
 * sign-in starts from a fresh fetch rather than a stale snapshot.
 */
export function clearUserProfileCache(): void {
  void mutate(
    (key) => typeof key === 'string' && key.startsWith(USER_PROFILE_KEY_PREFIX),
    undefined,
    { revalidate: false }
  )
}
