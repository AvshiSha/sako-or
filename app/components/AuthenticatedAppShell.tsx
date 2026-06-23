'use client'

import { useEffect, useRef } from 'react'
import { AuthProvider } from '@/app/contexts/AuthContext'
import { useAuth } from '@/app/hooks/useAuth'
import { FavoritesProvider } from '@/app/contexts/FavoritesContext'
import ProfileCompletionGate from '@/app/components/ProfileCompletionGate'
import { resetOnLogout } from '@/lib/guestReset'

function AuthTransitionListener({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const previousUidRef = useRef<string | null | undefined>(undefined)

  useEffect(() => {
    const currentUid = user?.uid ?? null

    if (previousUidRef.current === undefined) {
      previousUidRef.current = currentUid
      return
    }

    if (previousUidRef.current !== null && currentUid === null) {
      resetOnLogout()
    }

    previousUidRef.current = currentUid
  }, [user?.uid])

  return <>{children}</>
}

/** Loaded dynamically after idle / auth interaction to keep Firebase off the critical path. */
export default function AuthenticatedAppShell({
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
