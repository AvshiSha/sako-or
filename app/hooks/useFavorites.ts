'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { fbqTrackAddToFavorites } from '@/lib/facebookPixel'

export interface FavoritesHook {
  favorites: string[]
  isFavorite: (sku: string) => boolean
  addToFavorites: (sku: string) => void
  removeFromFavorites: (sku: string) => void
  toggleFavorite: (sku: string) => void
  loading: boolean
}

export function useFavorites(): FavoritesHook {
  const [favorites, setFavorites] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const favoritesRef = useRef<string[]>([])

  // Load favorites from localStorage on mount
  useEffect(() => {
    try {
      const storedFavorites = localStorage.getItem('favorites')
      if (storedFavorites) {
        setFavorites(JSON.parse(storedFavorites))
      }
    } catch (error) {
      console.error('Error loading favorites:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  // Keep ref in sync with state
  useEffect(() => {
    favoritesRef.current = favorites
  }, [favorites])

  // Save favorites to localStorage whenever favorites change
  useEffect(() => {
    if (!loading) {
      try {
        localStorage.setItem('favorites', JSON.stringify(favorites))
        // Dispatch custom event to notify other components
        window.dispatchEvent(new CustomEvent('favoritesUpdated', { detail: favorites }))
      } catch (error) {
        console.error('Error saving favorites:', error)
      }
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

  const isFavorite = useCallback((sku: string): boolean => {
    return favorites.includes(sku)
  }, [favorites])

  const addToFavorites = useCallback((sku: string) => {
    // Check ref (current state) before updating to avoid double-tracking
    const isCurrentlyFavorite = favoritesRef.current.includes(sku)
    if (!isCurrentlyFavorite) {
      // Track BEFORE state update to ensure it only fires once
      fbqTrackAddToFavorites({ id: sku, quantity: 1 })
    }
    setFavorites(prev => {
      if (prev.includes(sku)) {
        return prev
      }
      return [...prev, sku]
    })
  }, [])

  const removeFromFavorites = useCallback((sku: string) => {
    setFavorites(prev => prev.filter(favSku => favSku !== sku))
  }, [])

  const toggleFavorite = useCallback((sku: string) => {
    // Check ref (current state) before updating to determine action
    const isCurrentlyFavorite = favoritesRef.current.includes(sku)
    if (!isCurrentlyFavorite) {
      // Track BEFORE state update to ensure it only fires once
      fbqTrackAddToFavorites({ id: sku, quantity: 1 })
    }
    setFavorites(prev => {
      if (prev.includes(sku)) {
        return prev.filter(favSku => favSku !== sku)
      } else {
        return [...prev, sku]
      }
    })
  }, [])

  return {
    favorites,
    isFavorite,
    addToFavorites,
    removeFromFavorites,
    toggleFavorite,
    loading
  }
}
