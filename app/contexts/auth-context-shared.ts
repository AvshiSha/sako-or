'use client'

import { createContext } from 'react'
import type { User } from 'firebase/auth'

export interface AuthContextType {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  isAdmin: boolean
  adminCheckPending: boolean
  /**
   * The uid whose POST /api/me/sync has finished (successfully or not), or null.
   * useUserProfile gates its fetch on this so the profile GET cannot race the
   * sync POST that is about to seed its cache. Settles on failure too, so a
   * failed sync degrades to "fetch the profile yourself" rather than hanging.
   */
  profileSyncedUid: string | null
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined)
