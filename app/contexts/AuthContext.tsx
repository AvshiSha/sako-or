'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { 
  User, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  createUserWithEmailAndPassword
} from 'firebase/auth'
import { auth } from '@/lib/firebase'

interface AuthContextType {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  isAdmin: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// List of admin emails - in production, this should be stored in Firestore
const ADMIN_EMAILS = [
  'admin@sako-or.com',
  'manager@sako-or.com',
  'avshisakoor@gmail.com', // Firebase emails are always lowercase
  // Add more admin emails here
]

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const isAdmin = user ? ADMIN_EMAILS.includes((user.email || '').toLowerCase()) : false

  const syncUserToNeon = async (firebaseUser: User) => {
    try {
      const token = await firebaseUser.getIdToken().catch((err) => {
        // Handle token retrieval errors gracefully
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
        // Only log as error if it's not a 400 Bad Request (which might be API key issues)
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
      // Network errors or other exceptions - log as warning for 400 errors
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
      setLoading(false)
    })

    return unsubscribe
  }, [])

  // Keep Neon user record up to date on login / refresh
  useEffect(() => {
    if (!user) return
    void syncUserToNeon(user)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid])

  const signIn = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password)
      // Sync handled by useEffect watching user?.uid
    } catch (error) {
      console.error('Sign in error:', error)
      throw error
    }
  }

  const signUp = async (email: string, password: string) => {
    try {
      await createUserWithEmailAndPassword(auth, email, password)
      // Sync handled by useEffect watching user?.uid
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
    isAdmin
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
