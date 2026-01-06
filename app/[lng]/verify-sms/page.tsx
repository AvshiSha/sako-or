'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/app/contexts/AuthContext'
import ProfileShell from '@/app/components/profile/ProfileShell'
import { profileTheme } from '@/app/components/profile/profileTheme'
import {
  PhoneAuthProvider,
  RecaptchaVerifier,
  updatePhoneNumber
} from 'firebase/auth'
import { auth } from '@/lib/firebase'

const translations = {
  en: {
    title: 'Verify Your Phone',
    subtitle: 'We need to verify your phone number to complete signup',
    greeting: 'Hi {firstName} {lastName}!',
    smsSent: 'We sent an SMS code to {phone}',
    enterCode: 'Enter the 6-digit code',
    codePlaceholder: '000000',
    verify: 'Verify Code',
    verifying: 'Verifying…',
    resend: 'Resend Code',
    resending: 'Sending…',
    waitSeconds: 'Wait {seconds}s',
    cancel: 'Cancel Signup',
    cancelling: 'Cancelling…',
    invalidCode: 'Invalid code. Please try again.',
    codeExpired: 'Code expired. Please resend.',
    tooManyAttempts: 'Too many attempts. Please try again later.',
    errorSendingSms: 'Error sending SMS. Please try again.',
    errorVerifying: 'Error verifying code. Please try again.',
    cancelConfirm: 'Are you sure? This will delete your account and you\'ll need to sign up again from scratch.',
    invalidAppCredential: 'Phone verification setup error. Please ensure your domain is authorized in Firebase Console and billing is enabled.',
    recaptchaError: 'Security verification failed. Please refresh the page and try again.',
    testModeInfo: 'If you added this phone as a test number in Firebase Console, use the test code you set (e.g., 123456) instead of waiting for SMS.',
    noSmsReceived: 'SMS not received? Check: 1) Firebase Console → Phone → Test numbers (use test code), 2) Billing plan is Blaze, 3) Check Firebase Console logs for errors.'
  },
  he: {
    title: 'אימות מספר טלפון',
    subtitle: 'נדרש לאמת את מספר הטלפון שלך כדי להשלים את ההרשמה',
    greeting: 'שלום {firstName} {lastName}!',
    smsSent: 'שלחנו קוד SMS למספר {phone}',
    enterCode: 'הזינו את הקוד בן 6 הספרות',
    codePlaceholder: '000000',
    verify: 'אימות קוד',
    verifying: 'מאמת…',
    resend: 'שליחה מחדש',
    resending: 'שולח…',
    waitSeconds: 'המתן {seconds} שניות',
    cancel: 'ביטול הרשמה',
    cancelling: 'מבטל…',
    invalidCode: 'קוד שגוי. נסו שוב.',
    codeExpired: 'הקוד פג תוקף. אנא שלחו מחדש.',
    tooManyAttempts: 'יותר מדי ניסיונות. נסו שוב מאוחר יותר.',
    errorSendingSms: 'שגיאה בשליחת SMS. נסו שוב.',
    errorVerifying: 'שגיאה באימות הקוד. נסו שוב.',
    cancelConfirm: 'האם אתם בטוחים? פעולה זו תמחק את החשבון שלכם ותצטרכו להירשם מחדש מההתחלה.',
    invalidAppCredential: 'שגיאה בהגדרת אימות טלפון. אנא ודאו שהדומיין מורשה ב-Firebase Console ושבילינג מופעל.',
    recaptchaError: 'אימות אבטחה נכשל. אנא רעננו את הדף ונסו שוב.',
    testModeInfo: 'אם הוספתם את המספר הזה כמספר בדיקה ב-Firebase Console, השתמשו בקוד הבדיקה שקבעתם (למשל, 123456) במקום לחכות ל-SMS.',
    noSmsReceived: 'לא קיבלתם SMS? בדקו: 1) Firebase Console → Phone → Test numbers (השתמשו בקוד בדיקה), 2) תוכנית הבילינג היא Blaze, 3) בדקו את הלוגים ב-Firebase Console.'
  }
}

type PendingSignup = {
  uid: string
  firstName: string
  lastName: string
  phone: string
  language: string
  gender?: string
  addressStreet?: string
  addressStreetNumber?: string
  addressFloor?: string
  addressApt?: string
  isNewsletter: boolean
}

export default function VerifySmsPage() {
  const router = useRouter()
  const params = useParams()
  const lng = (params?.lng as string) || 'en'
  const t = translations[lng as keyof typeof translations] || translations.en

  const { user: firebaseUser, loading: authLoading } = useAuth()

  const [pendingSignup, setPendingSignup] = useState<PendingSignup | null>(null)
  const [verificationId, setVerificationId] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [recaptchaVerifier, setRecaptchaVerifier] = useState<RecaptchaVerifier | null>(null)
  const hasAttemptedSendRef = useRef(false)

  // Cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [resendCooldown])

  // Load pending signup from sessionStorage
  useEffect(() => {
    if (authLoading) return

    if (!firebaseUser) {
      router.replace(`/${lng}/signup`)
      return
    }

    const stored = sessionStorage.getItem('pendingSignup')
    if (!stored) {
      router.replace(`/${lng}/signup`)
      return
    }

    try {
      const parsed = JSON.parse(stored) as PendingSignup
      if (parsed.uid !== firebaseUser.uid) {
        sessionStorage.removeItem('pendingSignup')
        router.replace(`/${lng}/signup`)
        return
      }
      setPendingSignup(parsed)
    } catch {
      sessionStorage.removeItem('pendingSignup')
      router.replace(`/${lng}/signup`)
    }
  }, [firebaseUser, authLoading, router, lng])

  // Initialize recaptcha verifier once
  useEffect(() => {
    // Wait for container to be in DOM
    const initVerifier = () => {
      let container = document.getElementById('recaptcha-container')
      
      // Create container if it doesn't exist
      if (!container) {
        container = document.createElement('div')
        container.id = 'recaptcha-container'
        container.style.display = 'none'
        document.body.appendChild(container)
      }

      try {
        console.log('🔵 [RECAPTCHA] Initializing RecaptchaVerifier')
        const verifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
          size: 'invisible'
        })
        console.log('✅ [RECAPTCHA] RecaptchaVerifier created')

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

    // Try immediately, then retry after a short delay if needed
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
  }, [])

  // Auto-send SMS when component is ready (only once)
  useEffect(() => {
    console.log('🔵 [AUTO-SEND] Effect triggered', {
      pendingSignup: !!pendingSignup,
      verificationId: !!verificationId,
      busy,
      hasAttemptedSend: hasAttemptedSendRef.current,
      recaptchaVerifier: !!recaptchaVerifier
    })

    if (!pendingSignup || verificationId || busy || hasAttemptedSendRef.current || !recaptchaVerifier) {
      console.log('🔵 [AUTO-SEND] Skipping - conditions not met')
      return
    }

    console.log('🔵 [AUTO-SEND] Setting up timer to send SMS')
    const timer = setTimeout(() => {
      if (!hasAttemptedSendRef.current && recaptchaVerifier) {
        console.log('🔵 [AUTO-SEND] Timer fired - calling sendSmsCode')
        hasAttemptedSendRef.current = true
        void sendSmsCode()
      }
    }, 500)

    return () => {
      console.log('🔵 [AUTO-SEND] Cleanup - clearing timer')
      clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingSignup, verificationId, busy, recaptchaVerifier])

  async function sendSmsCode() {
    console.log('🔵 [SEND-SMS] sendSmsCode called', {
      firebaseUser: !!firebaseUser,
      pendingSignup: !!pendingSignup,
      phone: pendingSignup?.phone,
      recaptchaVerifier: !!recaptchaVerifier,
      hasAttemptedSend: hasAttemptedSendRef.current
    })

    if (!firebaseUser || !pendingSignup || !recaptchaVerifier) {
      console.log('❌ [SEND-SMS] Missing required values, returning')
      return
    }

    console.log('🔵 [SEND-SMS] Setting busy=true, clearing error')
    setBusy(true)
    setError(null)

    try {
      console.log('🔵 [SEND-SMS] Creating PhoneAuthProvider')
      console.log('🔵 [SEND-SMS] Current origin:', typeof window !== 'undefined' ? window.location.origin : 'N/A')
      console.log('🔵 [SEND-SMS] Auth domain:', auth.app.options.authDomain)
      console.log('🔵 [SEND-SMS] RecaptchaVerifier state:', {
        type: recaptchaVerifier?.type,
        destroyed: (recaptchaVerifier as any)?._destroyed
      })
      
      // Ensure reCAPTCHA is rendered first (for invisible, this is usually automatic but let's be explicit)
      try {
        console.log('🔵 [SEND-SMS] Rendering reCAPTCHA verifier...')
        await recaptchaVerifier.render()
        console.log('✅ [SEND-SMS] reCAPTCHA rendered successfully')
      } catch (renderErr: any) {
        console.warn('⚠️ [SEND-SMS] reCAPTCHA render warning (may be already rendered):', renderErr?.message)
        // Continue anyway - it might already be rendered
      }
      
      const provider = new PhoneAuthProvider(auth)
      console.log('🔵 [SEND-SMS] Calling verifyPhoneNumber', { 
        phone: pendingSignup.phone,
        providerCreated: !!provider
      })
      
      // Add timeout to detect hanging requests
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('verifyPhoneNumber timeout after 30s')), 30000)
      })
      
      console.log('🔵 [SEND-SMS] Starting verifyPhoneNumber with timeout...')
      const verId = await Promise.race([
        provider.verifyPhoneNumber(pendingSignup.phone, recaptchaVerifier),
        timeoutPromise
      ]) as string
      
      console.log('✅ [SEND-SMS] verifyPhoneNumber succeeded!', { 
        verificationId: verId?.substring(0, 20) + '...',
        fullLength: verId?.length
      })

      setVerificationId(verId)
      setResendCooldown(60)
    } catch (err: any) {
      console.error('❌ [SEND-SMS] Error sending SMS:', err)
      console.error('❌ [SEND-SMS] Error details:', {
        name: err?.name,
        message: err?.message,
        code: err?.code,
        stack: err?.stack?.substring(0, 300),
        customData: err?.customData,
        response: err?.response,
        serverResponse: err?.serverResponse,
        // Try to extract more details from Firebase error
        errorInfo: err?.errorInfo
      })
      
      // Try to get the actual error response body if available
      if (err?.customData?.serverResponse) {
        try {
          const serverResponse = typeof err.customData.serverResponse === 'string' 
            ? JSON.parse(err.customData.serverResponse)
            : err.customData.serverResponse
          console.error('❌ [SEND-SMS] Server response:', serverResponse)
        } catch (e) {
          console.error('❌ [SEND-SMS] Raw server response:', err.customData.serverResponse)
        }
      }
      
      const code = typeof err?.code === 'string' ? err.code : ''
      const msg = typeof err?.message === 'string' ? err.message : ''
      
      // Check for specific error patterns
      if (msg.includes('400') || msg.includes('Bad Request') || code === 'auth/invalid-app-credential') {
        console.error('❌ [SEND-SMS] 400 Bad Request - This might indicate:')
        console.error('  1. Invalid API key or API key restrictions')
        console.error('  2. Domain not authorized in Firebase Console')
        console.error('  3. reCAPTCHA Enterprise not properly configured')
        console.error('  4. reCAPTCHA site key mismatch')
        console.error('  5. Check Firebase Console → Authentication → Settings → reCAPTCHA')
      }

      if (code === 'auth/invalid-app-credential') {
        setError(t.invalidAppCredential)
      } else if (code === 'auth/too-many-requests') {
        setError(t.tooManyAttempts)
        hasAttemptedSendRef.current = true
        setResendCooldown(60)
      } else if (code === 'auth/internal-error' || msg.includes('recaptcha') || msg.includes('already been rendered')) {
        setError(t.recaptchaError)
      } else if (msg.includes('400') || msg.includes('Bad Request') || code === 'auth/network-request-failed') {
        // 400 Bad Request usually means API key restrictions or domain issues
        setError('Phone verification failed. Please check: 1) API key restrictions in Firebase Console, 2) Domain authorization (localhost), 3) reCAPTCHA configuration.')
      } else {
        setError(t.errorSendingSms)
      }
    } finally {
      setBusy(false)
    }
  }

  async function handleVerifyCode() {
    if (!firebaseUser || !pendingSignup || !verificationId || !code.trim()) return

    setBusy(true)
    setError(null)

    try {
      const credential = PhoneAuthProvider.credential(verificationId, code.trim())
      await updatePhoneNumber(firebaseUser, credential)

      const token = await firebaseUser.getIdToken()
      const res = await fetch('/api/auth/complete-signup', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          firstName: pendingSignup.firstName,
          lastName: pendingSignup.lastName,
          phone: pendingSignup.phone,
          language: pendingSignup.language,
          gender: pendingSignup.gender || null,
          addressStreet: pendingSignup.addressStreet || null,
          addressStreetNumber: pendingSignup.addressStreetNumber || null,
          addressFloor: pendingSignup.addressFloor || null,
          addressApt: pendingSignup.addressApt || null,
          isNewsletter: pendingSignup.isNewsletter
        })
      })

      const json = await res.json().catch(() => null)

      if (!res.ok || !json || !json.ok) {
        throw new Error(json?.error || `HTTP ${res.status}`)
      }

      sessionStorage.removeItem('pendingSignup')
      router.replace(`/${lng}/profile`)
    } catch (err: any) {
      console.error('Error verifying code:', err)
      const code = typeof err?.code === 'string' ? err.code : ''
      const msg = typeof err?.message === 'string' ? err.message : ''

      if (code === 'auth/invalid-verification-code') {
        setError(t.invalidCode)
      } else if (code === 'auth/code-expired') {
        setError(t.codeExpired)
      } else if (msg.includes('Phone number is already in use')) {
        setError('Phone number is already in use')
      } else {
        setError(t.errorVerifying)
      }
    } finally {
      setBusy(false)
    }
  }

  async function handleCancelSignup() {
    if (!firebaseUser) return

    const confirmed = window.confirm(t.cancelConfirm)
    if (!confirmed) return

    setBusy(true)
    setError(null)

    try {
      const token = await firebaseUser.getIdToken()
      await fetch('/api/auth/cancel-signup', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      })

      sessionStorage.removeItem('pendingSignup')
      router.replace(`/${lng}`)
    } catch (err: any) {
      console.error('Error cancelling signup:', err)
      setError('Error cancelling signup. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  if (authLoading || !pendingSignup) {
    return (
      <ProfileShell title={t.title} subtitle={t.subtitle}>
        <div className={profileTheme.section}>
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-2/3" />
            <div className="h-4 bg-gray-200 rounded w-1/2" />
            <div className="h-10 bg-gray-200 rounded w-full" />
          </div>
        </div>
      </ProfileShell>
    )
  }

  const greeting = t.greeting
    .replace('{firstName}', pendingSignup.firstName)
    .replace('{lastName}', pendingSignup.lastName)
  const smsSent = t.smsSent.replace('{phone}', pendingSignup.phone)

  return (
    <ProfileShell title={t.title} subtitle={t.subtitle}>
      <div className={profileTheme.section}>
        {error && (
          <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-slate-900">{greeting}</h2>
            <p className="mt-2 text-sm text-slate-600">{smsSent}</p>
            {verificationId && (
              <div className="mt-4 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                <p className="font-medium mb-1">💡 {t.testModeInfo}</p>
                <p className="text-xs mt-1">{t.noSmsReceived}</p>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <label className={profileTheme.label}>{t.enterCode}</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder={t.codePlaceholder}
                className={profileTheme.input}
                disabled={busy || !verificationId}
                autoComplete="one-time-code"
              />
            </div>

            <button
              type="button"
              onClick={handleVerifyCode}
              disabled={!code.trim() || code.length !== 6 || busy || !verificationId}
              className={profileTheme.buttonPrimary}
            >
              {busy ? t.verifying : t.verify}
            </button>

            <div className="flex items-center justify-between border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={() => {
                  hasAttemptedSendRef.current = false
                  void sendSmsCode()
                }}
                disabled={busy || resendCooldown > 0 || !recaptchaVerifier}
                className="text-sm font-medium text-slate-700 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {busy
                  ? t.resending
                  : resendCooldown > 0
                  ? t.waitSeconds.replace('{seconds}', String(resendCooldown))
                  : t.resend}
              </button>

              <button
                type="button"
                onClick={handleCancelSignup}
                disabled={busy}
                className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {busy ? t.cancelling : t.cancel}
              </button>
            </div>
          </div>
        </div>

        {/* Hidden recaptcha container */}
        <div id="recaptcha-container" style={{ display: 'none' }} />
      </div>
    </ProfileShell>
  )
}
