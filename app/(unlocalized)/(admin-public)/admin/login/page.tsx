'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'
import TurnstileScript from '@/app/components/TurnstileScript'
import { resolveRedirect } from '@/lib/safe-redirect'
import { ADMIN_LOGIN_ERROR_CODES } from '@/lib/admin-session'
import { adminTheme } from '@/app/(unlocalized)/admin/_components/adminTheme'
import HideStorefrontWidgets from '@/app/(unlocalized)/admin/_components/HideStorefrontWidgets'

/**
 * Admin login.
 *
 * The password is checked HERE, in the browser, by signInWithEmailAndPassword.
 * That is deliberate and was learned the hard way: the Firebase Web API keys
 * are HTTP-referrer restricted, so the same call from a Vercel function gets
 * 403 "Requests from referer <empty> are blocked". A browser sends a valid
 * referrer; a server does not.
 *
 * The resulting ID token is then exchanged at POST /api/admin/login, together
 * with a Turnstile token, for the httpOnly session cookie that actually gates
 * /admin and the admin APIs. No Turnstile, no cookie, no admin access — so
 * Turnstile is strictly enforced for admin entry even though the password
 * itself is verified client-side.
 *
 * The client Firebase session is not optional either: admin pages write to
 * Firestore through the client SDK and firestore.rules gates those writes on
 * the `admin` claim.
 *
 * Lives in the (admin-public) route group so it resolves to /admin/login
 * without sitting under app/(unlocalized)/admin/layout.tsx, which redirects
 * anyone without a valid session.
 */

const TURNSTILE_CONTAINER_ID = '#cf-turnstile-admin-login'

/** Localhost only; mirrors isTurnstileBypassEnabled() on the server. */
function useIsLocalhost() {
  const [isLocalhost, setIsLocalhost] = useState(false)
  useEffect(() => {
    const host = window.location.hostname
    setIsLocalhost(host === 'localhost' || host === '127.0.0.1')
  }, [])
  return isLocalhost
}

function AdminLoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [turnstileToken, setTurnstileToken] = useState('')
  const [isMounted, setIsMounted] = useState(false)

  const turnstileWidgetIdRef = useRef<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const isLocalhost = useIsLocalhost()

  useEffect(() => setIsMounted(true), [])

  // Explicit-render Turnstile lifecycle. Mirrors the storefront signin page:
  // the script is loaded with strategy="lazyOnload", so window.turnstile may
  // not exist yet on first run and the render is retried.
  useEffect(() => {
    if (!isMounted || isLocalhost) return

    const sitekey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
    if (typeof sitekey !== 'string' || !sitekey) {
      console.error('[Turnstile] Missing NEXT_PUBLIC_TURNSTILE_SITE_KEY — widget cannot render')
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
          // Pinned server-side too, so a token minted by the contact-form
          // widget cannot be replayed against this route.
          action: 'admin-login',
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
   * Turnstile tokens are single-use. Without a reset after a failed attempt
   * the next submit comes back `timeout-or-duplicate`, which presents as "the
   * password is still wrong" and is extremely confusing to debug.
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

  const messageForCode = (code: string | undefined, fallback: string) => {
    switch (code) {
      case ADMIN_LOGIN_ERROR_CODES.TURNSTILE_FAILED:
        return 'Security verification failed. Please try again.'
      case ADMIN_LOGIN_ERROR_CODES.TOO_MANY_ATTEMPTS:
        return 'Too many failed attempts. Please try again later.'
      case ADMIN_LOGIN_ERROR_CODES.UPSTREAM_THROTTLED:
        return 'Sign-in is temporarily rate limited. Please try again in a few minutes.'
      case ADMIN_LOGIN_ERROR_CODES.ACCOUNT_DISABLED:
        return 'This account has been disabled.'
      case ADMIN_LOGIN_ERROR_CODES.INVALID_CREDENTIALS:
        return 'Invalid email or password.'
      default:
        return fallback
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // 1. Password check in the browser, where the API key's referrer
      //    restriction is satisfied.
      const credential = await signInWithEmailAndPassword(auth, email, password)
      const idToken = await credential.user.getIdToken()

      // 2. Exchange it, with Turnstile, for the admin session cookie.
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, turnstileToken }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        // Do not leave a half-authenticated browser session behind: the
        // password was right but this user has no admin access, or Turnstile
        // failed. Either way they are not signed in to the admin.
        await signOut(auth).catch(() => {})
        resetTurnstile()
        setError(messageForCode(data?.code, 'Login failed. Please check your credentials.'))
        return
      }

      // The admin claim must be on the ID token before the first Firestore
      // write, or every write fails with PERMISSION_DENIED. This refresh is
      // load-bearing here, not defensive: the token above was minted by
      // signInWithEmailAndPassword BEFORE the route had a chance to set the
      // claim, so on the first login after a claim grant it genuinely is
      // missing and only a forced refresh picks it up.
      let result = await auth.currentUser!.getIdTokenResult()
      if (result.claims.admin !== true) {
        await auth.currentUser!.getIdToken(true)
        result = await auth.currentUser!.getIdTokenResult()
      }
      if (result.claims.admin !== true) {
        setError('Signed in, but admin permissions could not be confirmed. Please try again.')
        return
      }

      router.replace(resolveRedirect(searchParams, '/admin', 'from'))
    } catch (err) {
      console.error('Login error:', err)
      await signOut(auth).catch(() => {})
      resetTurnstile()
      const code = (err as { code?: string })?.code
      switch (code) {
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
          setError('Invalid email or password.')
          break
        case 'auth/invalid-email':
          setError('Invalid email address.')
          break
        case 'auth/user-disabled':
          setError('This account has been disabled.')
          break
        case 'auth/too-many-requests':
          setError('Too many failed attempts. Please try again later.')
          break
        case 'auth/network-request-failed':
          setError('Network error. Please check your connection and try again.')
          break
        default:
          setError('Login failed. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const submitDisabled = loading || (!isLocalhost && !turnstileToken)

  return (
    <div className={`min-h-screen ${adminTheme.pageBg} flex flex-col justify-center py-12 sm:px-6 lg:px-8`}>
      <TurnstileScript />

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-widest text-black">SAKO OR</h1>
          <h2 className="mt-6 text-2xl font-bold text-black">Admin Login</h2>
          <p className={`mt-2 text-sm ${adminTheme.subtitle}`}>
            Sign in to access the admin dashboard
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className={`${adminTheme.card} py-8 px-4 sm:px-10`}>
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-black">
                Email address
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={adminTheme.input}
                  placeholder="Enter your email"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-black">
                Password
              </label>
              <div className="mt-1 relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${adminTheme.input} pr-10`}
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeSlashIcon className="h-5 w-5 text-[#B2A28E]" />
                  ) : (
                    <EyeIcon className="h-5 w-5 text-[#B2A28E]" />
                  )}
                </button>
              </div>
            </div>

            {isMounted && !isLocalhost && (
              <div id="cf-turnstile-admin-login" data-testid="admin-login-turnstile" />
            )}

            <div>
              <button
                type="submit"
                disabled={submitDisabled}
                className={adminTheme.buttonPrimaryFull}
              >
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#B2A28E]/50" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-[#95816C]">Security Notice</span>
              </div>
            </div>
            <div className="mt-4 text-xs text-[#95816C] text-center">
              <p>This is a secure admin area. All login attempts are logged.</p>
              <p>Contact your system administrator if you need access.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AdminLoginPage() {
  return (
    <>
      <HideStorefrontWidgets />
      {/* useSearchParams() needs a Suspense boundary to avoid opting the whole
          route into client-side rendering at build time. */}
      <Suspense fallback={null}>
        <AdminLoginForm />
      </Suspense>
    </>
  )
}
