'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { sanitizeRedirect } from '@/lib/safe-redirect'
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
import AuthShell, {
  AuthAside,
  AuthAsideItem,
  AuthError,
  AuthLink,
  AuthNotice,
  AuthSkeleton,
  AuthSubmit,
  AUTH_CELL,
  AUTH_LABEL,
} from '@/app/components/auth/AuthShell'
import { Field } from '@/app/components/ui/field'
import { cn } from '@/lib/utils'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/app/components/ui/tabs'
import { OtpInput } from '@/app/components/ui/otp-input'
import { IsraelPhoneInput } from '@/app/components/ui/israel-phone-input'
import {
  isTurnstileSessionExpired,
  parseTurnstileSessionResponse,
  type OtpTurnstileSessionResponse,
} from '@/lib/otp-turnstile-session'
import TurnstileScript from '@/app/components/TurnstileScript'

/**
 * Sign in, rebuilt on the SAKO OR — Update design system.
 *
 * There is no Sign in frame in the Figma file, so the page is composed from
 * constructions approved on screens that do have one — see
 * app/components/auth/AuthShell.tsx for the shell and the node ids behind it.
 * The controls are the design system's own: checkout's Form Input Field
 * (438:2751) and the CTA bar (438:7683 / 438:7685).
 *
 * Only the presentation changed. The Turnstile lifecycle, the OTP send/verify
 * contracts, the cooldowns, the Google popup-then-redirect fallback and the
 * post-login routing are all untouched.
 */
type SyncResponse = { ok: true; needsProfileCompletion: boolean } | { error: string }

const translations = {
  en: {
    title: 'Sign in',
    subtitle: 'Sign in to your account',
    eyebrow: 'ACCOUNT / SIGN IN',
    chooseChannel: 'How would you like to receive your code?',
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
    clubMemberTitle: '✨ Already a SAKO OR club member?',
    clubMemberIntro: 'If you\'re registered for the customer club in-store – great!',
    clubMemberBody: 'To see your points and use them on the website too, you need to sign up on the site first via the sign-up page. The system doesn\'t automatically recognise you by phone number alone, so a one-time registration is required. After signing up – all your points will appear in your account and you can use them for online purchases too. If this is your first time with us – sign up through the same page ✨',
    clubMemberCta: 'Sign up ›',
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
    eyebrow: 'חשבון / התחברות',
    chooseChannel: 'לאן לשלוח את הקוד?',
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
    clubMemberTitle: '✨ כבר חברה במועדון SAKO OR?',
    clubMemberIntro: 'אם את רשומה למועדון הלקוחות בחנות – מעולה!',
    clubMemberBody: 'כדי לראות את הנקודות שלך ולממש אותן גם באתר, יש להירשם תחילה לאתר באמצעות דף ההרשמה.\n\nהמערכת אינה מזהה אוטומטית לפי מספר טלפון בלבד, ולכן נדרש לבצע הרשמה חד-פעמית.\n\nלאחר ההרשמה – כל הנקודות שלך יופיעו בחשבון האישי ותוכלי להשתמש בהן גם ברכישה אונליין.\n\nגם אם זו הפעם הראשונה שלך אצלנו – ההרשמה מתבצעת דרך אותו דף ✨',
    clubMemberCta: 'להרשמה ›',
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
    <>
      <TurnstileScript />
      <Suspense fallback={<SignInLoading />}>
        <SignInClient />
      </Suspense>
    </>
  )
}

function SignInLoading() {
  return <AuthSkeleton />
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
  const [phoneResendCooldown, setPhoneResendCooldown] = useState(0)
  const [emailResendCooldown, setEmailResendCooldown] = useState(0)
  const [gate, setGate] = useState<'idle' | 'checking' | 'redirecting'>('idle')
  const [phoneTurnstileToken, setPhoneTurnstileToken] = useState<string>('')
  const [emailTurnstileToken, setEmailTurnstileToken] = useState<string>('')
  const [phoneTurnstileExpiresAt, setPhoneTurnstileExpiresAt] = useState<number | null>(null)
  const [emailTurnstileExpiresAt, setEmailTurnstileExpiresAt] = useState<number | null>(null)
  const [phoneServerClockOffsetMs, setPhoneServerClockOffsetMs] = useState(0)
  const [emailServerClockOffsetMs, setEmailServerClockOffsetMs] = useState(0)
  const [phoneResendToken, setPhoneResendToken] = useState<string>('')
  const [emailResendToken, setEmailResendToken] = useState<string>('')
  const [phoneResendTurnstileRequired, setPhoneResendTurnstileRequired] = useState(false)
  const [emailResendTurnstileRequired, setEmailResendTurnstileRequired] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  const syncedUidRef = useRef<string | null>(null)
  const activeTabRef = useRef(activeTab)
  const turnstileWidgetIdRef = useRef<string | null>(null)

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

    const renderForTab = activeTab

    const applyTurnstileToken = (token: string) => {
      if (renderForTab === 'phone') {
        setPhoneTurnstileToken(token)
      } else {
        setEmailTurnstileToken(token)
      }
    }

    const sitekey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
    if (typeof sitekey !== 'string' || !sitekey) {
      console.error('[Turnstile] Missing NEXT_PUBLIC_TURNSTILE_SITE_KEY — widget cannot render')
      return
    }

    const renderTurnstile = () => {
      // Ignore stale retries after tab switch
      if (renderForTab !== activeTabRef.current) return

      // Find the visible Turnstile container (based on active tab)
      const containerId = renderForTab === 'phone' ? '#cf-turnstile-phone' : '#cf-turnstile-email'
      const container = document.querySelector(containerId)

      if (!container) return

      // Remove any existing widget first
      if ((window as any).turnstile && turnstileWidgetIdRef.current != null) {
        try {
          (window as any).turnstile.remove(turnstileWidgetIdRef.current)
        } catch (e) {
          // Ignore errors if widget doesn't exist
        }
        turnstileWidgetIdRef.current = null
      }

      if ((window as any).turnstile) {
        try {
          const widgetId = (window as any).turnstile.render(containerId, {
            sitekey,
            theme: 'light',
            size: 'normal',
            callback: (token: string) => {
              // Ignore callbacks from removed or superseded widgets
              if (turnstileWidgetIdRef.current !== widgetId) return
              if (renderForTab !== activeTabRef.current) return
              applyTurnstileToken(token)
            },
            'error-callback': () => {
              console.error('Turnstile verification failed')
              if (turnstileWidgetIdRef.current !== widgetId) return
              if (renderForTab !== activeTabRef.current) return
              applyTurnstileToken('')
            }
          })
          turnstileWidgetIdRef.current = widgetId
          ;(window as any).turnstileWidgetId = widgetId
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
      if ((window as any).turnstile && turnstileWidgetIdRef.current != null) {
        try {
          (window as any).turnstile.remove(turnstileWidgetIdRef.current)
        } catch (e) {
          // Ignore errors
        }
        turnstileWidgetIdRef.current = null
      }
    }
  }, [isMounted, activeTab, phoneOtpSent, emailOtpSent, phoneResendTurnstileRequired, emailResendTurnstileRequired])

  // Handle query params (reset success + auto-open forgot password)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  // Cooldown timers (per channel)
  useEffect(() => {
    if (phoneResendCooldown > 0) {
      const timer = setTimeout(() => setPhoneResendCooldown(phoneResendCooldown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [phoneResendCooldown])

  useEffect(() => {
    if (emailResendCooldown > 0) {
      const timer = setTimeout(() => setEmailResendCooldown(emailResendCooldown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [emailResendCooldown])

  // No longer need recaptcha verifier for Inforu OTP

  // Reset OTP progress for the tab being left; keep activeTabRef in sync for Turnstile callbacks
  useEffect(() => {
    const previousTab = activeTabRef.current
    if (previousTab !== activeTab) {
      setError(null)
      setPhoneError(null)
      setEmailError(null)

      if (previousTab === 'phone') {
        setPhoneOtpSent(false)
        setPhoneCode('')
        setPhoneTurnstileToken('')
        setPhoneTurnstileExpiresAt(null)
        setPhoneResendToken('')
        setPhoneServerClockOffsetMs(0)
        setPhoneResendTurnstileRequired(false)
        setPhoneResendCooldown(0)
      } else if (previousTab === 'email') {
        setEmailOtpSent(false)
        setEmailCode('')
        setEmailTurnstileToken('')
        setEmailTurnstileExpiresAt(null)
        setEmailResendToken('')
        setEmailServerClockOffsetMs(0)
        setEmailResendTurnstileRequired(false)
        setEmailResendCooldown(0)
      }
    }

    activeTabRef.current = activeTab
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

  function isTurnstileVerificationError(status: number, error: unknown): boolean {
    if (status !== 400 || typeof error !== 'string') return false
    const lower = error.toLowerCase()
    return lower.includes('verification') || lower.includes('security')
  }

  function isPhoneResendTurnstileExpired() {
    return isTurnstileSessionExpired(phoneTurnstileExpiresAt, phoneServerClockOffsetMs)
  }

  function isEmailResendTurnstileExpired() {
    return isTurnstileSessionExpired(emailTurnstileExpiresAt, emailServerClockOffsetMs)
  }

  function applyPhoneTurnstileSession(data: OtpTurnstileSessionResponse | null) {
    const session = parseTurnstileSessionResponse(data)
    if (!session) return
    setPhoneServerClockOffsetMs(session.clockOffsetMs)
    if (session.turnstileExpiresAt != null) {
      setPhoneTurnstileExpiresAt(session.turnstileExpiresAt)
    }
    if (session.resendToken) {
      setPhoneResendToken(session.resendToken)
    }
  }

  function applyEmailTurnstileSession(data: OtpTurnstileSessionResponse | null) {
    const session = parseTurnstileSessionResponse(data)
    if (!session) return
    setEmailServerClockOffsetMs(session.clockOffsetMs)
    if (session.turnstileExpiresAt != null) {
      setEmailTurnstileExpiresAt(session.turnstileExpiresAt)
    }
    if (session.resendToken) {
      setEmailResendToken(session.resendToken)
    }
  }

  function phoneSendNeedsTurnstile() {
    if (isLocalhost) return false
    if (!phoneOtpSent) return true
    if (phoneResendTurnstileRequired || isPhoneResendTurnstileExpired()) return true
    if (!phoneResendToken) return true
    return false
  }

  function emailSendNeedsTurnstile() {
    if (isLocalhost) return false
    if (!emailOtpSent) return true
    if (emailResendTurnstileRequired || isEmailResendTurnstileExpired()) return true
    if (!emailResendToken) return true
    return false
  }

  const turnstileRequiredMessage = lng === 'he' ? 'נא להשלים את האימות' : 'Please complete the verification'

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
    // A validated return path wins over the default destination, so a customer sent
    // here from e.g. a review link lands back where they were instead of /profile.
    const returnTo = sanitizeRedirect(searchParams?.get('redirect'))
    if (returnTo && !syncJson.needsProfileCompletion) {
      router.replace(returnTo)
      return
    }
    router.replace(syncJson.needsProfileCompletion ? `/${lng}/signup${returnTo ? `?redirect=${encodeURIComponent(returnTo)}` : ''}` : `/${lng}/profile`)
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

    if (phoneResendCooldown > 0) {
      setPhoneError(t.cooldownMessage.replace('{seconds}', String(phoneResendCooldown)))
      return
    }

    // Turnstile required for initial send and for resends after the server window expires
    if (phoneSendNeedsTurnstile() && !phoneTurnstileToken) {
      if (phoneOtpSent) {
        setPhoneResendTurnstileRequired(true)
      }
      setPhoneError(turnstileRequiredMessage)
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
          ...(phoneOtpSent && phoneResendToken && { resendToken: phoneResendToken }),
          ...(phoneSendNeedsTurnstile() && phoneTurnstileToken && { turnstileToken: phoneTurnstileToken })
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
            setPhoneResendCooldown(parseInt(cooldownSeconds))
            setPhoneError(data.message || t.cooldownMessage.replace('{seconds}', cooldownSeconds))
          } else {
            setPhoneError(data?.message || t.tooManyAttempts)
          }
        } else {
          setPhoneError(data?.message || data?.error || t.errorSendingCode)
        }

        if (phoneOtpSent && isTurnstileVerificationError(res.status, data?.error)) {
          setPhoneResendTurnstileRequired(true)
          setPhoneTurnstileExpiresAt(null)
          setPhoneResendToken('')
        }
        
        // Reset Turnstile widget on error
        if ((window as any).turnstile && turnstileWidgetIdRef.current != null) {
          try {
            (window as any).turnstile.reset(turnstileWidgetIdRef.current)
          } catch (e) {
            // Ignore errors
          }
        }
        setPhoneTurnstileToken('')
        return
      }

      setPhoneOtpSent(true)
      setPhoneResendCooldown(60)
      applyPhoneTurnstileSession(data)
      setPhoneResendTurnstileRequired(false)
      setPhoneTurnstileToken('')
    } catch (err: any) {
      setPhoneError(formatAuthError(err, t.errorSendingCode))
      
      // Reset Turnstile widget on error
      if ((window as any).turnstile && turnstileWidgetIdRef.current != null) {
        try {
          (window as any).turnstile.reset(turnstileWidgetIdRef.current)
        } catch (e) {
          // Ignore errors
        }
      }
      setPhoneTurnstileToken('')
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

    if (emailResendCooldown > 0) {
      setEmailError(t.cooldownMessage.replace('{seconds}', String(emailResendCooldown)))
      return
    }

    // Turnstile required for initial send and for resends after the server window expires
    if (emailSendNeedsTurnstile() && !emailTurnstileToken) {
      if (emailOtpSent) {
        setEmailResendTurnstileRequired(true)
      }
      setEmailError(turnstileRequiredMessage)
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
          ...(emailOtpSent && emailResendToken && { resendToken: emailResendToken }),
          ...(emailSendNeedsTurnstile() && emailTurnstileToken && { turnstileToken: emailTurnstileToken })
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
            setEmailResendCooldown(parseInt(cooldownSeconds))
            setEmailError(data.message || t.cooldownMessage.replace('{seconds}', cooldownSeconds))
          } else {
            setEmailError(data?.message || t.tooManyAttempts)
          }
        } else {
          setEmailError(data?.message || data?.error || t.errorSendingCode)
        }

        if (emailOtpSent && isTurnstileVerificationError(res.status, data?.error)) {
          setEmailResendTurnstileRequired(true)
          setEmailTurnstileExpiresAt(null)
          setEmailResendToken('')
        }
        
        // Reset Turnstile widget on error
        if ((window as any).turnstile && turnstileWidgetIdRef.current != null) {
          try {
            (window as any).turnstile.reset(turnstileWidgetIdRef.current)
          } catch (e) {
            // Ignore errors
          }
        }
        setEmailTurnstileToken('')
        return
      }

      setEmailOtpSent(true)
      setEmailResendCooldown(60)
      applyEmailTurnstileSession(data)
      setEmailResendTurnstileRequired(false)
      setEmailTurnstileToken('')
    } catch (err: any) {
      setEmailError(formatAuthError(err, t.errorSendingCode))
      
      // Reset Turnstile widget on error
      if ((window as any).turnstile && turnstileWidgetIdRef.current != null) {
        try {
          (window as any).turnstile.reset(turnstileWidgetIdRef.current)
        } catch (e) {
          // Ignore errors
        }
      }
      setEmailTurnstileToken('')
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
    return <AuthSkeleton title={t.title} />
  }

  // The code step repeats for both channels, so it is written once. Everything
  // it needs is passed in — no channel branching inside.
  //
  // A function returning JSX, called as renderCodeStep({...}), NOT a nested
  // <CodeStep /> component: a component declared inside the render body is a new
  // type on every keystroke, so React would unmount and remount the whole
  // subtree and the OTP box would lose focus after every digit.
  function renderCodeStep({
    channel,
    sentNotice,
    code,
    setCode,
    fieldError,
    cooldown,
    resendTurnstileRequired,
    turnstileToken,
    onVerify,
    onResend,
  }: {
    channel: 'phone' | 'email'
    sentNotice: string
    code: string
    setCode: (v: string) => void
    fieldError: string | null
    cooldown: number
    resendTurnstileRequired: boolean
    turnstileToken: string
    onVerify: () => void
    onResend: () => void
  }) {
    const errorId = `signin-${channel}-code-error`
    return (
      <>
        <AuthNotice>{sentNotice}</AuthNotice>

        <div className="mt-[30px]">
          <p className="font-ploni text-[9px] leading-none text-text-secondary">{t.enterCode}</p>
          <div className="mt-[10px]">
            <OtpInput
              variant="sako"
              value={code}
              onChange={setCode}
              length={6}
              disabled={busy}
              error={Boolean(fieldError)}
              aria-describedby={fieldError ? errorId : undefined}
            />
          </div>
          {fieldError && (
            <p id={errorId} role="alert" className="pt-[6px] font-ploni text-[12px] text-accent-error">
              {fieldError}
            </p>
          )}
        </div>

        <AuthSubmit
          className="mt-[30px]"
          label={t.verifyCode}
          loadingLabel={t.verifying}
          loading={busy}
          disabled={code.length !== 6}
          onClick={onVerify}
        />

        {resendTurnstileRequired && isMounted && !isLocalhost && (
          <div className="mt-[20px]">
            <div id={`cf-turnstile-${channel}`}></div>
          </div>
        )}

        <div className="mt-[24px] flex">
          <AuthLink
            onClick={onResend}
            disabled={
              busy ||
              cooldown > 0 ||
              (resendTurnstileRequired && !isLocalhost && !turnstileToken)
            }
          >
            {cooldown > 0
              ? t.cooldownMessage.replace('{seconds}', String(cooldown))
              : t.resendCode}
          </AuthLink>
        </div>
      </>
    )
  }

  return (
    <AuthShell
      title={t.title}
      eyebrow={t.eyebrow}
      aside={
        <AuthAside heading={t.clubMemberTitle}>
          <p className="font-ploni text-[14px] leading-[22px] text-start text-text-primary">
            {t.clubMemberIntro}
          </p>
          <AuthAsideItem>
            <span className="whitespace-pre-line text-text-secondary">{t.clubMemberBody}</span>
          </AuthAsideItem>
          <div className="flex">
            <AuthLink href={`/${lng}/signup`}>{t.clubMemberCta}</AuthLink>
          </div>
        </AuthAside>
      }
    >
      <AuthError>{error}</AuthError>

      <p className={cn(AUTH_LABEL, 'text-text-secondary')}>{t.chooseChannel}</p>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as 'phone' | 'email')}
        className="mt-[14px] w-full"
      >
        <TabsList variant="sako">
          <TabsTrigger variant="sako" value="phone">
            {t.tabPhone}
          </TabsTrigger>
          <TabsTrigger variant="sako" value="email">
            {t.tabEmail}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="phone" className="mt-[30px]">
          {!phoneOtpSent ? (
            <>
              <Field
                fieldClassName={AUTH_CELL}
                id="signin-phone"
                label={t.phoneLabel}
                error={phoneError}
              >
                <IsraelPhoneInput
                  variant="sako"
                  id="signin-phone"
                  value={phoneLocalNumber}
                  onChange={setPhoneLocalNumber}
                  placeholder={t.phonePlaceholder}
                  disabled={busy}
                  aria-invalid={phoneError ? true : undefined}
                  aria-describedby={phoneError ? 'signin-phone-error' : undefined}
                />
              </Field>

              <AuthSubmit
                className="mt-[15px]"
                label={
                  phoneResendCooldown > 0
                    ? t.cooldownMessage.replace('{seconds}', String(phoneResendCooldown))
                    : t.sendCodeToPhone
                }
                loadingLabel={t.sending}
                loading={busy}
                disabled={
                  !phoneLocalNumber ||
                  phoneLocalNumber.replace(/\D/g, '').length < 8 ||
                  phoneResendCooldown > 0 ||
                  (!isLocalhost && !phoneTurnstileToken)
                }
                onClick={handleSendPhoneCode}
              />

              {isMounted && !isLocalhost && (
                <div className="mt-[20px]">
                  <div id="cf-turnstile-phone"></div>
                </div>
              )}
            </>
          ) : (
            renderCodeStep({
              channel: 'phone',
              sentNotice: t.codeSentToPhone.replace(
                '{phone}',
                phoneLocalNumber
                  ? phoneLocalNumber.startsWith('0')
                    ? phoneLocalNumber
                    : `0${phoneLocalNumber}`
                  : ''
              ),
              code: phoneCode,
              setCode: setPhoneCode,
              fieldError: phoneError,
              cooldown: phoneResendCooldown,
              resendTurnstileRequired: phoneResendTurnstileRequired,
              turnstileToken: phoneTurnstileToken,
              onVerify: handleVerifyPhoneCode,
              onResend: handleSendPhoneCode,
            })
          )}
        </TabsContent>

        <TabsContent value="email" className="mt-[30px]">
          {!emailOtpSent ? (
            <>
              <Field
                fieldClassName={AUTH_CELL}
                id="signin-email"
                label={t.email}
                type="email"
                autoComplete="email"
                // An address is not Hebrew text and reads backwards if it
                // inherits the page direction.
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t.emailPlaceholder}
                disabled={busy}
                error={emailError}
              />

              <AuthSubmit
                className="mt-[15px]"
                label={
                  emailResendCooldown > 0
                    ? t.cooldownMessage.replace('{seconds}', String(emailResendCooldown))
                    : t.sendCodeToEmail
                }
                loadingLabel={t.sending}
                loading={busy}
                disabled={
                  !email.trim() ||
                  emailResendCooldown > 0 ||
                  (!isLocalhost && !emailTurnstileToken)
                }
                onClick={handleSendEmailCode}
              />

              {isMounted && !isLocalhost && (
                <div className="mt-[20px]">
                  <div id="cf-turnstile-email"></div>
                </div>
              )}
            </>
          ) : (
            renderCodeStep({
              channel: 'email',
              sentNotice: t.codeSentToEmail.replace('{email}', email),
              code: emailCode,
              setCode: setEmailCode,
              fieldError: emailError,
              cooldown: emailResendCooldown,
              resendTurnstileRequired: emailResendTurnstileRequired,
              turnstileToken: emailTurnstileToken,
              onVerify: handleVerifyEmailCode,
              onResend: handleSendEmailCode,
            })
          )}
        </TabsContent>
      </Tabs>

      {/* The divider, as a rule with the label sitting in it — no tinted pill. */}
      <div className="my-[30px] flex items-center gap-[14px]">
        <span className="h-px flex-1 bg-border-subtle" />
        <span className={cn(AUTH_LABEL, 'text-text-secondary')}>{t.orDivider}</span>
        <span className="h-px flex-1 bg-border-subtle" />
      </div>

      {/* The outlined CTA (438:7685). The Google mark stays in full colour: it
          is a brand mark that carries meaning, not one of the decorative
          pictograms this system drops. */}
      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={busy}
        aria-busy={busy || undefined}
        className={cn(
          'flex h-[54px] w-full items-center justify-center gap-[12px] border border-border-default bg-transparent px-[19px] font-ploni text-[16px] font-bold leading-none text-btn-secondary-text transition-colors',
          'hover:bg-sako-ink-900 hover:text-btn-primary-text',
          'disabled:cursor-not-allowed disabled:border-sako-gray-500 disabled:bg-transparent disabled:text-sako-gray-500 disabled:hover:bg-transparent disabled:hover:text-sako-gray-500',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sako-ink-900'
        )}
      >
        <svg className="size-[20px] shrink-0" viewBox="0 0 24 24" aria-hidden="true">
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

      {/* The sign-up route, kept on the form side as well as in the panel: on a
          phone the panel is below the fold and this is the only one visible. */}
      <div className="mt-[30px] flex flex-wrap items-center gap-[12px] border-t border-border-subtle pt-[20px]">
        <span className="font-ploni text-[14px] text-text-secondary">{t.notRegisteredYet}</span>
        <AuthLink href={`/${lng}/signup`}>{t.signUp}</AuthLink>
      </div>
    </AuthShell>
  )
}
