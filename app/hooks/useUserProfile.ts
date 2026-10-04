'use client'

import useSWR from 'swr'
import { useAuth } from '@/app/hooks/useAuth'
import {
  NO_PROFILE_SNAPSHOT,
  toUserProfileSnapshot,
  userProfileKey,
  type UserProfile,
  type UserProfileSnapshot
} from '@/lib/user-profile-cache'

export type { UserProfile, UserProfileSnapshot }

/** Carries the HTTP status so retry policy can tell 5xx (transient) from 4xx (not). */
export class ProfileRequestError extends Error {
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ProfileRequestError'
    this.status = status
  }
}

/**
 * SWR-backed view of the signed-in user's Neon profile row. Components mounted
 * together (Navigation, MobileAuthGreeting, FacebookPixel, CheckoutModal, ...)
 * share one cache entry instead of each firing its own request.
 *
 * In the common case this hook issues NO request at all: AuthProvider seeds the
 * cache from the /api/me/sync response it already fetches on every sign-in (see
 * lib/user-profile-cache.ts). The fetcher below is the fallback for when that
 * seed is missing - sync failed, or the tab was restored from a cache that no
 * longer holds the row.
 *
 * Two deliberate choices keep it from looping:
 *
 *  - A 404 resolves to `NO_PROFILE_SNAPSHOT` instead of throwing. "Signed in,
 *    but no Neon row yet" is an expected state of the signup flow, not a
 *    failure: /api/me/sync returns 200 without creating the row, and only
 *    /api/auth/complete-signup (or PATCH /api/me/profile) creates it. Throwing
 *    made SWR treat it as a retryable error and, because `errorRetryCount`
 *    defaults to unlimited, re-request it forever on an exponential backoff.
 *    It also left `data` undefined, so `needsProfileCompletion` read `false`
 *    for precisely the users who needed completion.
 *
 *  - `revalidateIfStale: false`, so a cached snapshot is not re-fetched when a
 *    consumer remounts. ClientAuthProvider swaps the guest tree for the
 *    authenticated tree at the same position, which unmounts and remounts every
 *    consumer below it once per page load.
 *
 * Genuine failures (5xx, network, 401/403) still surface through `error`.
 */
export function useUserProfile() {
  const { user, loading: authLoading, profileSyncedUid } = useAuth()
  const uid = user?.uid ?? null

  // Wait for /api/me/sync to settle for THIS uid before considering a fetch.
  // Both run off the same auth state change, so without this gate they race:
  // the GET would be in flight before sync has had a chance to seed the cache,
  // making the seed pointless and double-charging every sign-in.
  const syncSettled = !!uid && !authLoading && profileSyncedUid === uid
  const key = syncSettled ? userProfileKey(uid!) : null

  const { data, error, isLoading, mutate } = useSWR<UserProfileSnapshot>(
    key,
    async () => {
      const token = await user!.getIdToken()
      const res = await fetch('/api/me/profile', {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` }
      })

      // Expected state, not an error - see the note above.
      if (res.status === 404) return NO_PROFILE_SNAPSHOT

      const json = await res.json().catch(() => null)
      if (!res.ok || !json || json.error) {
        throw new ProfileRequestError(
          json?.error || `Failed to load profile (HTTP ${res.status})`,
          res.status
        )
      }
      return toUserProfileSnapshot(json)
    },
    {
      revalidateOnFocus: false,
      revalidateIfStale: false,
      // 4xx are permanent for a given token (403 = password auth disabled,
      // 401 = expired token, which a fresh getIdToken resolves on next mount).
      // Only transient failures are worth retrying, and only a few times.
      shouldRetryOnError: (err) =>
        !(err instanceof ProfileRequestError && err.status >= 400 && err.status < 500),
      errorRetryCount: 2
    }
  )

  return {
    profile: data?.user ?? null,
    needsProfileCompletion: data?.needsProfileCompletion ?? false,
    // Report "loading" while sync is still settling too, so consumers that
    // gate their UI on this (the nav greeting) don't flash a fallback name
    // and then swap it for the real first name a moment later.
    isLoading: isLoading || (!!uid && !authLoading && !syncSettled),
    error: error as Error | undefined,
    mutate
  }
}
