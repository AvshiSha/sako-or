'use client'

import useSWR from 'swr'
import { useAuth } from '@/app/hooks/useAuth'

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

interface ProfileResponse {
  ok: true
  user: UserProfile
  needsProfileCompletion: boolean
}

/**
 * SWR-backed /api/me/profile fetch, keyed by uid. Components mounted
 * together (Navigation, MobileAuthGreeting, FacebookPixel, CheckoutModal, ...)
 * share one in-flight request and cache entry instead of each firing its own.
 */
export function useUserProfile() {
  const { user, loading: authLoading } = useAuth()

  const { data, error, isLoading, mutate } = useSWR<ProfileResponse>(
    user && !authLoading ? `/api/me/profile:${user.uid}` : null,
    async () => {
      const token = await user!.getIdToken()
      const res = await fetch('/api/me/profile', {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` }
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json || json.error) {
        throw new Error(json?.error || 'Failed to load profile')
      }
      return json
    },
    { revalidateOnFocus: false }
  )

  return {
    profile: data?.user ?? null,
    needsProfileCompletion: data?.needsProfileCompletion ?? false,
    isLoading,
    error: error as Error | undefined,
    mutate
  }
}
