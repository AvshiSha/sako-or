'use client'

import { AuthProvider } from '@/app/contexts/AuthContext'
import { FavoritesProvider } from '@/app/contexts/FavoritesContext'
import ProfileCompletionGate from '@/app/components/ProfileCompletionGate'

export default function ClientAuthProvider({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthProvider>
      <ProfileCompletionGate>
        <FavoritesProvider>{children}</FavoritesProvider>
      </ProfileCompletionGate>
    </AuthProvider>
  )
}
