'use client'

import type { User } from 'firebase/auth'
import { AuthContext, type AuthContextType } from '@/app/contexts/auth-context-shared'

const authNotReady = () =>
  Promise.reject(new Error('Authentication is still loading. Please try again in a moment.'))

/** Lightweight auth stub used before Firebase Auth is loaded on the critical path. */
export function GuestAuthProvider({
  children,
  onEnsureAuth,
}: {
  children: React.ReactNode
  onEnsureAuth: () => void
}) {
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

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
