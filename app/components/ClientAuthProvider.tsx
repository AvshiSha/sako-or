'use client'

import { useCallback, useEffect, useRef, useState, type ComponentType } from 'react'
import { usePathname } from 'next/navigation'
import { GuestAuthProvider } from '@/app/contexts/GuestAuthContext'
import { FavoritesProvider } from '@/app/contexts/FavoritesContext'

const AUTH_ROUTE_PATTERN =
  /\/(signin|signup|profile|verify-sms|complete-profile|admin)(\/|$)/

type AuthShellProps = { children: React.ReactNode }

export default function ClientAuthProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [AuthShell, setAuthShell] = useState<ComponentType<AuthShellProps> | null>(
    null
  )
  const loadRequestedRef = useRef(false)

  const ensureAuth = useCallback(() => {
    if (loadRequestedRef.current) return
    loadRequestedRef.current = true
    void import('@/app/components/AuthenticatedAppShell').then((mod) => {
      setAuthShell(() => mod.default)
    })
  }, [])

  useEffect(() => {
    if (AUTH_ROUTE_PATTERN.test(pathname || '')) {
      ensureAuth()
    }
  }, [pathname, ensureAuth])

  useEffect(() => {
    if (AuthShell) return

    const onAuthInteraction = (event: MouseEvent) => {
      const target = event.target as Element | null
      if (
        target?.closest?.(
          'a[href*="/signin"], a[href*="/signup"], a[href*="/profile"], button[data-auth-trigger]'
        )
      ) {
        ensureAuth()
      }
    }

    document.addEventListener('click', onAuthInteraction, true)

    let idleId: number | undefined
    let timeoutId: ReturnType<typeof setTimeout> | undefined

    const schedule = () => ensureAuth()

    if (typeof window.requestIdleCallback === 'function') {
      idleId = window.requestIdleCallback(schedule, { timeout: 3000 })
    } else {
      timeoutId = setTimeout(schedule, 2000)
    }

    return () => {
      document.removeEventListener('click', onAuthInteraction, true)
      if (idleId !== undefined && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleId)
      }
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId)
      }
    }
  }, [AuthShell, ensureAuth])

  if (!AuthShell) {
    return (
      <GuestAuthProvider onEnsureAuth={ensureAuth}>
        <FavoritesProvider>{children}</FavoritesProvider>
      </GuestAuthProvider>
    )
  }

  return <AuthShell>{children}</AuthShell>
}
