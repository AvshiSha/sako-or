'use client'

import React, { useEffect, useState } from 'react'
import {
  User,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword
} from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { isAdminEmail } from '@/lib/admin'
import { AuthContext, type AuthContextType } from '@/app/contexts/auth-context-shared'

export type { AuthContextType } from '@/app/contexts/auth-context-shared'
export { AuthContext } from '@/app/contexts/auth-context-shared'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [serverIsAdmin, setServerIsAdmin] = useState<boolean | null>(null)

  const isAdmin = user
    ? isAdminEmail(user.email) || serverIsAdmin === true
    : false

  const adminCheckPending = !!user && !isAdminEmail(user.email) && serverIsAdmin === null

  const resolveAdminAccess = async (firebaseUser: User) => {
    // Fast path for known admin emails: show admin UI immediately without
    // waiting for the API response. We still call the API below so the server
    // can set the Firebase custom claim used by Firestore security rules.
    if (isAdminEmail(firebaseUser.email)) {
      setServerIsAdmin(true)
    } else {
      setServerIsAdmin(null)
    }

    try {
      const token = await firebaseUser.getIdToken().catch((err) => {
        console.warn('[AUTH_CONTEXT] Failed to get ID token for admin check:', err?.message || err)
        return null
      })

      if (!token) {
        if (!isAdminEmail(firebaseUser.email)) setServerIsAdmin(false)
        return
      }

      const res = await fetch('/api/admin/check-access', {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!res.ok) {
        if (!isAdminEmail(firebaseUser.email)) setServerIsAdmin(false)
        return
      }

      const data = await res.json().catch(() => ({}))
      const confirmed = data.isAdmin === true

      if (!isAdminEmail(firebaseUser.email)) {
        setServerIsAdmin(confirmed)
      }

      // Force-refresh the ID token so the admin custom claim set by the server
      // is picked up immediately by the Firestore client SDK. Without this,
      // Firestore admin writes would fail until the token naturally expires
      // (up to 1 hour). The refresh is non-fatal if it fails.
      if (confirmed) {
        await firebaseUser.getIdToken(true).catch((err) => {
          console.warn('[AUTH_CONTEXT] Token refresh after admin claim failed:', err?.message || err)
        })
      }
    } catch (error) {
      console.error('[AUTH_CONTEXT] Admin access check failed:', error)
      if (!isAdminEmail(firebaseUser.email)) setServerIsAdmin(false)
    }
  }

  const syncUserToNeon = async (firebaseUser: User) => {
    try {
      const token = await firebaseUser.getIdToken().catch((err) => {
        console.warn('[AUTH_CONTEXT] Failed to get ID token:', err?.message || err)
        return null
      })

      if (!token) {
        console.warn('[AUTH_CONTEXT] Skipping Neon sync - no token available')
        return
      }

      const res = await fetch('/api/me/sync', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        }
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }))
        const errorMessage = errorData.error || `HTTP ${res.status}`
        if (res.status === 400) {
          console.warn(
            `[AUTH_CONTEXT] Sync failed (400) - may be API key/domain issue: ${errorMessage}`,
            { uid: firebaseUser.uid, status: res.status }
          )
        } else {
          console.error(
            `[AUTH_CONTEXT] Failed to sync user to Neon: ${errorMessage}`,
            { uid: firebaseUser.uid, status: res.status, errorData }
          )
        }
        return
      }

      const data = await res.json().catch(() => ({}))
      console.log('[AUTH_CONTEXT] User synced to Neon successfully:', {
        uid: firebaseUser.uid,
        neonId: data.id
      })
    } catch (error: any) {
      const is400Error = error?.message?.includes('400') || error?.code === 'auth/network-request-failed'
      if (is400Error) {
        console.warn(
          '[AUTH_CONTEXT] Sync error (400) - may be API key/domain configuration issue:',
          error?.message || error,
          { uid: firebaseUser.uid }
        )
      } else {
        console.error(
          '[AUTH_CONTEXT] Network/system error during Neon sync:',
          error,
          { uid: firebaseUser.uid }
        )
      }
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user)
      if (!user) {
        setServerIsAdmin(null)
      }
      setLoading(false)
    }, (error) => {
      console.error('[AUTH_CONTEXT] onAuthStateChanged error:', error)
      setLoading(false)
    })

    return unsubscribe
  }, [])

  useEffect(() => {
    if (!user) return
    void resolveAdminAccess(user)
    void syncUserToNeon(user)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid])

  const signIn = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password)
    } catch (error) {
      console.error('Sign in error:', error)
      throw error
    }
  }

  const signUp = async (email: string, password: string) => {
    try {
      await createUserWithEmailAndPassword(auth, email, password)
    } catch (error) {
      console.error('Sign up error:', error)
      throw error
    }
  }

  const logout = async () => {
    try {
      await signOut(auth)
    } catch (error) {
      console.error('Logout error:', error)
      throw error
    }
  }

  const value = {
    user,
    loading,
    signIn,
    signUp,
    logout,
    isAdmin,
    adminCheckPending
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export { useAuth } from '@/app/hooks/useAuth'
