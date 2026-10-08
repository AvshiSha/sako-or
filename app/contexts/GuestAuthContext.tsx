'use client'

import type { User } from 'firebase/auth'
import type { AuthContextType } from '@/app/contexts/auth-context-shared'

const authNotReady = () =>
  Promise.reject(new Error('Authentication is still loading. Please try again in a moment.'))

/**
 * The auth value a visitor has before the Firebase chunk arrives.
 *
 * It used to be provided by a `GuestAuthProvider` component that
 * ClientAuthProvider swapped out for the authenticated shell - and that swap was
 * what remounted the whole page. ClientAuthProvider now keeps one provider
 * mounted and feeds it this value until FirebaseAuthBridge publishes a real one,
 * so the shape lives here and the component is gone.
 *
 * `loading: false` is deliberate and unchanged: before the chunk is even
 * requested there is nothing in flight to wait for, and consumers that gate on
 * `loading` must not sit on a spinner for a visitor who is simply a guest. The
 * moment the bridge mounts it publishes AuthProvider's own initial value, which
 * carries `loading: true` - exactly the sequence consumers saw before.
 */
export function createGuestAuthValue(onEnsureAuth: () => void): AuthContextType {
  const value: AuthContextType = {
    user: null as User | null,
    loading: false,
    signIn: async () => {
      onEnsureAuth()
      return authNotReady()
    },
    signUp: async () => {
      onEnsureAuth()
      return authNotReady()
    },
    logout: async () => {
      onEnsureAuth()
      return authNotReady()
    },
    isAdmin: false,
    adminCheckPending: false,
    // No Firebase user in the guest stub, so there is nothing to sync and
    // useUserProfile stays keyless.
    profileSyncedUid: null,
  }

  return value
}
