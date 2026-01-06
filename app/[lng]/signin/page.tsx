'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Suspense, useEffect, useRef, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import {
  GoogleAuthProvider,
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
  signInWithPhoneNumber,
  RecaptchaVerifier,
  signInWithCustomToken,
  type User,
  type ConfirmationResult
} from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useAuth } from '@/app/contexts/AuthContext'
import { profileTheme } from '@/app/components/profile/profileTheme'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/app/components/ui/tabs'
import { OtpInput } from '@/app/components/ui/otp-input'
import PhoneInput, { type Value as PhoneValue } from 'react-phone-number-input'
import 'react-phone-number-input/style.css'

type SyncResponse = { ok: true; needsProfileCompletion: boolean } | { error: string }

const translations = {
  en: {
    title: 'Sign in',
    subtitle: 'Sign in to your account',
    // Tabs
    tabPhone: 'Phone',
    tabEmail: 'Email',
    tabGoogle: 'Google',
    // Phone
    phoneLabel: 'Phone number',
    phonePlaceholder: 'Enter phone number',
    sendCodeToPhone: 'Send code to phone',
    codeSentToPhone: 'Code sent to {phone}',
    // Email
    email: 'Email',
    emailPlaceholder: 'you@example.com',
    sendCodeToEmail: 'Send code to email',
    codeSentToEmail: 'Code sent to {email}',
    // OTP
    enterCode: 'Enter 6-digit code',
    verifyCode: 'Verify code',
    resendCode: 'Resend code',
    codeExpired: 'Code expired. Please resend.',
    invalidCode: 'Invalid code. Please try again.',
    // Google
    continueWithGoogle: 'Continue with Google',
    // Common
    working: 'Working…',
    sending: 'Sending…',
    verifying: 'Verifying…',
    orDivider: 'OR',
    notRegisteredYet: 'Not registered yet?',
    signUp: 'Sign up',
    // Forgot password (preserved)
    forgotPassword: 'Forgot password?',
    resetPasswordTitle: 'Reset Password',
    resetPasswordMessage: 'Enter your email address and we\'ll send you a link to reset your password.',
    sendResetLink: 'Send Reset Link',
    resetEmailSent: 'Reset link sent!',
    resetEmailSentMessage: 'If an account exists with this email, you will receive a password reset link shortly. Please check your inbox.',
    cancel: 'Cancel',
    invalidEmail: 'Please enter a valid email address',
    cooldownMessage: 'Please wait {seconds}s before requesting another code',
    // Errors
    errorSendingCode: 'Error sending code. Please try again.',
    errorVerifying: 'Error verifying code. Please try again.',
    tooManyAttempts: 'Too many attempts. Please try again later.',
  },
  he: {
    title: 'התחברות',
    subtitle: 'התחברו לחשבון שלכם',
    // Tabs
    tabPhone: 'טלפון',
    tabEmail: 'אימייל',
    tabGoogle: 'Google',
    // Phone
    phoneLabel: 'מספר טלפון',
    phonePlaceholder: 'הזינו מספר טלפון',
    sendCodeToPhone: 'שלח קוד לטלפון',
    codeSentToPhone: 'קוד נשלח ל-{phone}',
    // Email
    email: 'אימייל',
    emailPlaceholder: 'name@example.com',
    sendCodeToEmail: 'שלח קוד לאימייל',
    codeSentToEmail: 'קוד נשלח ל-{email}',
    // OTP
    enterCode: 'הזינו קוד בן 6 ספרות',
    verifyCode: 'אימות קוד',
    resendCode: 'שליחה מחדש',
    codeExpired: 'הקוד פג תוקף. אנא שלחו מחדש.',
    invalidCode: 'קוד שגוי. נסו שוב.',
    // Google
    continueWithGoogle: 'התחברות עם Google',
    // Common
    working: 'רגע…',
    sending: 'שולח…',
    verifying: 'מאמת…',
    orDivider: 'או',
    notRegisteredYet: 'עדיין לא נרשמת?',
    signUp: 'הרשמה',
    // Forgot password (preserved)
    forgotPassword: 'שכחתי סיסמה',
    resetPasswordTitle: 'איפוס סיסמה',
    resetPasswordMessage: 'הזינו את כתובת האימייל שלכם ונשלח לכם קישור לאיפוס הסיסמה.',
    sendResetLink: 'שליחת קישור איפוס',
    resetEmailSent: 'קישור איפוס נשלח!',
    resetEmailSentMessage: 'אם קיים חשבון עם אימייל זה, תקבלו קישור לאיפוס סיסמה בקרוב. אנא בדקו את תיבת הדואר שלכם.',
    cancel: 'ביטול',
    invalidEmail: 'אנא הזינו כתובת אימייל תקינה',
    cooldownMessage: 'אנא המתינו {seconds} שניות לפני בקשת קוד נוסף',
    // Errors
    errorSendingCode: 'שגיאה בשליחת קוד. נסו שוב.',
    errorVerifying: 'שגיאה באימות הקוד. נסו שוב.',
    tooManyAttempts: 'יותר מדי ניסיונות. נסו שוב מאוחר יותר.',
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
  const isRTL = lng === 'he'

  const { user: firebaseUser, loading: authLoading } = useAuth()

  // Tab state
  const [activeTab, setActiveTab] = useState<'phone' | 'email' | 'google'>('phone')

  // Phone state
  const [phoneNumber, setPhoneNumber] = useState<PhoneValue | undefined>(undefined)
  const [phoneConfirmationResult, setPhoneConfirmationResult] = useState<ConfirmationResult | null>(null)
  const [phoneCode, setPhoneCode] = useState('')
  const [recaptchaVerifier, setRecaptchaVerifier] = useState<RecaptchaVerifier | null>(null)

  // Email state
  const [email, setEmail] = useState('')
  const [emailCode, setEmailCode] = useState('')
  const [emailOtpSent, setEmailOtpSent] = useState(false)

  // Shared state
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [gate, setGate] = useState<'idle' | 'checking' | 'redirecting'>('idle')
  const [resetSuccessBanner, setResetSuccessBanner] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [resetEmailSent, setResetEmailSent] = useState(false)
  const [resetCooldown, setResetCooldown] = useState(0)

  const syncedUidRef = useRef<string | null>(null)

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

  // Cooldown timers
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [resendCooldown])

  useEffect(() => {
    if (resetCooldown > 0) {
      const timer = setTimeout(() => setResetCooldown(resetCooldown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [resetCooldown])

  // Initialize recaptcha verifier for phone auth
  useEffect(() => {
    if (activeTab !== 'phone') return

    const initVerifier = () => {
      let container = document.getElementById('recaptcha-container')
      
      if (!container) {
        container = document.createElement('div')
        container.id = 'recaptcha-container'
        container.style.display = 'none'
        document.body.appendChild(container)
      }

      try {
        const verifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
          size: 'invisible'
        })
        setRecaptchaVerifier(verifier)
        return () => {
          try {
            verifier.clear()
          } catch {
            // Ignore cleanup errors
          }
        }
      } catch (err) {
        console.error('Error initializing RecaptchaVerifier:', err)
        return undefined
      }
    }

    let cleanup = initVerifier()
    if (!cleanup) {
      const timer = setTimeout(() => {
        cleanup = initVerifier()
      }, 100)
      return () => {
        clearTimeout(timer)
        if (cleanup) cleanup()
      }
    }

    return cleanup
  }, [activeTab])

  // Reset state when switching tabs
  useEffect(() => {
    setError(null)
    if (activeTab === 'phone') {
      setPhoneCode('')
      setPhoneConfirmationResult(null)
    } else if (activeTab === 'email') {
      setEmailCode('')
      setEmailOtpSent(false)
    }
  }, [activeTab])

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

  // Phone authentication handlers
  async function handleSendPhoneCode() {
    if (!phoneNumber || !recaptchaVerifier) {
      setError('Please enter a phone number')
      return
    }

    const phone = phoneNumber // Type narrowing
    const verifier = recaptchaVerifier // Type narrowing

    setBusy(true)
    setError(null)

    try {
      await verifier.render()
      const confirmationResult = await signInWithPhoneNumber(auth, phone, verifier)
      setPhoneConfirmationResult(confirmationResult)
      setResendCooldown(60)
    } catch (err: any) {
      const code = typeof err?.code === 'string' ? err.code : ''
      if (code === 'auth/invalid-phone-number') {
        setError('Invalid phone number. Please check and try again.')
      } else if (code === 'auth/too-many-requests') {
        setError(t.tooManyAttempts)
        setResendCooldown(60)
      } else {
        setError(formatAuthError(err, t.errorSendingCode))
      }
    } finally {
      setBusy(false)
    }
  }

  async function handleVerifyPhoneCode() {
    if (!phoneConfirmationResult || !phoneCode || phoneCode.length !== 6) {
      setError('Please enter the 6-digit code')
      return
    }

    setBusy(true)
    setError(null)

    try {
      const userCredential = await phoneConfirmationResult.confirm(phoneCode)
      setGate('checking')
      await postLoginRedirect(userCredential.user)
    } catch (err: any) {
      const code = typeof err?.code === 'string' ? err.code : ''
      if (code === 'auth/invalid-verification-code') {
        setError(t.invalidCode)
      } else if (code === 'auth/code-expired') {
        setError(t.codeExpired)
      } else {
        setError(formatAuthError(err, t.errorVerifying))
      }
      setGate('idle')
    } finally {
      setBusy(false)
    }
  }

  // Email authentication handlers
  async function handleSendEmailCode() {
    const trimmedEmail = email.trim()
    
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setError(t.invalidEmail)
      return
    }

    if (resendCooldown > 0) {
      setError(t.cooldownMessage.replace('{seconds}', String(resendCooldown)))
      return
    }

    setBusy(true)
    setError(null)

    try {
      const res = await fetch('/api/auth/send-email-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail, lng }),
      })

      if (!res.ok) {
        throw new Error('Failed to send code')
      }

      setEmailOtpSent(true)
      setResendCooldown(60)
    } catch (err: any) {
      setError(formatAuthError(err, t.errorSendingCode))
    } finally {
      setBusy(false)
    }
  }

  async function handleVerifyEmailCode() {
    if (!emailCode || emailCode.length !== 6) {
      setError('Please enter the 6-digit code')
      return
    }

    setBusy(true)
    setError(null)

    try {
      const res = await fetch('/api/auth/verify-email-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), code: emailCode }),
      })

      const data = await res.json().catch(() => null)

      if (!res.ok || !data || !data.ok) {
        throw new Error(data?.error || 'Failed to verify code')
      }

      // Sign in with custom token
      const userCredential = await signInWithCustomToken(auth, data.customToken)
      setGate('checking')
      await postLoginRedirect(userCredential.user)
    } catch (err: any) {
      setError(formatAuthError(err, t.errorVerifying))
      setGate('idle')
    } finally {
      setBusy(false)
    }
  }

  // Google authentication handler
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

  // Forgot password handler (preserved)
  async function handleForgotPassword() {
    const trimmedEmail = email.trim()
    
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setError(t.invalidEmail)
      return
    }

    if (resetCooldown > 0) {
      setError(t.cooldownMessage.replace('{seconds}', String(resetCooldown)))
      return
    }

    setBusy(true)
    setError(null)
    
    try {
      const protocol = typeof window !== 'undefined' ? window.location.protocol : 'https:'
      const host = typeof window !== 'undefined' ? window.location.host : ''
      const continueUrl = `${protocol}//${host}/${lng}/reset-password`

      await fetch('/api/auth/password-reset', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: trimmedEmail,
          continueUrl,
          lng,
        }),
      })
      
      setResetEmailSent(true)
      setResetCooldown(60)
      
      setTimeout(() => {
        setShowForgotPassword(false)
        setResetEmailSent(false)
      }, 5000)
    } catch (e: any) {
      const code = typeof e?.code === 'string' ? e.code : ''
      if (code === 'auth/too-many-requests') {
        setError('Too many requests. Please try again later.')
      } else {
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
      <div className={profileTheme.pageBg} dir={isRTL ? 'rtl' : 'ltr'}>
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
    <div className={profileTheme.pageBg} dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="mx-auto w-full max-w-md px-2 pt-20 pb-8">
        <div className="flex justify-center">
          <Image
            src="/images/logo/sako-logo.png"
            alt="Sako-Or"
            width={180}
            height={180}
            priority
          />
        </div>

        <h1 className="mt-1 text-center text-2xl font-bold text-slate-900">{t.title}</h1>
        <p className="mt-1 text-center text-sm text-slate-500">{t.subtitle}</p>

        <div className="mt-4 rounded-xl bg-white/90 shadow-[0_10px_30px_rgba(15,23,42,0.08)] ring-1 ring-black/5 backdrop-blur p-6">
          {resetSuccessBanner ? (
            <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              {isRTL
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

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'phone' | 'email' | 'google')} className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-4 ">
              <TabsTrigger value="phone" className="text-slate-700 data-[state=active]:text-slate-900">{t.tabPhone}</TabsTrigger>
              <TabsTrigger value="email" className="text-slate-700 data-[state=active]:text-slate-900">{t.tabEmail}</TabsTrigger>
              <TabsTrigger value="google" className="text-slate-700 data-[state=active]:text-slate-900">{t.tabGoogle}</TabsTrigger>
            </TabsList>

            <TabsContent value="phone" className="space-y-4">
              {!phoneConfirmationResult ? (
                <>
                  <div>
                    <label className={profileTheme.label} dir={isRTL ? 'rtl' : 'ltr'}>{t.phoneLabel}</label>
                    <div className="mt-1 [&_.PhoneInputInput]:flex [&_.PhoneInputInput]:h-10 [&_.PhoneInputInput]:w-full [&_.PhoneInputInput]:rounded-md [&_.PhoneInputInput]:border [&_.PhoneInputInput]:border-[#856D55]/70 [&_.PhoneInputInput]:bg-[#E1DBD7]/70 [&_.PhoneInputInput]:px-3 [&_.PhoneInputInput]:py-2 [&_.PhoneInputInput]:text-sm [&_.PhoneInputInput]:text-slate-900 [&_.PhoneInputInput]:ring-offset-background [&_.PhoneInputInput]:focus-visible:outline-none [&_.PhoneInputInput]:focus-visible:ring-2 [&_.PhoneInputInput]:focus-visible:ring-[#856D55] [&_.PhoneInputInput]:focus-visible:ring-offset-2 [&_.PhoneInputInput]:disabled:cursor-not-allowed [&_.PhoneInputInput]:disabled:opacity-50 [&_.PhoneInputCountry]:mr-2 [&_.PhoneInputCountrySelect]:text-slate-900">
                      <PhoneInput
                        international
                        defaultCountry="IL"
                        value={phoneNumber}
                        onChange={(value) => setPhoneNumber(value ?? undefined)}
                        placeholder={t.phonePlaceholder}
                        disabled={busy}
                        className="phone-input"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleSendPhoneCode}
                    disabled={busy || !phoneNumber}
                    className="w-full inline-flex items-center justify-center rounded-md bg-[#856D55]/90 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#856D55] focus:outline-none focus:ring-2 focus:ring-[#856D55] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {busy ? t.sending : t.sendCodeToPhone}
                  </button>
                </>
              ) : (
                <>
                  <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                    {t.codeSentToPhone.replace('{phone}', phoneNumber || '')}
                  </div>
                  <div>
                    <label className={profileTheme.label} dir={isRTL ? 'rtl' : 'ltr'}>{t.enterCode}</label>
                    <div className="mt-2">
                      <OtpInput
                        value={phoneCode}
                        onChange={setPhoneCode}
                        length={6}
                        disabled={busy}
                        dir={isRTL ? 'rtl' : 'ltr'}
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleVerifyPhoneCode}
                    disabled={busy || phoneCode.length !== 6}
                    className="w-full inline-flex items-center justify-center rounded-md bg-[#856D55]/90 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#856D55] focus:outline-none focus:ring-2 focus:ring-[#856D55] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {busy ? t.verifying : t.verifyCode}
                  </button>
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={handleSendPhoneCode}
                      disabled={busy || resendCooldown > 0}
                      className="text-sm text-[#856D55] hover:underline disabled:opacity-50"
                    >
                      {resendCooldown > 0 ? t.cooldownMessage.replace('{seconds}', String(resendCooldown)) : t.resendCode}
                    </button>
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="email" className="space-y-4">
              {!emailOtpSent ? (
                <>
                  <div>
                    <label className={profileTheme.label} dir={isRTL ? 'rtl' : 'ltr'}>{t.email}</label>
                    <input
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t.emailPlaceholder}
                      className={profileTheme.input}
                      disabled={busy}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSendEmailCode}
                    disabled={busy || !email.trim() || resendCooldown > 0}
                    className="w-full inline-flex items-center justify-center rounded-md bg-[#856D55]/90 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#856D55] focus:outline-none focus:ring-2 focus:ring-[#856D55] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {busy ? t.sending : resendCooldown > 0 ? t.cooldownMessage.replace('{seconds}', String(resendCooldown)) : t.sendCodeToEmail}
                  </button>
                </>
              ) : (
                <>
                  <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                    {t.codeSentToEmail.replace('{email}', email)}
                  </div>
                  <div>
                    <label className={profileTheme.label} dir={isRTL ? 'rtl' : 'ltr'}>{t.enterCode}</label>
                    <div className="mt-2">
                      <OtpInput
                        value={emailCode}
                        onChange={setEmailCode}
                        length={6}
                        disabled={busy}
                        dir={isRTL ? 'rtl' : 'ltr'}
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleVerifyEmailCode}
                    disabled={busy || emailCode.length !== 6}
                    className="w-full inline-flex items-center justify-center rounded-md bg-[#856D55]/90 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#856D55] focus:outline-none focus:ring-2 focus:ring-[#856D55] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {busy ? t.verifying : t.verifyCode}
                  </button>
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={handleSendEmailCode}
                      disabled={busy || resendCooldown > 0}
                      className="text-sm text-[#856D55] hover:underline disabled:opacity-50"
                    >
                      {resendCooldown > 0 ? t.cooldownMessage.replace('{seconds}', String(resendCooldown)) : t.resendCode}
                    </button>
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="google" className="space-y-4">
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
            </TabsContent>
          </Tabs>

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
      <div id="recaptcha-container" style={{ display: 'none' }} />
    </div>
  )
}
