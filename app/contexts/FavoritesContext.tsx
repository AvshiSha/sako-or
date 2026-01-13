'use client'

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/app/contexts/AuthContext'

export interface FavoritesHook {
  favorites: string[]
  isFavorite: (favoriteKey: string) => boolean
  addToFavorites: (favoriteKey: string) => Promise<void> | void
  removeFromFavorites: (favoriteKey: string) => Promise<void> | void
  toggleFavorite: (favoriteKey: string) => Promise<void> | void
  clearAllLocal: () => void
  loading: boolean
}

type FavoritesMode = 'guest' | 'logged_in'

const STORAGE_KEY = 'favorites'

class HttpError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'HttpError'
    this.status = status
  }
}

async function fetchJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    let err: any = {}
    if (text) {
      try {
        err = JSON.parse(text)
      } catch {
        err = { error: text }
      }
    }
    const msg = typeof err?.error === 'string' ? err.error : `HTTP ${res.status}`
    throw new HttpError(msg, res.status)
  }
  const text = await res.text().catch(() => '')
  if (!text || !text.trim()) return {} as T
  try {
    return JSON.parse(text) as T
  } catch (error) {
    console.error('Failed to parse JSON response:', error, 'Response text:', text)
    return {} as T
  }
}

function safeReadFavoritesFromStorage(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw || !raw.trim()) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((k) => typeof k === 'string').map((k) => k.trim()).filter(Boolean)
  } catch {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
    return []
  }
}

const FavoritesContext = createContext<FavoritesHook | undefined>(undefined)

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [favorites, setFavorites] = useState<string[]>(() => safeReadFavoritesFromStorage())
  const [mode, setMode] = useState<FavoritesMode>('guest')
  const [loading, setLoading] = useState(true)

  const lastSeenUidRef = useRef<string | null>(null)
  const completedUidRef = useRef<string | null | undefined>(undefined)

  // Persist to localStorage ONLY in guest mode
  useEffect(() => {
    if (mode === 'guest') {
      try {
        if (favorites.length === 0) {
          localStorage.removeItem(STORAGE_KEY)
        } else {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites))
        }
      } catch (error) {
        console.error('Error saving favorites:', error)
      }
    }
  }, [favorites, loading, mode])

  // Main mode determination and data loading
  useEffect(() => {
    let cancelled = false
    const uid = user?.uid ?? null

    // Only skip if we've COMPLETED initialization for this uid before
    if (completedUidRef.current !== undefined && completedUidRef.current === uid) {
      return
    }
    
    const previousUid = lastSeenUidRef.current
    lastSeenUidRef.current = uid

    async function determineMode() {
      // No user -> guest mode
      if (!user) {
        setMode('guest')
        
        // Logout transition: clear everything
        if (previousUid !== null) {
          setFavorites([])
          try {
            localStorage.removeItem(STORAGE_KEY)
          } catch {
            // ignore
          }
        } else {
          // Initial guest session: seed from localStorage
          const guestFavorites = safeReadFavoritesFromStorage()
          if (guestFavorites.length > 0) {
            setFavorites(guestFavorites)
          }
        }
        
        if (!cancelled) {
          setLoading(false)
          completedUidRef.current = uid
        }
        return
      }

      // User exists - check profile status
      setLoading(true)
      try {
        const token = await user.getIdToken()
        if (!token) {
          setMode('guest')
          setLoading(false)
          return
        }

        // User authenticated -> use database mode immediately
        setMode('logged_in')

        // Merge any guest favorites into DB
        const guestKeys = safeReadFavoritesFromStorage()
        if (Array.isArray(guestKeys) && guestKeys.length > 0) {
          try {
            const mergeResult = await fetchJson<{ merged: number }>('/api/favorites/merge', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
              },
              body: JSON.stringify({ favoriteKeys: guestKeys })
            })
            localStorage.removeItem(STORAGE_KEY)
          } catch (mergeError) {
            console.error('[FavoritesContext] Error merging guest favorites:', mergeError)
            // If it's a 404, the user profile doesn't exist yet - that's OK
            if (mergeError instanceof HttpError && mergeError.status === 404) {
              // Profile not found yet, guest favorites will merge later
            }
            // Continue anyway
          }
        }

        // Load favorites from DB
        try {
          const data = await fetchJson<{
            favorites: Array<{ favoriteKey: string; isActive?: boolean | null }>
          }>('/api/favorites', {
            headers: { Authorization: `Bearer ${token}` }
          })

          if (!cancelled) {
            const favoritesArray = data.favorites || []
            const filteredFavorites = favoritesArray
              .filter((f) => f && typeof f.favoriteKey === 'string' && f.isActive !== false)
              .map((f) => f.favoriteKey)
            setFavorites(filteredFavorites)
          }
        } catch (favoritesError) {
          // If profile doesn't exist yet (404), that's OK - no favorites to load
          if (favoritesError instanceof HttpError && favoritesError.status === 404) {
            setFavorites([])
          } else {
            // Re-throw other errors to be caught by outer catch
            throw favoritesError
          }
        }
      } catch (error) {
        // 404 means user profile doesn't exist yet (new signup) - that's OK
        if (error instanceof HttpError && error.status === 404) {
          // Stay in guest mode temporarily, will switch when profile is created
          setMode('guest')
          setLoading(false)
          return
        }
        
        // Auth errors -> guest mode
        if (error instanceof HttpError && (error.status === 401 || error.status === 403)) {
          setMode('guest')
          setLoading(false)
          return
        }
        
        // Other errors -> log and fall back to guest mode
        console.error('[FavoritesContext] ERROR determining mode - falling back to guest:', error)
        console.error('[FavoritesContext] Error details:', {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          type: error instanceof HttpError ? 'HttpError' : typeof error,
          status: error instanceof HttpError ? error.status : 'N/A'
        })
        setMode('guest')
      } finally {
        if (!cancelled) {
          setLoading(false)
          completedUidRef.current = uid
        }
      }
    }

    void determineMode()
    return () => {
      cancelled = true
    }
  }, [user?.uid]) // Re-run when Firebase user changes

  const clearAllLocal = useCallback(() => {
    setFavorites([])
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
  }, [])

  const isFavorite = useCallback(
    (favoriteKey: string): boolean => {
      return favorites.includes(favoriteKey)
    },
    [favorites]
  )

  const toggleFavorite = useCallback(
    async (favoriteKey: string) => {
      const key = (favoriteKey || '').trim()
      if (!key) return

      // Guest mode: local only
      if (mode === 'guest') {
        setFavorites((prev) => {
          if (prev.includes(key)) return prev.filter((k) => k !== key)
          return [...prev, key]
        })
        return
      }

      // Logged-in mode: DB with optimistic UI
      let removed = false
      setFavorites((prev) => {
        const has = prev.includes(key)
        removed = has
        return has ? prev.filter((k) => k !== key) : [...prev, key]
      })

      try {
        const token = await user?.getIdToken()
        if (!token) {
          throw new Error('Failed to get authentication token. Please try logging in again.')
        }

        const desiredIsActive = !removed
        const data = await fetchJson<{ favoriteKey: string; isActive: boolean }>('/api/favorites/toggle', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ favoriteKey: key, isActive: desiredIsActive })
        })

        // Reconcile with server response
        setFavorites((prev) => {
          const has = prev.includes(data.favoriteKey)
          if (data.isActive) return has ? prev : [...prev, data.favoriteKey]
          return has ? prev.filter((k) => k !== data.favoriteKey) : prev
        })
      } catch (error) {
        if (error instanceof HttpError && error.status === 404) {
          // Profile no longer exists -> fall back to guest mode
          setMode('guest')
          return
        }

        console.error('Error toggling favorite:', error)
        // Revert optimistic update
        setFavorites((prev) => {
          const has = prev.includes(key)
          if (removed) {
            return has ? prev : [...prev, key]
          }
          return has ? prev.filter((k) => k !== key) : prev
        })
      }
    },
    [mode, user]
  )

  const addToFavorites = useCallback(
    async (favoriteKey: string) => {
      const key = (favoriteKey || '').trim()
      if (!key) return
      if (favorites.includes(key)) return
      await toggleFavorite(key)
    },
    [favorites, toggleFavorite]
  )

  const removeFromFavorites = useCallback(
    async (favoriteKey: string) => {
      const key = (favoriteKey || '').trim()
      if (!key) return
      if (!favorites.includes(key)) return
      await toggleFavorite(key)
    },
    [favorites, toggleFavorite]
  )

  const value: FavoritesHook = useMemo(() => ({
    favorites,
    isFavorite,
    addToFavorites,
    removeFromFavorites,
    toggleFavorite,
    clearAllLocal,
    loading
  }), [favorites, isFavorite, addToFavorites, removeFromFavorites, toggleFavorite, clearAllLocal, loading])

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>
}

export function useFavoritesContext(): FavoritesHook {
  const ctx = useContext(FavoritesContext)
  if (!ctx) throw new Error('useFavorites must be used within a FavoritesProvider')
  return ctx
}


