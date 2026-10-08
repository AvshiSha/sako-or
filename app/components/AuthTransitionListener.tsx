'use client'

import { useEffect, useRef } from 'react'

import { useAuth } from '@/app/hooks/useAuth'
import { resetOnLogout } from '@/lib/guestReset'

/**
 * Clears guest state when a signed-in session ends.
 *
 * Lifted out of AuthenticatedAppShell unchanged. It now sits in the always-mounted
 * chain in ClientAuthProvider rather than inside the deferred auth chunk, which
 * makes it strictly more reliable: it previously could not observe a transition
 * that happened before the chunk loaded. With a guest it is inert - the first
 * value it sees is `user: null`, which only records the baseline.
 */
export default function AuthTransitionListener({ children }: { children: React.ReactNode }) {
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
