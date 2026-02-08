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
  signInWithCustomToken,
  type User,
} from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useAuth } from '@/app/contexts/AuthContext'
import { profileTheme } from '@/app/components/profile/profileTheme'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/app/components/ui/tabs'
import { OtpInput } from '@/app/components/ui/otp-input'
import { IsraelPhoneInput } from '@/app/components/ui/israel-phone-input'

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
    phonePlaceholder: '0501234567 or 501234567',
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
    invalidEmail: 'Please enter a valid email address',
    cooldownMessage: 'Please wait {seconds}s before requesting another code',
    // Errors
    errorSendingCode: 'Error sending code. Please try again.',
    errorVerifying: 'Error verifying code. Please try again.',
    tooManyAttempts: 'Too many attempts. Please try again later.',
    emailNotRegistered: 'This email address is not registered',
    phoneNotRegistered: 'This phone number is not registered',
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
    phonePlaceholder: '0501234567',
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
    invalidEmail: 'אנא הזינו כתובת אימייל תקינה',
    cooldownMessage: 'אנא המתינו {seconds} שניות לפני בקשת קוד נוסף',
    // Errors
    errorSendingCode: 'שגיאה בשליחת קוד. נסו שוב.',
    errorVerifying: 'שגיאה באימות הקוד. נסו שוב.',
    tooManyAttempts: 'יותר מדי ניסיונות. נסו שוב מאוחר יותר.',
    emailNotRegistered: 'כתובת אימייל זו לא רשומה',
    phoneNotRegistered: 'מספר טלפון זה לא רשום',
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
  const [activeTab, setActiveTab] = useState<'phone' | 'email'>('phone')

  // Phone state
  const [phoneLocalNumber, setPhoneLocalNumber] = useState('') // Local number only (8-9 digits)
  const [phoneOtpSent, setPhoneOtpSent] = useState(false)
  const [phoneCode, setPhoneCode] = useState('')

  // Email state
  const [email, setEmail] = useState('')
  const [emailCode, setEmailCode] = useState('')
  const [emailOtpSent, setEmailOtpSent] = useState(false)

  // Shared state
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [gate, setGate] = useState<'idle' | 'checking' | 'redirecting'>('idle')
  const [turnstileToken, setTurnstileToken] = useState<string>('')
  const [isMounted, setIsMounted] = useState(false)

  const syncedUidRef = useRef<string | null>(null)

  // Check if running on localhost (skip Turnstile in development)
  const isLocalhost = typeof window !== 'undefined' && (
    window.location.hostname === 'localhost' || 
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.includes('localhost')
  )

  // Client-side mount detection
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Turnstile - explicit render when script loads or tab changes
  useEffect(() => {
    if (!isMounted || isLocalhost) return

    // Reset token when switching tabs
    setTurnstileToken('')

    const renderTurnstile = () => {
      // Find the visible Turnstile container (based on active tab)
      const containerId = activeTab === 'phone' ? '#cf-turnstile-phone' : '#cf-turnstile-email'
      const container = document.querySelector(containerId)
      
      if (!container) return

      // Remove any existing widget first
      if ((window as any).turnstile && (window as any).turnstileWidgetId) {
        try {
          (window as any).turnstile.remove((window as any).turnstileWidgetId)
        } catch (e) {
          // Ignore errors if widget doesn't exist
        }
      }

      if ((window as any).turnstile) {
        try {
          const widgetId = (window as any).turnstile.render(containerId, {
            sitekey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
            theme: 'light',
            size: 'normal',
            callback: (token: string) => {
              setTurnstileToken(token)
            },
            'error-callback': () => {
              console.error('Turnstile verification failed')
              setTurnstileToken('')
            }
          })
          ; (window as any).turnstileWidgetId = widgetId
        } catch (error) {
          console.error('Turnstile render error:', error)
        }
      } else {
        // Retry after 500ms if script not loaded yet
        setTimeout(renderTurnstile, 500)
      }
    }

    // Small delay to ensure DOM is ready after tab switch
    const timer = setTimeout(renderTurnstile, 100)

    return () => {
      clearTimeout(timer)
      // Clean up widget when component unmounts or tab changes
      if ((window as any).turnstile && (window as any).turnstileWidgetId) {
        try {
          (window as any).turnstile.remove((window as any).turnstileWidgetId)
        } catch (e) {
          // Ignore errors
        }
      }
    }
  }, [isMounted, activeTab])

  // Handle query params (reset success + auto-open forgot password)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  // Cooldown timers
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [resendCooldown])

  // No longer need recaptcha verifier for Inforu OTP

  // Reset state when switching tabs
  useEffect(() => {
    setError(null)
    setPhoneError(null)
    setEmailError(null)
    if (activeTab === 'phone') {
      setPhoneCode('')
      setPhoneOtpSent(false)
    } else if (activeTab === 'email') {
      setEmailCode('')
      setEmailOtpSent(false)
    }
  }, [activeTab])

  // Clear phone error when phone number changes
  useEffect(() => {
    if (phoneError) {
      setPhoneError(null)
    }
  }, [phoneLocalNumber]) // eslint-disable-line react-hooks/exhaustive-deps

  // Clear email error when email changes
  useEffect(() => {
    if (emailError) {
      setEmailError(null)
    }
  }, [email]) // eslint-disable-line react-hooks/exhaustive-deps

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
    // Validate: 8-9 digits without 0 prefix, or 9-10 digits with 0 prefix
    const digitsOnly = phoneLocalNumber.replace(/\D/g, '')
    const hasZeroPrefix = digitsOnly.startsWith('0')
    const digitCount = digitsOnly.length
    
    if (!phoneLocalNumber || (hasZeroPrefix && (digitCount < 9 || digitCount > 10)) || (!hasZeroPrefix && (digitCount < 8 || digitCount > 9))) {
      setPhoneError('Please enter a valid phone number')
      return
    }

    if (resendCooldown > 0) {
      setPhoneError(t.cooldownMessage.replace('{seconds}', String(resendCooldown)))
      return
    }

    // Skip Turnstile validation on localhost
    if (!isLocalhost && !turnstileToken) {
      setPhoneError(lng === 'he' ? 'נא להשלים את האימות' : 'Please complete the verification')
      return
    }

    // Use phone as-is (may have 0 prefix or not) - Inforu accepts both formats
    const phoneForInforu = phoneLocalNumber.startsWith('0') ? phoneLocalNumber : `0${phoneLocalNumber}`

    setBusy(true)
    setError(null)
    setPhoneError(null)

    try {
      // Call Inforu OTP send endpoint with user existence check (sign-in requires existing user)
      const res = await fetch('/api/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          otpType: 'sms', 
          otpValue: phoneForInforu,
          checkUserExists: true, // Sign-in requires existing user
          ...(turnstileToken && { turnstileToken })
        }),
      })

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        // Handle specific error codes
        if (res.status === 404 && data?.error === 'USER_NOT_FOUND') {
          setPhoneError(t.phoneNotRegistered)
        } else if (res.status === 429) {
          if (data?.error === 'COOLDOWN') {
            const cooldownSeconds = data.message?.match(/\d+/)?.[0] || '60'
            setResendCooldown(parseInt(cooldownSeconds))
            setPhoneError(data.message || t.cooldownMessage.replace('{seconds}', cooldownSeconds))
          } else {
            setPhoneError(data?.message || t.tooManyAttempts)
          }
        } else {
          setPhoneError(data?.message || t.errorSendingCode)
        }
        
        // Reset Turnstile widget on error
        if ((window as any).turnstile && (window as any).turnstileWidgetId) {
          try {
            (window as any).turnstile.reset((window as any).turnstileWidgetId)
          } catch (e) {
            // Ignore errors
          }
        }
        setTurnstileToken('')
        return
      }

      setPhoneOtpSent(true)
      setResendCooldown(60)
      
      // Reset Turnstile widget after successful send
      if ((window as any).turnstile && (window as any).turnstileWidgetId) {
        try {
          (window as any).turnstile.reset((window as any).turnstileWidgetId)
        } catch (e) {
          // Ignore errors
        }
      }
      setTurnstileToken('')
    } catch (err: any) {
      setPhoneError(formatAuthError(err, t.errorSendingCode))
      
      // Reset Turnstile widget on error
      if ((window as any).turnstile && (window as any).turnstileWidgetId) {
        try {
          (window as any).turnstile.reset((window as any).turnstileWidgetId)
        } catch (e) {
          // Ignore errors
        }
      }
      setTurnstileToken('')
    } finally {
      setBusy(false)
    }
  }

  async function handleVerifyPhoneCode() {
    if (!phoneCode || phoneCode.length !== 6) {
      setError('Please enter the 6-digit code')
      return
    }

    // Use phone as-is (may have 0 prefix or not) - Inforu accepts both formats
    const phoneForInforu = phoneLocalNumber.startsWith('0') ? phoneLocalNumber : `0${phoneLocalNumber}`

    setBusy(true)
    setError(null)

    try {
      const res = await fetch('/api/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          otpType: 'sms', 
          otpValue: phoneForInforu,
          otpCode: phoneCode,
          requireUserExists: true // Sign-in requires existing user
        }),
      })

      const data = await res.json().catch(() => null)

      if (!res.ok || !data || !data.ok) {
        // Check for expired code specifically
        if (data?.error === 'CODE_EXPIRED') {
          throw new Error('CODE_EXPIRED')
        }
        throw new Error(data?.error || 'Failed to verify code')
      }

      // Sign in with custom token
      const userCredential = await signInWithCustomToken(auth, data.customToken)
      setGate('checking')
      await postLoginRedirect(userCredential.user)
    } catch (err: any) {
      const msg = typeof err?.message === 'string' ? err.message : ''
      if (msg === 'CODE_EXPIRED' || msg.includes('CODE_EXPIRED')) {
        setError(t.codeExpired)
      } else if (msg.includes('Invalid') || msg.includes('expired')) {
        setError(t.invalidCode)
      } else if (msg.includes('not registered')) {
        setError(t.phoneNotRegistered)
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
      setEmailError(t.invalidEmail)
      return
    }

    if (resendCooldown > 0) {
      setEmailError(t.cooldownMessage.replace('{seconds}', String(resendCooldown)))
      return
    }

    // Skip Turnstile validation on localhost
    if (!isLocalhost && !turnstileToken) {
      setEmailError(lng === 'he' ? 'נא להשלים את האימות' : 'Please complete the verification')
      return
    }

    setBusy(true)
    setError(null)
    setEmailError(null)

    try {
      // Call Inforu OTP send endpoint with user existence check (sign-in requires existing user)
      const res = await fetch('/api/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          otpType: 'email', 
          otpValue: trimmedEmail,
          checkUserExists: true, // Sign-in requires existing user
          ...(turnstileToken && { turnstileToken })
        }),
      })

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        // Handle specific error codes
        if (res.status === 404 && data?.error === 'USER_NOT_FOUND') {
          setEmailError(t.emailNotRegistered)
        } else if (res.status === 429) {
          if (data?.error === 'COOLDOWN') {
            const cooldownSeconds = data.message?.match(/\d+/)?.[0] || '60'
            setResendCooldown(parseInt(cooldownSeconds))
            setEmailError(data.message || t.cooldownMessage.replace('{seconds}', cooldownSeconds))
          } else {
            setEmailError(data?.message || t.tooManyAttempts)
          }
        } else {
          setEmailError(data?.message || t.errorSendingCode)
        }
        
        // Reset Turnstile widget on error
        if ((window as any).turnstile && (window as any).turnstileWidgetId) {
          try {
            (window as any).turnstile.reset((window as any).turnstileWidgetId)
          } catch (e) {
            // Ignore errors
          }
        }
        setTurnstileToken('')
        return
      }

      setEmailOtpSent(true)
      setResendCooldown(60)
      
      // Reset Turnstile widget after successful send
      if ((window as any).turnstile && (window as any).turnstileWidgetId) {
        try {
          (window as any).turnstile.reset((window as any).turnstileWidgetId)
        } catch (e) {
          // Ignore errors
        }
      }
      setTurnstileToken('')
    } catch (err: any) {
      setEmailError(formatAuthError(err, t.errorSendingCode))
      
      // Reset Turnstile widget on error
      if ((window as any).turnstile && (window as any).turnstileWidgetId) {
        try {
          (window as any).turnstile.reset((window as any).turnstileWidgetId)
        } catch (e) {
          // Ignore errors
        }
      }
      setTurnstileToken('')
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
      const res = await fetch('/api/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          otpType: 'email', 
          otpValue: email.trim(), 
          otpCode: emailCode,
          requireUserExists: true // Sign-in requires existing user
        }),
      })

      const data = await res.json().catch(() => null)

      if (!res.ok || !data || !data.ok) {
        // Check for expired code specifically
        if (data?.error === 'CODE_EXPIRED') {
          throw new Error('CODE_EXPIRED')
        }
        throw new Error(data?.error || 'Failed to verify code')
      }

      // Sign in with custom token
      const userCredential = await signInWithCustomToken(auth, data.customToken)
      setGate('checking')
      await postLoginRedirect(userCredential.user)
    } catch (err: any) {
      const msg = typeof err?.message === 'string' ? err.message : ''
      if (msg === 'CODE_EXPIRED' || msg.includes('CODE_EXPIRED')) {
        setError(t.codeExpired)
      } else if (msg.includes('Invalid') || msg.includes('expired')) {
        setError(t.invalidCode)
      } else if (msg.includes('not registered')) {
        setError(t.emailNotRegistered)
      } else {
        setError(formatAuthError(err, t.errorVerifying))
      }
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
      <div className="mx-auto w-full max-w-md px-2 pt-34 pb-8">
        <div className="flex justify-center">
          <Image
            src="/images/logo/sako-logo.png"
            alt="Sako-Or"
            width={180}
            height={180}
            priority
          />
        </div>

        <h1 className="mt-8 text-center text-2xl font-bold text-slate-900">{t.title}</h1>
        <p className="mt-1 text-center text-sm text-slate-500">{t.subtitle}</p>

        <div className="mt-4 rounded-xl bg-white/90 shadow-[0_10px_30px_rgba(15,23,42,0.08)] ring-1 ring-black/5 backdrop-blur p-6">
          {error ? (
            <div className={`mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 ${isRTL ? 'text-right' : 'text-left'}`} dir={isRTL ? 'rtl' : 'ltr'}>
              {error}
            </div>
          ) : null}

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'phone' | 'email')} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="phone" className="text-slate-700 data-[state=active]:text-slate-900">{t.tabPhone}</TabsTrigger>
              <TabsTrigger value="email" className="text-slate-700 data-[state=active]:text-slate-900">{t.tabEmail}</TabsTrigger>
            </TabsList>

            <TabsContent value="phone" className="space-y-4">
              {!phoneOtpSent ? (
                <>
                  <div>
                    <label className={profileTheme.label} dir={isRTL ? 'rtl' : 'ltr'}>{t.phoneLabel}</label>
                    <div className="mt-1">
                      <IsraelPhoneInput
                        value={phoneLocalNumber}
                        onChange={setPhoneLocalNumber}
                        placeholder={t.phonePlaceholder}
                        disabled={busy}
                        dir={isRTL ? 'rtl' : 'ltr'}
                      />
                    </div>
                    {phoneError && (
                      <p className={`mt-1.5 text-sm text-red-600 ${isRTL ? 'text-right' : 'text-left'}`} dir={isRTL ? 'rtl' : 'ltr'}>
                        {phoneError}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleSendPhoneCode}
                    disabled={busy || !phoneLocalNumber || (phoneLocalNumber.replace(/\D/g, '').length < 8) || (!isLocalhost && !turnstileToken)}
                    className="w-full inline-flex items-center justify-center rounded-md bg-[#856D55]/90 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#856D55] focus:outline-none focus:ring-2 focus:ring-[#856D55] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {busy ? t.sending : t.sendCodeToPhone}
                  </button>
                  
                  {/* Cloudflare Turnstile Widget - Hidden on localhost */}
                  {isMounted && !isLocalhost && (
                    <div className="flex justify-center">
                      <div id="cf-turnstile-phone"></div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className={`rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 ${isRTL ? 'text-right' : 'text-left'}`} dir={isRTL ? 'rtl' : 'ltr'}>
                    {t.codeSentToPhone.replace('{phone}', phoneLocalNumber ? (phoneLocalNumber.startsWith('0') ? phoneLocalNumber : `0${phoneLocalNumber}`) : '')}
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
                    {emailError && (
                      <p className={`mt-1.5 text-sm text-red-600 ${isRTL ? 'text-right' : 'text-left'}`} dir={isRTL ? 'rtl' : 'ltr'}>
                        {emailError}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleSendEmailCode}
                    disabled={busy || !email.trim() || resendCooldown > 0 || (!isLocalhost && !turnstileToken)}
                    className="w-full inline-flex items-center justify-center rounded-md bg-[#856D55]/90 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#856D55] focus:outline-none focus:ring-2 focus:ring-[#856D55] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {busy ? t.sending : resendCooldown > 0 ? t.cooldownMessage.replace('{seconds}', String(resendCooldown)) : t.sendCodeToEmail}
                  </button>
                  
                  {/* Cloudflare Turnstile Widget - Hidden on localhost */}
                  {isMounted && !isLocalhost && (
                    <div className="flex justify-center">
                      <div id="cf-turnstile-email"></div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className={`rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 ${isRTL ? 'text-right' : 'text-left'}`} dir={isRTL ? 'rtl' : 'ltr'}>
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

          </Tabs>

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
