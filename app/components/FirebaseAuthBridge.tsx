'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'

import { AuthProvider } from '@/app/contexts/AuthContext'
import { useAuth } from '@/app/hooks/useAuth'
import FacebookPixelAdvancedMatching from '@/app/components/FacebookPixel'
import type { AuthContextType } from '@/app/contexts/auth-context-shared'

/**
 * Firebase auth, loaded on demand and published upward - the whole of the
 * deferred auth chunk, and deliberately nothing that `children` hangs off.
 *
 * ## Why this shape
 *
 * `ClientAuthProvider` used to swap the component at the top of the page's
 * subtree: `GuestAuthProvider` before the chunk arrived, `AuthenticatedAppShell`
 * after. React reconciles by position *and type*, so that swap unmounted and
 * remounted everything beneath it - every page, roughly 1-3s after every document
 * load. `FavoritesProvider` came back with `loading` reset to true (the favourites
 * skeleton visibly flashed at +1324ms), a half-filled checkout form would have
 * been wiped, and all client state on the page was discarded.
 *
 * React only unmounts a subtree when the chain of *ancestors* above it changes.
 * Siblings may come and go freely. So `AuthProvider` does not need to be an
 * ancestor of `children` at all - it only needs to produce a value. This
 * component renders `null` and relays that value up to the provider that is
 * already mounted, so the chunk's arrival is invisible to the page.
 *
 * ## What is deliberately NOT changed
 *
 * `AuthContext.tsx` is untouched. `AuthProvider`, `onAuthStateChanged`, Firebase
 * persistence, token handling, the admin check and profile synchronisation all
 * behave exactly as before, and the chunk still loads on exactly the same
 * triggers. The authentication lifecycle is not part of this change; only the
 * shape of the React tree is. That is what makes it safe for sessions that
 * already exist - there is no new code path for a returning user to fall down.
 *
 * `firebase/auth` is pulled in at module scope by `lib/firebase.ts`, which
 * `AuthContext` imports, so keeping that import behind this dynamic boundary is
 * what keeps Firebase off the critical path. Importing `AuthProvider` directly
 * from `ClientAuthProvider` would undo the deferral.
 *
 * FacebookPixelAdvancedMatching rides along because it mounted with the old
 * authenticated shell and should keep mounting at the same moment. It renders
 * nothing, so it costs the page nothing.
 */

/**
 * Publishes the live auth value to the provider above.
 *
 * Renders null on purpose: it must be a sibling of `children`, never an ancestor.
 *
 * ## Why this republishes on identity, not on every render
 *
 * `AuthContext.tsx` builds its context value as a plain object literal, so every
 * render of `AuthProvider` produces a new identity even when nothing about the
 * session changed. Relaying that object directly deadlocks the app:
 *
 *   effect sees a new `value` -> onValue -> setFirebaseValue one level up ->
 *   ClientAuthProvider re-renders -> it recreates the <Bridge> element ->
 *   AuthProvider re-renders -> new `value` identity -> effect again
 *
 * An unbroken render loop. It does not throw and it does not warn; React simply
 * never goes idle, so nothing else can commit. Observed symptom: every single
 * client-side navigation in the storefront stalled - the router issued the RSC
 * request for the new route and then never applied it, so links appeared dead
 * while the URL stayed put. Found by `probe-nav.js`, which showed product, cart
 * and /about links all STALLED with the RSC request on the wire.
 *
 * Two independent guards, because one is a performance detail and the other is
 * the correctness fix:
 *
 *  1. Here: `published` is memoised on the fields that actually describe the
 *     session, so its identity changes once per real auth change rather than
 *     once per render. The three methods are stable delegates that read
 *     `latest`, so they never contribute identity churn and never go stale.
 *  2. In `ClientAuthProvider`: the <Bridge> element is memoised, so a
 *     `setFirebaseValue` there cannot re-render this subtree at all.
 *
 * Either one alone stops the loop. Both are kept so that a later edit to one
 * cannot silently reintroduce it.
 *
 * `AuthContext.tsx` is deliberately still untouched - wrapping its value in
 * `useMemo` would also work, but that is the file that owns session restoration
 * for existing customers, and this bug does not require touching it.
 */
function AuthValueRelay({ onValue }: { onValue: (value: AuthContextType) => void }) {
  const value = useAuth()

  /**
   * Always the current render's value, so the delegates below cannot close over
   * a stale `signIn`/`logout`.
   */
  const latest = useRef(value)
  latest.current = value

  const signIn = useCallback<AuthContextType['signIn']>(
    (email, password) => latest.current.signIn(email, password),
    []
  )
  const signUp = useCallback<AuthContextType['signUp']>(
    (email, password) => latest.current.signUp(email, password),
    []
  )
  const logout = useCallback<AuthContextType['logout']>(
    () => latest.current.logout(),
    []
  )

  const { user, loading, isAdmin, adminCheckPending, profileSyncedUid } = value

  const published = useMemo<AuthContextType>(
    () => ({
      user,
      loading,
      isAdmin,
      adminCheckPending,
      profileSyncedUid,
      signIn,
      signUp,
      logout,
    }),
    [user, loading, isAdmin, adminCheckPending, profileSyncedUid, signIn, signUp, logout]
  )

  useEffect(() => {
    onValue(published)
  }, [published, onValue])

  return null
}

export default function FirebaseAuthBridge({
  onValue,
}: {
  onValue: (value: AuthContextType) => void
}) {
  return (
    <AuthProvider>
      <FacebookPixelAdvancedMatching />
      <AuthValueRelay onValue={onValue} />
    </AuthProvider>
  )
}
