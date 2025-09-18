'use client'

import { useState, useEffect, useCallback } from 'react'

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
    setFavorites(prev => {
      if (!prev.includes(sku)) {
        return [...prev, sku]
      }
      return prev
    })
  }, [])

  const removeFromFavorites = useCallback((sku: string) => {
    setFavorites(prev => prev.filter(favSku => favSku !== sku))
  }, [])

  const toggleFavorite = useCallback((sku: string) => {
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
