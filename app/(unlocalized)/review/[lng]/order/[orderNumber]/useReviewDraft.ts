'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Preserves an in-progress review across a detour through signup.
 *
 * The whole point of offering "create an account for 20 points" mid-form is that the
 * customer can take it. If accepting the offer wiped five stars and a paragraph of
 * writing, nobody would take it twice — and we would have made the review harder to
 * leave in the name of a reward, which inverts the priority.
 *
 * `sessionStorage`, not `localStorage`, deliberately:
 *  - it survives the full-page navigation into signup and the Google
 *    `signInWithRedirect` off-origin round trip, which is exactly the gap to cover
 *  - it dies with the tab, so a shared or public device does not keep someone's
 *    half-written review around
 *
 * This mirrors `sessionStorage['pendingSignup']`, the existing and only cross-page
 * state handoff in this app, so the lifetime semantics are already proven here.
 */

/** Bumped if the draft shape changes, so a stale draft is discarded rather than
 *  restored into a form that no longer matches it. */
const DRAFT_VERSION = 1

interface StoredDraft<T> {
  version: number
  savedAt: number
  data: T
}

/** Drafts older than this are ignored — a week-old half-review is noise. */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

function keyFor(orderNumber: string): string {
  return `reviewDraft:${orderNumber}`
}

export function useReviewDraft<T>(orderNumber: string) {
  // Restoration must happen once, synchronously with the first render, or the form
  // would flash empty and any autosave effect would immediately overwrite the draft
  // with the blank initial state.
  const [restored, setRestored] = useState<T | null>(null)
  const [isRestored, setIsRestored] = useState(false)
  const clearedRef = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = window.sessionStorage.getItem(keyFor(orderNumber))
      if (raw) {
        const parsed = JSON.parse(raw) as StoredDraft<T>
        const fresh = Date.now() - parsed.savedAt < MAX_AGE_MS
        if (parsed.version === DRAFT_VERSION && fresh) {
          setRestored(parsed.data)
        } else {
          window.sessionStorage.removeItem(keyFor(orderNumber))
        }
      }
    } catch {
      // Corrupt or unavailable storage (private mode, quota) must never break the
      // form — the customer simply starts with an empty one.
      try {
        window.sessionStorage.removeItem(keyFor(orderNumber))
      } catch {
        /* nothing more we can do */
      }
    }
    setIsRestored(true)
  }, [orderNumber])

  const save = useCallback(
    (data: T) => {
      if (typeof window === 'undefined' || clearedRef.current) return
      try {
        const payload: StoredDraft<T> = { version: DRAFT_VERSION, savedAt: Date.now(), data }
        window.sessionStorage.setItem(keyFor(orderNumber), JSON.stringify(payload))
      } catch {
        /* storage full or blocked — losing the draft is acceptable, crashing is not */
      }
    },
    [orderNumber]
  )

  const clear = useCallback(() => {
    clearedRef.current = true
    if (typeof window === 'undefined') return
    try {
      window.sessionStorage.removeItem(keyFor(orderNumber))
    } catch {
      /* ignore */
    }
  }, [orderNumber])

  return { restored, isRestored, save, clear }
}

/**
 * Remembers that the customer dismissed the signup offer for this order.
 *
 * Kept separate from the draft so that clearing the draft on submit does not also
 * forget the dismissal — someone who said "continue without an account" should not be
 * asked again on the success screen or on a reload.
 */
export function useSignupOfferDismissal(orderNumber: string) {
  const key = `reviewSignupDismissed:${orderNumber}`
  const [dismissed, setDismissed] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      setDismissed(window.sessionStorage.getItem(key) === '1')
    } catch {
      /* ignore */
    }
    setIsLoaded(true)
  }, [key])

  const dismiss = useCallback(() => {
    setDismissed(true)
    if (typeof window === 'undefined') return
    try {
      window.sessionStorage.setItem(key, '1')
    } catch {
      /* ignore */
    }
  }, [key])

  return { dismissed, isLoaded, dismiss }
}
