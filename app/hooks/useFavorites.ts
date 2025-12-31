'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { fbqTrackAddToFavorites, fbqTrackRemoveFromFavorites } from '@/lib/facebookPixel'

export type FavoriteItem = string | { baseSku: string; colorSlug?: string }

export interface FavoritesHook {
  favorites: FavoriteItem[]
  isFavorite: (sku: string) => boolean
  addToFavorites: (sku: string, colorSlug?: string) => void
  removeFromFavorites: (sku: string) => void
  toggleFavorite: (sku: string, colorSlug?: string) => void
  loading: boolean
}

export function useFavorites(): FavoritesHook {
  const [favorites, setFavorites] = useState<FavoriteItem[]>([])
  const [loading, setLoading] = useState(true)
  const favoritesRef = useRef<FavoriteItem[]>([])

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

  // Helper to check if a favorite item matches a sku
  const favoriteMatches = (item: FavoriteItem, sku: string): boolean => {
    if (typeof item === 'string') {
      return item === sku
    }
    return item.baseSku === sku
  }

  // Helper to get baseSku from favorite item
  const getBaseSku = (item: FavoriteItem): string => {
    if (typeof item === 'string') {
      return item
    }
    return item.baseSku
  }

  const isFavorite = useCallback((sku: string): boolean => {
    return favorites.some(item => favoriteMatches(item, sku))
  }, [favorites])

  const addToFavorites = useCallback((sku: string, colorSlug?: string) => {
    // Check ref (current state) before updating to avoid double-tracking
    const isCurrentlyFavorite = favoritesRef.current.some(item => favoriteMatches(item, sku))
    if (!isCurrentlyFavorite) {
      // Track BEFORE state update to ensure it only fires once
      fbqTrackAddToFavorites({ id: sku, quantity: 1 })
    }
    setFavorites(prev => {
      // Check if already exists
      if (prev.some(item => favoriteMatches(item, sku))) {
        return prev
      }
      // Add new favorite with colorSlug if provided
      const newFavorite: FavoriteItem = colorSlug ? { baseSku: sku, colorSlug } : sku
      return [...prev, newFavorite]
    })
  }, [])

  const removeFromFavorites = useCallback((sku: string) => {
    setFavorites(prev => prev.filter(item => !favoriteMatches(item, sku)))
  }, [])

  const toggleFavorite = useCallback((sku: string, colorSlug?: string) => {
    // Check ref (current state) before updating to determine action
    const isCurrentlyFavorite = favoritesRef.current.some(item => favoriteMatches(item, sku))
    if (!isCurrentlyFavorite) {
      // Track BEFORE state update to ensure it only fires once
      fbqTrackAddToFavorites({ id: sku, quantity: 1 })
    } else {
      // Track removal BEFORE state update
      fbqTrackRemoveFromFavorites({ id: sku, quantity: 1 })
    }
    setFavorites(prev => {
      if (prev.some(item => favoriteMatches(item, sku))) {
        return prev.filter(item => !favoriteMatches(item, sku))
      } else {
        // Add new favorite with colorSlug if provided
        const newFavorite: FavoriteItem = colorSlug ? { baseSku: sku, colorSlug } : sku
        return [...prev, newFavorite]
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
