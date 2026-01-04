'use client'

import { AuthProvider } from '@/app/contexts/AuthContext'
import { FavoritesProvider } from '@/app/contexts/FavoritesContext'

export default function ClientAuthProvider({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthProvider>
      <FavoritesProvider>{children}</FavoritesProvider>
    </AuthProvider>
  )
}
