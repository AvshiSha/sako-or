'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from 'react'
import { usePathname } from 'next/navigation'

import { AuthContext, type AuthContextType } from '@/app/contexts/auth-context-shared'
import { createGuestAuthValue } from '@/app/contexts/GuestAuthContext'
import { FavoritesProvider } from '@/app/contexts/FavoritesContext'
import AuthTransitionListener from '@/app/components/AuthTransitionListener'
import FacebookPixelInit from '@/app/components/FacebookPixelInit'
import ProfileCompletionGate from '@/app/components/ProfileCompletionGate'

const AUTH_ROUTE_PATTERN =
  /\/(signin|signup|profile|verify-sms|complete-profile|admin)(\/|$)/

type BridgeProps = { onValue: (value: AuthContextType) => void }

/**
 * One auth provider, mounted once, for the life of the document.
 *
 * ## The problem this shape solves
 *
 * This component used to render two different trees at the same position:
 * `GuestAuthProvider` until the Firebase chunk arrived, then
 * `AuthenticatedAppShell`. React reconciles by position *and type*, so swapping
 * them unmounted and remounted everything below - which is to say, every page,
 * roughly 1-3s after every document load.
 *
 * Measured consequences: the favourites skeleton visibly reappeared at +1324ms
 * (1 re-appearance normally, 0 with the upgrade suppressed - that A/B is what
 * identified this), all page state was discarded, and a guest part-way through
 * the checkout form would have lost it.
 *
 * React only unmounts a subtree when the chain of ancestors above it changes
 * type. Siblings are free to come and go. So the chain down to `children` below
 * is fixed, and the Firebase chunk mounts beside it as a null-rendering sibling
 * that publishes its value upward. Nothing above `children` ever changes type,
 * so `children` never unmounts.
 *
 * ## What is NOT changed
 *
 * When Firebase loads. The three triggers below - auth routes, auth-intent
 * clicks, and the idle upgrade - are exactly as they were. That is the point: a
 * returning customer's session is restored by the same code on the same schedule,
 * so there is no cold-start window, no migration, and no hint to get wrong.
 * `AuthContext.tsx` is untouched, and `onAuthStateChanged` remains the only
 * authority on whether anyone is signed in.
 *
 * The remaining cost is bandwidth, not correctness: a guest still downloads the
 * auth chunk on idle. Declining to load it for guests is a separate, optional
 * change, and now a safe one to consider - with this shape it can no longer
 * remount anything.
 */
export default function ClientAuthProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [Bridge, setBridge] = useState<ComponentType<BridgeProps> | null>(null)
  const [firebaseValue, setFirebaseValue] = useState<AuthContextType | null>(null)
  const loadRequestedRef = useRef(false)

  const ensureAuth = useCallback(() => {
    if (loadRequestedRef.current) return
    loadRequestedRef.current = true
    void import('@/app/components/FirebaseAuthBridge').then((mod) => {
      setBridge(() => mod.default)
    })
  }, [])

  /**
   * Stable by construction, so AuthValueRelay's effect depends only on the auth
   * value itself. An unstable callback here would republish on every render of
   * this component and feed back into it.
   */
  const publishFirebaseValue = useCallback((value: AuthContextType) => {
    setFirebaseValue(value)
  }, [])

  useEffect(() => {
    if (AUTH_ROUTE_PATTERN.test(pathname || '')) {
      ensureAuth()
    }
  }, [pathname, ensureAuth])

  useEffect(() => {
    if (Bridge) return

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
  }, [Bridge, ensureAuth])

  const guestValue = useMemo(() => createGuestAuthValue(ensureAuth), [ensureAuth])

  /**
   * Memoised so that `setFirebaseValue` below cannot re-render the bridge.
   *
   * Without this, publishing a value re-renders this component, which recreates
   * the bridge element, which re-renders `AuthProvider`, which builds a fresh
   * context object (it uses a plain literal, not `useMemo`), which the relay
   * then publishes again - an unbroken render loop that kept React from ever
   * going idle. Every client-side navigation in the storefront stalled as a
   * result: the router fetched the new route's RSC payload and never committed
   * it. `FirebaseAuthBridge` carries the full account and the matching guard on
   * its own side.
   *
   * A stable element identity lets React bail out of re-rendering that subtree
   * entirely, so the publish terminates here.
   */
  const bridge = useMemo(
    () => (Bridge ? <Bridge onValue={publishFirebaseValue} /> : null),
    [Bridge, publishFirebaseValue]
  )

  /**
   * The guest shape until the bridge publishes, then Firebase's own value -
   * including its initial `loading: true`, so consumers observe the same
   * sequence they did when the shell was swapped in.
   */
  const value = firebaseValue ?? guestValue

  return (
    <AuthContext.Provider value={value}>
      {/* Siblings of `children`: mounting or unmounting either of these cannot
          disturb the page. The bridge renders null and only publishes a value. */}
      {bridge}
      <FacebookPixelInit />

      {/* The fixed chain. Every one of these is mounted from the first render and
          never replaced, which is what keeps `children` alive across the chunk's
          arrival. All three are inert for a guest: AuthTransitionListener only
          records a baseline uid, ProfileCompletionGate returns its children
          untouched when there is no user, and FavoritesProvider's guest mode is
          already its default. */}
      <AuthTransitionListener>
        <ProfileCompletionGate>
          <FavoritesProvider>{children}</FavoritesProvider>
        </ProfileCompletionGate>
      </AuthTransitionListener>
    </AuthContext.Provider>
  )
}
