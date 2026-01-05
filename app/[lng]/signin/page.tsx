'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import {
  GoogleAuthProvider,
  getRedirectResult,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  type User
} from 'firebase/auth'
import { auth, authService } from '@/lib/firebase'
import { useAuth } from '@/app/contexts/AuthContext'
import { profileTheme } from '@/app/components/profile/profileTheme'

type SyncResponse = { ok: true; needsProfileCompletion: boolean } | { error: string }

const translations = {
  en: {
    title: 'Sign in',
    subtitle: 'Sign in to your account',
    email: 'Email',
    emailPlaceholder: 'you@example.com',
    password: 'Password',
    passwordPlaceholder: 'Your password',
    forgotPassword: 'Forgot password?',
    signIn: 'Sign in',
    working: 'Working…',
    continueWithGoogle: 'Continue with Google',
    orDivider: 'OR',
    notRegisteredYet: 'Not registered yet?',
    signUp: 'Sign up',
    resetPasswordTitle: 'Reset Password',
    resetPasswordMessage: 'Enter your email address and we\'ll send you a link to reset your password.',
    sendResetLink: 'Send Reset Link',
    resetEmailSent: 'Reset link sent!',
    resetEmailSentMessage: 'If an account exists with this email, you will receive a password reset link shortly. Please check your inbox.',
    cancel: 'Cancel',
    invalidEmail: 'Please enter a valid email address',
    cooldownMessage: 'Please wait {seconds}s before requesting another link'
  },
  he: {
    title: 'התחברות',
    subtitle: 'התחברו לחשבון שלכם',
    email: 'אימייל',
    emailPlaceholder: 'name@example.com',
    password: 'סיסמה',
    passwordPlaceholder: 'הקלידו סיסמה',
    forgotPassword: 'שכחתי סיסמה',
    signIn: 'התחברות',
    working: 'רגע…',
    continueWithGoogle: 'התחברות עם Google',
    orDivider: 'או',
    notRegisteredYet: 'עדיין לא נרשמת?',
    signUp: 'הרשמה',
    resetPasswordTitle: 'איפוס סיסמה',
    resetPasswordMessage: 'הזינו את כתובת האימייל שלכם ונשלח לכם קישור לאיפוס הסיסמה.',
    sendResetLink: 'שליחת קישור איפוס',
    resetEmailSent: 'קישור איפוס נשלח!',
    resetEmailSentMessage: 'אם קיים חשבון עם אימייל זה, תקבלו קישור לאיפוס סיסמה בקרוב. אנא בדקו את תיבת הדואר שלכם.',
    cancel: 'ביטול',
    invalidEmail: 'אנא הזינו כתובת אימייל תקינה',
    cooldownMessage: 'אנא המתינו {seconds} שניות לפני בקשת קישור נוסף'
  }
}

// Persist across remounts to avoid repeated getRedirectResult() checks
let redirectChecked = false

export default function SignInPage() {
  return (
    <Suspense fallback={<SignInLoading />}>
      <SignInClient />
    </Suspense>
  )
}

function SignInLoading() {
  return (
    <div className={profileTheme.pageBg}>
      <div className="mx-auto w-full max-w-md px-4 pt-28 pb-12">
        <div className="flex justify-center">
          <div className="rounded-xl bg-white/90 shadow-[0_10px_30px_rgba(15,23,42,0.08)] ring-1 ring-black/5 backdrop-blur p-8 w-full">
            <div className="flex flex-col items-center">
              <Image
                src="/images/logo/sako-logo.png"
                alt="Sako-Or"
                width={180}
                height={60}
                priority
              />
              <div className="mt-6 h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-[#856D55]" />
              <div className="mt-4 text-sm font-medium text-slate-900">Loading…</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function SignInClient() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const lng = (params?.lng as string) || 'en'
  const t = translations[lng as keyof typeof translations] || translations.en

  const { user: firebaseUser, loading: authLoading } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [gate, setGate] = useState<'idle' | 'checking' | 'redirecting'>('idle')
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [resetEmailSent, setResetEmailSent] = useState(false)
  const [resetCooldown, setResetCooldown] = useState(0)
  const [resetSuccessBanner, setResetSuccessBanner] = useState(false)

  const syncedUidRef = useRef<string | null>(null)

  const canSubmit = useMemo(() => {
    return email.trim().length > 0 && password.length >= 6 && !busy
  }, [email, password, busy])

  // Handle query params (reset success + auto-open forgot password)
  useEffect(() => {
    const reset = searchParams?.get('reset')
    const forgot = searchParams?.get('forgotPassword')
    const emailParam = searchParams?.get('email')

    if (reset === 'success') {
      setResetSuccessBanner(true)
    }

    if (forgot === '1') {
      setShowForgotPassword(true)
      if (emailParam) setEmail(emailParam)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  // Cooldown timer for forgot password
  useEffect(() => {
    if (resetCooldown > 0) {
      const timer = setTimeout(() => setResetCooldown(resetCooldown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [resetCooldown])

  function formatAuthError(e: any, fallback: string) {
    const code = typeof e?.code === 'string' ? e.code : ''
    const msg = typeof e?.message === 'string' ? e.message : ''
    if (code && msg) return `${code}: ${msg}`
    if (code) return code
    if (msg) return msg
    return fallback
  }

  async function postLoginRedirect(user: User) {
    const token = await user.getIdToken()
    const syncRes = await fetch('/api/me/sync', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    })
    const syncJson = (await syncRes.json().catch(() => null)) as SyncResponse | null

    if (!syncRes.ok || !syncJson || 'error' in syncJson) {
      throw new Error((syncJson && 'error' in syncJson && syncJson.error) || `HTTP ${syncRes.status}`)
    }

    setGate('redirecting')
    router.replace(syncJson.needsProfileCompletion ? `/${lng}/signup` : `/${lng}/profile`)
  }

  // Complete Google redirect sign-in (fallback when popups are blocked)
  useEffect(() => {
    if (redirectChecked) return
    redirectChecked = true

    let cancelled = false
    ;(async () => {
      try {
        setError(null)
        const result = await getRedirectResult(auth)
        if (cancelled) return

        if (!result?.user) return
        setBusy(true)
        setGate('checking')
        await postLoginRedirect(result.user)
      } catch (e: any) {
        if (cancelled) return
        const msg = formatAuthError(e, 'Google redirect sign-in failed')
        // Avoid showing an error for the common "no redirect result" case
        if (
          msg.includes('auth/no-auth-event') ||
          msg.includes('auth/argument-error') ||
          msg.toLowerCase().includes('no redirect')
        ) {
          return
        }
        setError(msg)
        setGate('idle')
      } finally {
        if (!cancelled) setBusy(false)
      }
    })()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // If already signed in, route immediately based on profile completion
  useEffect(() => {
    if (authLoading) return
    if (!firebaseUser) return
    if (syncedUidRef.current === firebaseUser.uid) return
    syncedUidRef.current = firebaseUser.uid

    setBusy(true)
    setGate('checking')
    setError(null)
    setEmail(firebaseUser.email || '')

    let cancelled = false
    void (async () => {
      try {
        await postLoginRedirect(firebaseUser)
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || 'Unable to sign in')
          setGate('idle')
        }
      } finally {
        if (!cancelled) setBusy(false)
      }
    })()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firebaseUser, authLoading])

  async function handleGoogleSignIn() {
    setBusy(true)
    setGate('idle')
    setError(null)
    try {
      const provider = new GoogleAuthProvider()
      provider.setCustomParameters({ prompt: 'select_account' })
      try {
        const cred = await signInWithPopup(auth, provider)
        setGate('checking')
        await postLoginRedirect(cred.user)
        return
      } catch (e: any) {
        const code = typeof e?.code === 'string' ? e.code : ''
        if (
          code === 'auth/popup-blocked' ||
          code === 'auth/popup-closed-by-user' ||
          code === 'auth/cancelled-popup-request'
        ) {
          await signInWithRedirect(auth, provider)
          return
        }
        throw e
      }
    } catch (e: any) {
      const code = typeof e?.code === 'string' ? e.code : ''
      if (code === 'auth/account-exists-with-different-credential') {
        setError(
          'An account already exists with the same email but a different sign-in method. Please sign in with Email/Password first.'
        )
      } else {
        setError(formatAuthError(e, 'Google sign in failed'))
      }
      setGate('idle')
    } finally {
      setBusy(false)
    }
  }

  async function handleEmailSignIn(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setBusy(true)
    setGate('idle')
    setError(null)
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password)
      setGate('checking')
      await postLoginRedirect(cred.user)
    } catch (e: any) {
      setError(formatAuthError(e, 'Sign in failed'))
      setGate('idle')
    } finally {
      setBusy(false)
    }
  }

  async function handleForgotPassword() {
    const trimmedEmail = email.trim()
    
    // Basic email validation
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setError(t.invalidEmail)
      return
    }

    // Check cooldown
    if (resetCooldown > 0) {
      setError(t.cooldownMessage.replace('{seconds}', String(resetCooldown)))
      return
    }

    setBusy(true)
    setError(null)
    
    try {
      // Build the reset URL pointing to our reset-password page
      const protocol = typeof window !== 'undefined' ? window.location.protocol : 'https:'
      const host = typeof window !== 'undefined' ? window.location.host : ''
      const continueUrl = `${protocol}//${host}/${lng}/reset-password`

      // Send via our backend so the email can be branded (React Email + Resend),
      // while still using Firebase oobCode to complete the reset in-app.
      await fetch('/api/auth/password-reset', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: trimmedEmail,
          continueUrl,
          lng,
        }),
      })
      
      // Always show success message (don't leak account existence)
      setResetEmailSent(true)
      setResetCooldown(60) // 60 second cooldown
      
      // Hide the forgot password form after 5 seconds
      setTimeout(() => {
        setShowForgotPassword(false)
        setResetEmailSent(false)
      }, 5000)
    } catch (e: any) {
      // Don't reveal if account exists - show generic success message even on error
      // unless it's a critical error (like rate limiting)
      const code = typeof e?.code === 'string' ? e.code : ''
      if (code === 'auth/too-many-requests') {
        setError('Too many requests. Please try again later.')
      } else {
        // For any other error (including user-not-found), show success
        setResetEmailSent(true)
        setResetCooldown(60)
        setTimeout(() => {
          setShowForgotPassword(false)
          setResetEmailSent(false)
        }, 5000)
      }
    } finally {
      setBusy(false)
    }
  }

  if (authLoading || gate === 'checking' || gate === 'redirecting') {
    return (
      <div className={profileTheme.pageBg} dir={lng === 'he' ? 'rtl' : 'ltr'}>
        <div className="mx-auto w-full max-w-md px-4 pt-28 pb-12">
          <div className="flex justify-center">
            <div className="rounded-xl bg-white/90 shadow-[0_10px_30px_rgba(15,23,42,0.08)] ring-1 ring-black/5 backdrop-blur p-8 w-full">
              <div className="flex flex-col items-center">
                <Image
                  src="/images/logo/sako-logo.png"
                  alt="Sako-Or"
                  width={180}
                  height={60}
                  priority
                />
                <div className="mt-6 h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-[#856D55]" />
                <div className="mt-4 text-sm font-medium text-slate-900">{t.working}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={profileTheme.pageBg} dir={lng === 'he' ? 'rtl' : 'ltr'}>
      <div className="mx-auto w-full max-w-md px-4 pt-24 pb-12">
        <div className="flex justify-center">
          <Image
            src="/images/logo/sako-logo.png"
            alt="Sako-Or"
            width={180}
            height={60}
            priority
          />
        </div>

        <h1 className="mt-6 text-center text-2xl font-bold text-slate-900">{t.title}</h1>
        <p className="mt-2 text-center text-sm text-slate-500">{t.subtitle}</p>

        <div className="mt-8 rounded-xl bg-white/90 shadow-[0_10px_30px_rgba(15,23,42,0.08)] ring-1 ring-black/5 backdrop-blur p-6">
          {resetSuccessBanner ? (
            <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              {lng === 'he'
                ? 'הסיסמה עודכנה בהצלחה. עכשיו אפשר להתחבר עם הסיסמה החדשה.'
                : 'Password updated successfully. You can now sign in with your new password.'}
            </div>
          ) : null}
          {error ? (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {showForgotPassword && (
            <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-sm font-semibold text-slate-900 mb-2">{t.resetPasswordTitle}</h3>
              <p className="text-xs text-slate-600 mb-4">{t.resetPasswordMessage}</p>
              
              {resetEmailSent ? (
                <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                  <div className="font-semibold">{t.resetEmailSent}</div>
                  <div className="mt-1 text-xs">{t.resetEmailSentMessage}</div>
                </div>
              ) : (
                <div className="space-y-3">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t.emailPlaceholder}
                    className={profileTheme.input}
                    disabled={busy || resetCooldown > 0}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      disabled={busy || resetCooldown > 0 || !email.trim()}
                      className="flex-1 inline-flex items-center justify-center rounded-md bg-[#856D55]/90 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#856D55] focus:outline-none focus:ring-2 focus:ring-[#856D55] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {busy ? t.working : resetCooldown > 0 ? `${t.sendResetLink} (${resetCooldown}s)` : t.sendResetLink}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowForgotPassword(false)
                        setError(null)
                      }}
                      disabled={busy}
                      className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 disabled:opacity-50"
                    >
                      {t.cancel}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleEmailSignIn} className="space-y-4">
            <div>
              <label className={profileTheme.label}>{t.email}</label>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t.emailPlaceholder}
                className={profileTheme.input}
              />
            </div>

            <div>
              <label className={profileTheme.label}>{t.password}</label>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t.passwordPlaceholder}
                className={profileTheme.input}
              />
              <div className="mt-2 text-xs text-slate-500">
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  disabled={busy}
                  className="text-[#856D55] hover:underline disabled:opacity-50"
                >
                  {t.forgotPassword}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full inline-flex items-center justify-center rounded-md bg-[#856D55]/90 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#856D55] focus:outline-none focus:ring-2 focus:ring-[#856D55] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? t.working : t.signIn}
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-slate-500">{t.orDivider}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={busy}
            className="w-full flex items-center justify-center gap-3 rounded-md border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            {busy ? t.working : t.continueWithGoogle}
          </button>

          <div className="mt-6 text-center text-sm text-slate-600">
            {t.notRegisteredYet}{' '}
            <Link
              href={`/${lng}/signup`}
              className="font-semibold text-[#856D55] hover:underline"
            >
              {t.signUp}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
