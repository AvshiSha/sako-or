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

async function fetchJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const msg = typeof err?.error === 'string' ? err.error : `HTTP ${res.status}`
    throw new Error(msg)
  }
  return (await res.json()) as T
}

export function useFavorites(): FavoritesHook {
  const { user } = useAuth()
  const [favorites, setFavorites] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const mergedGuestForUidRef = useRef<string | null>(null)
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

  // Save favorites to localStorage whenever favorites change (guest only)
  useEffect(() => {
    if (!loading && !user) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites))
      } catch (error) {
        console.error('Error saving favorites:', error)
      }
    }
  }, [favorites, loading, user])

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

  // Load favorites from Neon when logged in
  useEffect(() => {
    let cancelled = false

    async function loadFromNeon() {
      // #region agent log
      // #endregion
      if (!user) {
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        const token = await user.getIdToken()
        // #region agent log
        // #endregion
        const data = await fetchJson<{
          favorites: Array<{ favoriteKey: string }>
        }>('/api/favorites', {
          headers: { Authorization: `Bearer ${token}` }
        })

        // #region agent log
        // #endregion

        if (!cancelled) {
          setFavorites(data.favorites.map((f) => f.favoriteKey))
        }
      } catch (error) {
        // #region agent log
        // #endregion
        console.error('Error loading favorites from Neon:', error)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadFromNeon()
    return () => {
      cancelled = true
    }
  }, [user?.uid])

  // Merge guest favorites into Neon on first login per uid
  useEffect(() => {
    if (!user) {
      mergedGuestForUidRef.current = null
      return
    }

    if (mergedGuestForUidRef.current === user.uid) return
    mergedGuestForUidRef.current = user.uid
    // Capture non-null user for the async work below (avoids TS thinking `user` can become null mid-flight).
    const currentUser = user

    async function mergeGuestFavorites() {
      try {
        const stored = localStorage.getItem(STORAGE_KEY)
        const guestKeys: string[] = stored ? JSON.parse(stored) : []
        // #region agent log
        // #endregion
        if (!Array.isArray(guestKeys) || guestKeys.length === 0) return

        const token = await currentUser.getIdToken()
        await fetchJson<{ merged: number }>('/api/favorites/merge', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ favoriteKeys: guestKeys })
        })

        // #region agent log
        // #endregion

        localStorage.removeItem(STORAGE_KEY)
      } catch (error) {
        // #region agent log
        // #endregion
        console.error('Error merging guest favorites into Neon:', error)
      }
    }

    void mergeGuestFavorites()
  }, [user?.uid])

  const isFavorite = useCallback((favoriteKey: string): boolean => {
    return favorites.includes(favoriteKey)
  }, [favorites])

  const toggleFavorite = useCallback(
    async (favoriteKey: string) => {
      const key = (favoriteKey || '').trim()
      // #region agent log
      // #endregion
      if (!key) return

      if (!user) {
        // Guest toggle (local buffer)
        setFavorites((prev) => {
          if (prev.includes(key)) return prev.filter((k) => k !== key)
          return [...prev, key]
        })
        return
      }

      // Logged-in toggle (Neon)
      const currentlyFavorite = favorites.includes(key)
      setFavorites((prev) => {
        if (currentlyFavorite) return prev.filter((k) => k !== key)
        return [...prev, key]
      })

      try {
        const token = await user.getIdToken()
        const data = await fetchJson<{ favoriteKey: string; isActive: boolean }>(
          '/api/favorites/toggle',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ favoriteKey: key })
          }
        )

        // #region agent log
        // #endregion

        setFavorites((prev) => {
          const has = prev.includes(data.favoriteKey)
          if (data.isActive) {
            return has ? prev : [...prev, data.favoriteKey]
          }
          return has ? prev.filter((k) => k !== data.favoriteKey) : prev
        })
      } catch (error) {
        // #region agent log
        // #endregion
        console.error('Error toggling favorite in Neon:', error)
        // Revert optimistic update
        setFavorites((prev) => {
          const has = prev.includes(key)
          if (currentlyFavorite) {
            return has ? prev : [...prev, key]
          }
          return has ? prev.filter((k) => k !== key) : prev
        })
      }
    },
    [favorites, user]
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
