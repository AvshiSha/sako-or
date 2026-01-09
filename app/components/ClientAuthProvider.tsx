'use client'

import { useEffect, useRef } from 'react'
import { AuthProvider, useAuth } from '@/app/contexts/AuthContext'
import { FavoritesProvider } from '@/app/contexts/FavoritesContext'
import ProfileCompletionGate from '@/app/components/ProfileCompletionGate'
import { resetOnLogout } from '@/lib/guestReset'

/**
 * Auth transition listener that detects logout and resets guest state.
 */
function AuthTransitionListener({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const previousUidRef = useRef<string | null | undefined>(undefined)

  useEffect(() => {
    const currentUid = user?.uid ?? null
    
    // Skip first render (initialization)
    if (previousUidRef.current === undefined) {
      previousUidRef.current = currentUid
      return
    }

    // Detect logout transition: had a user, now null
    if (previousUidRef.current !== null && currentUid === null) {
      resetOnLogout()
    }

    previousUidRef.current = currentUid
  }, [user?.uid])

  return <>{children}</>
}

export default function ClientAuthProvider({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthProvider>
      <AuthTransitionListener>
        <ProfileCompletionGate>
          <FavoritesProvider>{children}</FavoritesProvider>
        </ProfileCompletionGate>
      </AuthTransitionListener>
    </AuthProvider>
  )
}
