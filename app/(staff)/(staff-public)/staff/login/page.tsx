'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signInWithEmailAndPassword, signOut } from 'firebase/auth'

import { auth } from '@/lib/firebase'
import TurnstileScript from '@/app/components/TurnstileScript'
import { resolveRedirect } from '@/lib/safe-redirect'
import { STAFF_LOGIN_ERROR_CODES } from '@/lib/staff-session'
import { staffText } from '@/lib/staff/messages'
import { staffTheme } from '../../../_components/staffTheme'
import StaffChrome from '../../../_components/StaffChrome'

/**
 * Staff sign-in for the shared warehouse device.
 *
 * Same two-step flow as the admin login, for the same hard-won reason: the
 * password is verified HERE, in the browser, because this project's Firebase
 * Web API keys are HTTP-referrer restricted and the identical call from a
 * Vercel function returns `403 Requests from referer <empty> are blocked`. The
 * resulting ID token is then exchanged at `POST /api/staff/login`, with a
 * Turnstile token, for the httpOnly session cookie that actually gates
 * `/staff` and the staff API. See docs/admin-security-hardening.md.
 *
 * ## One deliberate difference from the admin login
 *
 * The admin login keeps the browser Firebase session alive and force-refreshes
 * the ID token, because admin pages write to Firestore through the client SDK
 * and `firestore.rules` gates those writes on the `admin` claim. This screen
 * writes nothing from the browser -- every read and write goes through the
 * staff API with the session cookie -- so the client session is signed out as
 * soon as the cookie is minted. On a device that passes between people, leaving
 * a live Firebase session in local storage would be an avoidable loose end.
 *
 * Lives in the `(staff-public)` group so it resolves to `/staff/login` without
 * sitting under the gate in `app/(staff)/staff/layout.tsx`, while still
 * rendering inside the `(staff)` root layout -- which is what makes the login
 * screen right-to-left like the rest of the surface.
 */

const TURNSTILE_CONTAINER_ID = '#cf-turnstile-staff-login'

/** Localhost only; mirrors `isTurnstileBypassEnabled()` on the server. */
function useIsLocalhost() {
  const [isLocalhost, setIsLocalhost] = useState(false)
  useEffect(() => {
    const host = window.location.hostname
    setIsLocalhost(host === 'localhost' || host === '127.0.0.1')
  }, [])
  return isLocalhost
}

function StaffLoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [turnstileToken, setTurnstileToken] = useState('')
  const [isMounted, setIsMounted] = useState(false)

  const turnstileWidgetIdRef = useRef<string | null>(null)
  const inFlight = useRef(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const isLocalhost = useIsLocalhost()

  useEffect(() => setIsMounted(true), [])

  // Explicit-render Turnstile lifecycle, same as the admin login: the script is
  // loaded lazily, so `window.turnstile` may not exist on the first run and the
  // render is retried.
  useEffect(() => {
    if (!isMounted || isLocalhost) return

    const sitekey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
    if (typeof sitekey !== 'string' || !sitekey) {
      console.error('[Turnstile] Missing NEXT_PUBLIC_TURNSTILE_SITE_KEY - widget cannot render')
      return
    }

    let retryTimer: ReturnType<typeof setTimeout> | undefined

    const renderTurnstile = () => {
      const container = document.querySelector(TURNSTILE_CONTAINER_ID)
      if (!container) return

      const turnstile = (window as any).turnstile
      if (!turnstile) {
        retryTimer = setTimeout(renderTurnstile, 500)
        return
      }
      if (turnstileWidgetIdRef.current != null) return

      try {
        const widgetId = turnstile.render(TURNSTILE_CONTAINER_ID, {
          sitekey,
          theme: 'light',
          size: 'normal',
          // Pinned server-side too, so a token minted by another widget on the
          // site cannot be replayed against this route.
          action: 'staff-login',
          callback: (token: string) => {
            if (turnstileWidgetIdRef.current !== widgetId) return
            setTurnstileToken(token)
          },
          'error-callback': () => {
            console.error('[Turnstile] verification failed')
            if (turnstileWidgetIdRef.current !== widgetId) return
            setTurnstileToken('')
          },
          'expired-callback': () => {
            if (turnstileWidgetIdRef.current !== widgetId) return
            setTurnstileToken('')
          },
        })
        turnstileWidgetIdRef.current = widgetId
      } catch (err) {
        console.error('[Turnstile] render failed', err)
      }
    }

    renderTurnstile()

    return () => {
      if (retryTimer) clearTimeout(retryTimer)
      const turnstile = (window as any).turnstile
      if (turnstile && turnstileWidgetIdRef.current != null) {
        try {
          turnstile.remove(turnstileWidgetIdRef.current)
        } catch {
          // Widget already gone.
        }
      }
      turnstileWidgetIdRef.current = null
    }
  }, [isMounted, isLocalhost])

  /**
   * Turnstile tokens are single-use. Without a reset after a failed attempt the
   * next submit returns `timeout-or-duplicate`, which looks exactly like "the
   * password is still wrong" and is miserable to debug.
   */
  const resetTurnstile = () => {
    setTurnstileToken('')
    const turnstile = (window as any).turnstile
    if (turnstile && turnstileWidgetIdRef.current != null) {
      try {
        turnstile.reset(turnstileWidgetIdRef.current)
      } catch {
        // Nothing to reset.
      }
    }
  }

  const messageForCode = (code: string | undefined) => {
    switch (code) {
      case STAFF_LOGIN_ERROR_CODES.TURNSTILE_FAILED:
        return staffText.loginTurnstile
      case STAFF_LOGIN_ERROR_CODES.TOO_MANY_ATTEMPTS:
        return staffText.loginThrottled
      case STAFF_LOGIN_ERROR_CODES.NO_STAFF_ACCESS:
        return staffText.loginNoAccess
      case STAFF_LOGIN_ERROR_CODES.ACCOUNT_DISABLED:
        return staffText.loginDisabled
      case STAFF_LOGIN_ERROR_CODES.INVALID_CREDENTIALS:
        return staffText.loginInvalid
      default:
        return staffText.loginGeneric
    }
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (inFlight.current) return
    inFlight.current = true
    setLoading(true)
    setError('')

    try {
      // 1 - password check in the browser, where the referrer restriction on
      //     the API key is satisfied.
      const credential = await signInWithEmailAndPassword(auth, email, password)
      const idToken = await credential.user.getIdToken()

      // 2 - exchange it, with Turnstile, for the staff session cookie.
      const response = await fetch('/api/staff/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, turnstileToken }),
      })
      const data = await response.json().catch(() => ({}))

      // Either way the browser Firebase session has done its job. Clearing it
      // does not touch the httpOnly cookie, which is the real credential.
      await signOut(auth).catch(() => {})

      if (!response.ok) {
        resetTurnstile()
        setError(messageForCode(data?.code))
        return
      }

      router.replace(resolveRedirect(searchParams, '/staff/stock', 'from'))
    } catch (err) {
      console.error('[STAFF_LOGIN] sign-in failed:', err)
      await signOut(auth).catch(() => {})
      resetTurnstile()

      const code = (err as { code?: string })?.code
      switch (code) {
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
        case 'auth/invalid-email':
          setError(staffText.loginInvalid)
          break
        case 'auth/user-disabled':
          setError(staffText.loginDisabled)
          break
        case 'auth/too-many-requests':
          setError(staffText.loginThrottled)
          break
        case 'auth/network-request-failed':
          setError(staffText.stockUnavailable)
          break
        default:
          setError(staffText.loginGeneric)
      }
    } finally {
      setLoading(false)
      inFlight.current = false
    }
  }

  const submitDisabled = loading || (!isLocalhost && !turnstileToken)

  return (
    <div className={`${staffTheme.pageBg} flex min-h-dvh flex-col justify-center py-10`}>
      <TurnstileScript />
      <StaffChrome />

      <div className="mx-auto w-full max-w-[420px] px-4">
        <div className="text-center">
          <p className="text-[26px] font-black tracking-[0.2em]">SAKO OR</p>
          <h1 className="mt-5 text-[22px] font-black">{staffText.loginTitle}</h1>
          <p className={`mt-1 ${staffTheme.meta}`}>{staffText.loginSubtitle}</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
          <div>
            <label htmlFor="staff-email" className={staffTheme.label}>
              {staffText.loginEmail}
            </label>
            <input
              id="staff-email"
              type="email"
              inputMode="email"
              autoComplete="username"
              required
              dir="ltr"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={staffTheme.input}
              data-testid="staff-login-email"
            />
          </div>

          <div>
            <label htmlFor="staff-password" className={staffTheme.label}>
              {staffText.loginPassword}
            </label>
            <input
              id="staff-password"
              type="password"
              autoComplete="current-password"
              required
              dir="ltr"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={staffTheme.input}
              data-testid="staff-login-password"
            />
          </div>

          {!isLocalhost && <div id="cf-turnstile-staff-login" className="flex justify-center" />}

          {error && (
            <p
              className={`${staffTheme.notice} ${staffTheme.noticeError}`}
              role="alert"
              data-testid="staff-login-error"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitDisabled}
            className={staffTheme.buttonPrimary}
            data-testid="staff-login-submit"
          >
            {loading ? staffText.loginWorking : staffText.loginSubmit}
          </button>
        </form>
      </div>
    </div>
  )
}

/**
 * `useSearchParams` needs a Suspense boundary. The fallback is the same shell
 * so the screen does not jump when the params resolve.
 */
export default function StaffLoginPage() {
  return (
    <Suspense
      fallback={
        <div className={`${staffTheme.pageBg} flex min-h-dvh items-center justify-center`}>
          <p className={staffTheme.meta}>{staffText.loginTitle}</p>
        </div>
      }
    >
      <StaffLoginForm />
    </Suspense>
  )
}
