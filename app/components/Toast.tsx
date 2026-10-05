'use client'

import Link from 'next/link'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'

export type ToastType = 'success' | 'error' | 'info'

export interface ToastAction {
  label: string
  /** Renders a real <Link> - preferred for navigation so middle-click works. */
  href?: string
  onClick?: () => void
}

export interface ToastOptions {
  duration?: number
  /** Replaces the close button. The moment after add-to-cart is the best place
      to offer the cart, so that case passes { label: 'לעגלה →', href }. */
  action?: ToastAction
}

/* The DESIGN SYSTEM page (438:7176) documents no toast, so this is composed
   from the one construction it does have for "the site is telling you
   something": the Announcement Banner (438:7679) - an ink-900 strip, white
   text, sharp corners, no shadow, no icon.

   Type is carried by a 2px rule on the inline-start edge and never by the fill,
   because the system has no success hue. Its 16 primitives contain no green at
   all; the only semantic accents are accent-sale, accent-error and accent-link.
   A green toast would not be an off-token green, it would be a colour the brand
   does not own. Success therefore reads as the same ink as the CTA the user
   just pressed, which is also why the toast feels like that press continuing. */
const RULE: Record<ToastType, string> = {
  success: 'bg-text-inverse',
  error: 'bg-accent-error',
  info: 'bg-sako-gray-500',
}

const DEFAULT_DURATION = 3000
/** An action link needs reading time; QuickBuyDrawer already chose 5000 by hand. */
const ACTION_DURATION = 6000
/** Must match the exit transition below, or the panel unmounts mid-fade. */
const EXIT_MS = 150
/** Only used before the header has been measured, and on pages that have none. */
const HEADER_FALLBACK = 96
/** --spacing-md, between the header's underside and the panel. */
const HEADER_GAP = 16

interface ToastState {
  id: number
  message: string
  type: ToastType
  duration: number
  action?: ToastAction
  dismissing?: boolean
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType, options?: ToastOptions) => void
  hideToast: () => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

/**
 * One toast region for the whole app, mounted once in RootShell.
 *
 * It replaces a per-component useToast that every call site owned privately.
 * That had two failure modes: ProductColorClient and QuickBuyDrawer can both be
 * mounted at once and portaled their panels to identical fixed coordinates, so
 * two toasts landed exactly on top of each other; and AddToCartModal and
 * NewsletterSubscriptionBlock called showToast without ever rendering a <Toast>,
 * so their messages - including every error path - were silently discarded.
 */
export function ToastProvider({
  children,
  lng = 'he',
}: {
  children: React.ReactNode
  lng?: string
}) {
  const [current, setCurrent] = useState<ToastState | null>(null)
  const nextId = useRef(0)

  const hideToast = useCallback(() => {
    setCurrent(prev => (prev ? { ...prev, dismissing: true } : prev))
  }, [])

  const showToast = useCallback(
    (message: string, type: ToastType = 'success', options?: ToastOptions) => {
      nextId.current += 1
      setCurrent({
        id: nextId.current,
        message,
        type,
        duration:
          options?.duration ?? (options?.action ? ACTION_DURATION : DEFAULT_DURATION),
        action: options?.action,
      })
    },
    []
  )

  const value = useMemo(() => ({ showToast, hideToast }), [showToast, hideToast])

  // Stable, not an inline arrow: the viewport frees the slot on a timer, and an
  // identity that changed on every provider render would restart that timer and
  // stretch the exit for as long as something above kept re-rendering.
  const clearSlot = useCallback(() => setCurrent(null), [])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toast={current} lng={lng} onDismissed={clearSlot} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used inside <ToastProvider> (mounted in RootShell)')
  }
  return ctx
}

function ToastViewport({
  toast,
  lng,
  onDismissed,
}: {
  toast: ToastState | null
  lng: string
  onDismissed: () => void
}) {
  // An explicit phase rather than a bare `shown` flag: with one boolean, the
  // "unmount once the exit has run" effect also fires on the frame a toast
  // arrives, before the enter has been applied, and the panel races itself.
  const [phase, setPhase] = useState<'idle' | 'enter' | 'show' | 'leave'>('idle')
  const [paused, setPaused] = useState(false)
  // Portals cannot be created during SSR, and the region has to exist in the
  // DOM before its contents change or assistive tech will not announce them -
  // hence a region that is always mounted and a panel that is not.
  const [portalReady, setPortalReady] = useState(false)
  useEffect(() => setPortalReady(true), [])
  // Measured, not a fixed top-*. <header> is the nav bar alone - 71px on mobile,
  // 73px on desktop - but its rect sits lower while the promo band above it is
  // still on screen, so the underside to clear ranges from 71px (mobile, pinned)
  // to 115px (mobile, at the top of the page), with desktop landing at 73/99.
  // No single hardcoded offset covers that - and `--nav-bar-h`, which exists for
  // exactly this, is never set by anything and silently falls back to its 73px
  // default. Measuring the header the frame a toast arrives is what the MENU panel
  // should be doing too.
  const [headerBottom, setHeaderBottom] = useState(HEADER_FALLBACK)

  const id = toast?.id ?? null
  const duration = toast?.duration ?? DEFAULT_DURATION
  const dismissing = toast?.dismissing ?? false

  // A new toast takes the slot: start at opacity 0 and let one frame pass so
  // the transition has something to animate from.
  useEffect(() => {
    if (id === null) return
    setPaused(false)
    setPhase('enter')
    const measure = () => {
      const header = document.querySelector('header')
      const bottom = header ? header.getBoundingClientRect().bottom : 0
      setHeaderBottom(Math.max(bottom, 0))
    }
    measure()
    window.addEventListener('resize', measure)
    // Scroll, not just resize. The promo band above the nav is no longer sticky, so
    // the header's underside travels by the band's height (26px desktop / 44px
    // mobile) between the top of the page and the nav pinning. A toast measured
    // once while pinned and left alone would end up behind the band as soon as the
    // visitor scrolled back up.
    window.addEventListener('scroll', measure, { passive: true })
    const raf = requestAnimationFrame(() => setPhase('show'))
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure)
      cancelAnimationFrame(raf)
    }
  }, [id])

  // Auto-dismiss, held while hovered or focused.
  useEffect(() => {
    if (phase !== 'show' || paused) return
    const t = setTimeout(() => setPhase('leave'), duration)
    return () => clearTimeout(t)
  }, [phase, paused, duration, id])

  // hideToast() from a call site.
  useEffect(() => {
    if (dismissing && (phase === 'enter' || phase === 'show')) setPhase('leave')
  }, [dismissing, phase])

  // Free the slot only once the exit transition has actually run.
  useEffect(() => {
    if (phase !== 'leave') return
    const t = setTimeout(() => {
      setPhase('idle')
      onDismissed()
    }, EXIT_MS)
    return () => clearTimeout(t)
  }, [phase, onDismissed])

  if (!portalReady) return null

  const shown = phase === 'show'

  const closeLabel = lng === 'he' ? 'סגירה' : 'Close'

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      style={{ top: headerBottom + HEADER_GAP }}
      className={[
        'pointer-events-none fixed z-[110] flex',
        // One placement rule at both sizes: just under the header, on the end
        // side - which is where the cart icon lives, so the panel appears at
        // the place the item just went. Logical properties, not right-*, so it
        // follows dir rather than pinning itself to the Hebrew nav.
        //
        // Mobile only differs in that 390px leaves no room to be anything but
        // full-bleed inside the 16px gutters, which lands under the cart icon
        // anyway. It was bottom-anchored at first, for thumb reach; measuring
        // killed that - the add-to-cart CTA sits mid-screen (y~400 of 844), so
        // bottom was ~360px from the thumb where the top is ~250px, and the
        // sticky header keeps the cart icon on screen the whole time.
        'inset-x-4 justify-center',
        'sm:inset-x-auto sm:end-6 sm:justify-end',
      ].join(' ')}
    >
      {toast && (
        <div
          key={toast.id}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
          className={[
            'pointer-events-auto flex w-full max-w-[420px] items-stretch gap-4',
            // surface-dark / text-inverse, radius/none, no elevation: on the
            // #f2f2f2 page ground ink-900 separates without a shadow, and the
            // system documents none.
            'bg-surface-dark text-text-inverse rounded-none pe-4',
            'font-ploni text-sm leading-snug',
            'transition duration-200 ease-out motion-reduce:transition-none',
            // Enters downward, out from under the header it is anchored to.
            shown ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0',
          ].join(' ')}
        >
          <span aria-hidden className={`w-0.5 shrink-0 ${RULE[toast.type]}`} />

          <p className="flex-1 py-4">{toast.message}</p>

          {toast.action ? (
            <ToastActionControl action={toast.action} onDone={() => setPhase('leave')} />
          ) : (
            <button
              type="button"
              onClick={() => setPhase('leave')}
              aria-label={closeLabel}
              className="shrink-0 self-center p-2 opacity-60 transition-opacity hover:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-inverse"
            >
              {/* Drawn rather than imported. heroicons' XMarkIcon is a round
                  outline glyph in a system that has no round outline glyphs -
                  same reason the Search icon was swapped off lucide in ed8b45fd. */}
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </button>
          )}
        </div>
      )}
    </div>,
    document.body
  )
}

function ToastActionControl({
  action,
  onDone,
}: {
  action: ToastAction
  onDone: () => void
}) {
  const className =
    'shrink-0 self-center whitespace-nowrap underline decoration-1 underline-offset-4 transition-opacity hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-inverse'

  if (action.href) {
    return (
      <Link href={action.href} onClick={onDone} className={className}>
        {action.label}
      </Link>
    )
  }

  return (
    <button
      type="button"
      onClick={() => {
        action.onClick?.()
        onDone()
      }}
      className={className}
    >
      {action.label}
    </button>
  )
}
