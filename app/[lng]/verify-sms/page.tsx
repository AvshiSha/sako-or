'use client'

import { useEffect, useState } from 'react'
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
    cancelConfirm: 'Are you sure? This will delete your account and you\'ll need to sign up again from scratch.'
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
    cancelConfirm: 'האם אתם בטוחים? פעולה זו תמחק את החשבון שלכם ותצטרכו להירשם מחדש מההתחלה.'
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
        // UID mismatch - clear and redirect
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

  // Initialize recaptcha once we have pending signup
  useEffect(() => {
    if (!pendingSignup || recaptchaVerifier) return

    try {
      const verifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
        callback: () => {
          // reCAPTCHA solved - allow SMS
        }
      })
      setRecaptchaVerifier(verifier)
    } catch (err) {
      console.error('Error initializing recaptcha:', err)
    }
  }, [pendingSignup, recaptchaVerifier])

  // Auto-send SMS when component is ready
  useEffect(() => {
    if (!pendingSignup || !recaptchaVerifier || verificationId || busy) return

    void sendSmsCode()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingSignup, recaptchaVerifier])

  async function sendSmsCode() {
    if (!firebaseUser || !pendingSignup || !recaptchaVerifier) return

    setBusy(true)
    setError(null)

    try {
      // Phone is already in E.164 format from signup
      const e164Phone = pendingSignup.phone

      const provider = new PhoneAuthProvider(auth)
      const verId = await provider.verifyPhoneNumber(e164Phone, recaptchaVerifier)

      setVerificationId(verId)
      setResendCooldown(60)
    } catch (err: any) {
      console.error('Error sending SMS:', err)
      const code = typeof err?.code === 'string' ? err.code : ''
      if (code === 'auth/too-many-requests') {
        setError(t.tooManyAttempts)
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
      // Create phone credential
      const credential = PhoneAuthProvider.credential(verificationId, code.trim())

      // Update user's phone number in Firebase
      await updatePhoneNumber(firebaseUser, credential)

      // Call backend to create Neon user
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

      // Clear pending signup
      sessionStorage.removeItem('pendingSignup')

      // Redirect to profile
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

      // Clear pending signup
      sessionStorage.removeItem('pendingSignup')

      // Redirect to home
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
                onClick={sendSmsCode}
                disabled={busy || resendCooldown > 0}
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
        <div id="recaptcha-container" />
      </div>
    </ProfileShell>
  )
}

