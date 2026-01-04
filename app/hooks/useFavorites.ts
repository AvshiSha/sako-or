'use client'

import { useFavoritesContext, type FavoritesHook } from '@/app/contexts/FavoritesContext'

export function useFavorites(): FavoritesHook {
  return useFavoritesContext()
}
