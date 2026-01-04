'use client'

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useAuth } from '@/app/contexts/AuthContext'

export interface FavoritesHook {
  favorites: string[]
  isFavorite: (favoriteKey: string) => boolean
  addToFavorites: (favoriteKey: string) => Promise<void> | void
  removeFromFavorites: (favoriteKey: string) => Promise<void> | void
  toggleFavorite: (favoriteKey: string) => Promise<void> | void
  loading: boolean
}

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
    if (!raw) return []
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
  const [favorites, setFavorites] = useState<string[]>([])
  const [canUseNeon, setCanUseNeon] = useState(false)
  const [loading, setLoading] = useState(true)

  // Seed from localStorage once (guest buffer / initial hydration).
  useEffect(() => {
    const stored = safeReadFavoritesFromStorage()
    if (stored.length > 0) setFavorites(stored)
  }, [])

  // Persist local-only favorites.
  useEffect(() => {
    if (!loading && (!user || !canUseNeon)) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites))
      } catch (error) {
        console.error('Error saving favorites:', error)
      }
    }
  }, [favorites, loading, user, canUseNeon])

  // Ensure we only run init once per uid change (prevents accidental duplicate inits).
  const lastInitUidRef = useRef<string | null>(null)

  // Decide whether to use Neon (DB) vs local-only, then load/merge accordingly.
  useEffect(() => {
    let cancelled = false
    const uid = user?.uid ?? null

    if (lastInitUidRef.current === uid) return
    lastInitUidRef.current = uid

    async function syncSourceAndLoad() {
      if (!user) {
        setCanUseNeon(false)
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        // Don’t force refresh for every init; it’s expensive and can be rate-limited.
        const token = await user.getIdToken()
        if (!token) {
          setCanUseNeon(false)
          return
        }

        // Check whether Neon user exists.
        // Note: Auth flows may call /api/me/sync asynchronously; we retry briefly to avoid race conditions.
        const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
        let profileRes: Response | null = null
        for (let attempt = 0; attempt < 3; attempt++) {
          if (cancelled) return
          if (attempt > 0) await sleep(300 * attempt)
          profileRes = await fetch('/api/me/profile', {
            method: 'GET',
            headers: { Authorization: `Bearer ${token}` }
          })
          if (profileRes.status !== 404) break
        }

        if (!profileRes) {
          setCanUseNeon(false)
          return
        }
        if (profileRes.status === 404) {
          setCanUseNeon(false)
          return
        }
        if (!profileRes.ok) {
          console.error('Error checking Neon user existence:', profileRes.status)
          setCanUseNeon(false)
          return
        }

        // Neon user exists -> merge any local favorites, then load from DB
        setCanUseNeon(true)

        const guestKeys = safeReadFavoritesFromStorage()
        if (Array.isArray(guestKeys) && guestKeys.length > 0) {
          await fetchJson<{ merged: number }>('/api/favorites/merge', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ favoriteKeys: guestKeys })
          })
          localStorage.removeItem(STORAGE_KEY)
        }

        const data = await fetchJson<{
          favorites: Array<{ favoriteKey: string; isActive?: boolean | null }>
        }>('/api/favorites', {
          headers: { Authorization: `Bearer ${token}` }
        })

        if (!cancelled) {
          setFavorites(
            data.favorites
              .filter((f) => f && typeof f.favoriteKey === 'string' && f.isActive !== false)
              .map((f) => f.favoriteKey)
          )
        }
      } catch (error) {
        // Expected cases: auth expired / missing token / user not synced yet.
        if (error instanceof HttpError && (error.status === 401 || error.status === 403)) {
          setCanUseNeon(false)
          return
        }
        console.error('Error syncing favorites source:', error)
        setCanUseNeon(false)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void syncSourceAndLoad()
    return () => {
      cancelled = true
    }
  }, [user?.uid]) // eslint-disable-line react-hooks/exhaustive-deps

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

      if (!user || !canUseNeon) {
        setFavorites((prev) => {
          if (prev.includes(key)) return prev.filter((k) => k !== key)
          return [...prev, key]
        })
        return
      }

      // Logged-in toggle (Neon) with optimistic UI.
      let removed = false
      setFavorites((prev) => {
        const has = prev.includes(key)
        removed = has
        return has ? prev.filter((k) => k !== key) : [...prev, key]
      })

      try {
        const token = await user.getIdToken()
        if (!token) {
          throw new Error('Failed to get authentication token. Please try logging in again.')
        }

        // Idempotent request: avoid "double toggle" bugs by telling the server the desired state.
        const desiredIsActive = !removed
        const data = await fetchJson<{ favoriteKey: string; isActive: boolean }>('/api/favorites/toggle', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ favoriteKey: key, isActive: desiredIsActive })
        })

        setFavorites((prev) => {
          const has = prev.includes(data.favoriteKey)
          if (data.isActive) return has ? prev : [...prev, data.favoriteKey]
          return has ? prev.filter((k) => k !== data.favoriteKey) : prev
        })
      } catch (error) {
        if (error instanceof HttpError && error.status === 404) {
          // Neon user doesn't exist -> fall back to local-only mode and keep the optimistic toggle.
          setCanUseNeon(false)
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
    [user, canUseNeon]
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

  const value: FavoritesHook = {
    favorites,
    isFavorite,
    addToFavorites,
    removeFromFavorites,
    toggleFavorite,
    loading
  }

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>
}

export function useFavoritesContext(): FavoritesHook {
  const ctx = useContext(FavoritesContext)
  if (!ctx) throw new Error('useFavorites must be used within a FavoritesProvider')
  return ctx
}


