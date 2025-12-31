'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
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
    const err = await res.json().catch(() => ({}))
    const msg = typeof err?.error === 'string' ? err.error : `HTTP ${res.status}`
    throw new HttpError(msg, res.status)
  }
  return (await res.json()) as T
}

export function useFavorites(): FavoritesHook {
  const { user } = useAuth()
  const [favorites, setFavorites] = useState<string[]>([])
  const [canUseNeon, setCanUseNeon] = useState(false)
  const [loading, setLoading] = useState(true)
  const lastBroadcastRef = useRef<string>('')

  // Load favorites from localStorage on mount (guest buffer / initial hydration)
  useEffect(() => {
    try {
      const storedFavorites = localStorage.getItem(STORAGE_KEY)
      if (storedFavorites) {
        setFavorites(JSON.parse(storedFavorites))
      }
    } catch (error) {
      console.error('Error loading favorites:', error)
    }
  }, [])

  // Save favorites to localStorage whenever we're in local-only mode
  useEffect(() => {
    if (!loading && (!user || !canUseNeon)) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites))
      } catch (error) {
        console.error('Error saving favorites:', error)
      }
    }
  }, [favorites, loading, user, canUseNeon])

  // Broadcast favorites changes to sync multiple hook instances (nav/product cards/etc)
  useEffect(() => {
    if (loading) return
    try {
      const payload = JSON.stringify(favorites)
      if (payload === lastBroadcastRef.current) return
      lastBroadcastRef.current = payload
      window.dispatchEvent(new CustomEvent('favoritesUpdated', { detail: favorites }))
    } catch (error) {
      console.error('Error broadcasting favorites:', error)
    }
  }, [favorites, loading])

  // Listen for favorites updates from other components
  useEffect(() => {
    const handleFavoritesUpdate = (event: CustomEvent) => {
      setFavorites(event.detail)
    }

    window.addEventListener('favoritesUpdated', handleFavoritesUpdate as EventListener)
    
    return () => {
      window.removeEventListener('favoritesUpdated', handleFavoritesUpdate as EventListener)
    }
  }, [])

  // Decide whether to use Neon (DB) vs local-only, then load/merge accordingly.
  useEffect(() => {
    let cancelled = false

    async function syncSourceAndLoad() {
      if (!user) {
        setCanUseNeon(false)
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        const token = await user.getIdToken(true)
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

        const stored = localStorage.getItem(STORAGE_KEY)
        const guestKeys: string[] = stored ? JSON.parse(stored) : []
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

        const data = await fetchJson<{ favorites: Array<{ favoriteKey: string }> }>(
          '/api/favorites',
          { headers: { Authorization: `Bearer ${token}` } }
        )

        if (!cancelled) {
          setFavorites(data.favorites.map((f) => f.favoriteKey))
        }
      } catch (error) {
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
  }, [user?.uid])

  const isFavorite = useCallback((favoriteKey: string): boolean => {
    return favorites.includes(favoriteKey)
  }, [favorites])

  const toggleFavorite = useCallback(
    async (favoriteKey: string) => {
      const key = (favoriteKey || '').trim()
      if (!key) return

      if (!user || !canUseNeon) {
        // Local-only toggle
        setFavorites((prev) => {
          if (prev.includes(key)) return prev.filter((k) => k !== key)
          return [...prev, key]
        })
        return
      }

      // Logged-in toggle (Neon)
      let removed = false
      setFavorites((prev) => {
        const has = prev.includes(key)
        removed = has
        return has ? prev.filter((k) => k !== key) : [...prev, key]
      })

      try {
        const token = await user.getIdToken(true)
        if (!token) {
          throw new Error('Failed to get authentication token. Please try logging in again.')
        }

        const headers = {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }

        const data = await fetchJson<{ favoriteKey: string; isActive: boolean }>(
          '/api/favorites/toggle',
          {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ favoriteKey: key })
          }
        )
        setFavorites((prev) => {
          const has = prev.includes(data.favoriteKey)
          if (data.isActive) {
            return has ? prev : [...prev, data.favoriteKey]
          }
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

  return {
    favorites,
    isFavorite,
    addToFavorites,
    removeFromFavorites,
    toggleFavorite,
    loading
  }
}
