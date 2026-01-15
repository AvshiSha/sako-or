'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/app/contexts/AuthContext'
import ProfileShell from '@/app/components/profile/ProfileShell'
import { profileTheme } from '@/app/components/profile/profileTheme'
import { signInWithCustomToken } from 'firebase/auth'
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
    recaptchaError: 'Security verification failed. Please refresh the page and try again.'
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
    recaptchaError: 'אימות אבטחה נכשל. אנא רעננו את הדף ונסו שוב.'
  }
}

type PendingSignup = {
  uid?: string // Optional - only present for Google signup flow
  email?: string // Required for email-only signup flow
  firstName: string
  lastName: string
  phone: string
  language: string
  birthday?: string // YYYY-MM-DD format
  gender?: string
  city?: string
  streetName?: string
  streetNumber?: string
  floor?: string
  apt?: string
  addressStreet?: string // Legacy field name
  addressStreetNumber?: string // Legacy field name
  addressFloor?: string // Legacy field name
  addressApt?: string // Legacy field name
  isNewsletter: boolean
}

function firebasePhoneVerifyErrorToMessage(err: any): string | null {
  const code = typeof err?.code === 'string' ? err.code : ''
  if (!code.startsWith('auth/')) return null

  switch (code) {
    case 'auth/invalid-verification-code':
      return "That code isn’t correct. Please try again."
    case 'auth/code-expired':
      return 'That code expired. Please request a new code.'
    case 'auth/missing-verification-code':
      return 'Enter the 6-digit code to continue.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a bit and try again.'
    case 'auth/network-request-failed':
      return 'We couldn’t verify the code due to a connection issue. Check your internet and try again.'
    case 'auth/invalid-verification-id':
      return 'This verification session is no longer valid. Please request a new code.'
    case 'auth/missing-verification-id':
      return 'We couldn’t continue verification. Please request a new code.'
    case 'auth/session-expired':
      return 'Your verification session expired. Please request a new code.'
    case 'auth/requires-recent-login':
      return 'For security, please sign in again and retry verification.'
    case 'auth/user-disabled':
      return 'This account is disabled. Contact support if you think this is a mistake.'
    case 'auth/credential-already-in-use':
      return 'That phone number is already linked to another account. Try a different number or sign in.'
    default:
      return 'We couldn’t verify the code right now. Please try again.'
  }
}

export default function VerifySmsPage() {
  const router = useRouter()
  const params = useParams()
  const lng = (params?.lng as string) || 'en'
  const t = translations[lng as keyof typeof translations] || translations.en
  const isRTL = lng === 'he'

  const { user: firebaseUser, loading: authLoading } = useAuth()

  const [pendingSignup, setPendingSignup] = useState<PendingSignup | null>(null)
  const [otpSent, setOtpSent] = useState(false)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resendCooldown, setResendCooldown] = useState(0)
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

    const stored = sessionStorage.getItem('pendingSignup')
    if (!stored) {
      router.replace(`/${lng}/signup`)
      return
    }

    try {
      const parsed = JSON.parse(stored) as PendingSignup
      
      // For Google signup flow, verify UID matches if both exist
      if (parsed.uid && firebaseUser && parsed.uid !== firebaseUser.uid) {
        sessionStorage.removeItem('pendingSignup')
        router.replace(`/${lng}/signup`)
        return
      }
      
      // For email-only flow, email is required
      if (!parsed.uid && !parsed.email) {
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

  // No longer need recaptcha verifier for Inforu OTP

  // Auto-send SMS when component is ready (only once)
  useEffect(() => {
    if (!pendingSignup || otpSent || busy || hasAttemptedSendRef.current) {
      return
    }

    const timer = setTimeout(() => {
      if (!hasAttemptedSendRef.current) {
        hasAttemptedSendRef.current = true
        void sendSmsCode()
      }
    }, 500)

    return () => {
      clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingSignup, otpSent, busy])

  async function sendSmsCode() {
    if (!pendingSignup) {
      return
    }

    if (resendCooldown > 0) {
      return
    }

    setBusy(true)
    setError(null)

    try {
      // Convert phone to local format if needed (Inforu accepts both formats)
      // pendingSignup.phone is already in E.164 format (+972XXXXXXXXX)
      // Convert to local format (0XXXXXXXXX) for Inforu
      let phoneForInforu = pendingSignup.phone
      if (phoneForInforu.startsWith('+972')) {
        phoneForInforu = '0' + phoneForInforu.slice(4)
      }

      // Call Inforu OTP send endpoint (no user existence check for signup flow)
      const res = await fetch('/api/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          otpType: 'sms', 
          otpValue: phoneForInforu,
          checkUserExists: false // Signup flow - user may not exist
        }),
      })

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        if (res.status === 429) {
          if (data?.error === 'COOLDOWN') {
            const cooldownSeconds = data.message?.match(/\d+/)?.[0] || '60'
            setResendCooldown(parseInt(cooldownSeconds))
            setError(data.message || t.waitSeconds.replace('{seconds}', cooldownSeconds))
          } else {
            setError(data?.message || t.tooManyAttempts)
            setResendCooldown(60)
          }
        } else {
          setError(data?.message || t.errorSendingSms)
        }
        return
      }

      setOtpSent(true)
      setResendCooldown(60)
    } catch (err: any) {
      console.error('[SEND-SMS] Error:', err)
      setError(t.errorSendingSms)
    } finally {
      setBusy(false)
    }
  }

  async function handleVerifyCode() {
    if (!pendingSignup || !code.trim() || code.length !== 6) return

    setBusy(true)
    setError(null)

    try {
      // Convert phone to local format if needed (Inforu accepts both formats)
      let phoneForInforu = pendingSignup.phone
      if (phoneForInforu.startsWith('+972')) {
        phoneForInforu = '0' + phoneForInforu.slice(4)
      }

      // Determine flow: Google signup (has uid and firebaseUser) vs email-only (no uid)
      const isGoogleSignup = pendingSignup.uid && firebaseUser && pendingSignup.uid === firebaseUser.uid

      // Call Inforu OTP verify endpoint
      const verifyRes = await fetch('/api/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          otpType: 'sms', 
          otpValue: phoneForInforu,
          otpCode: code.trim(),
          requireUserExists: false, // For Google signup, we're adding phone, not checking if it exists
          existingFirebaseUid: isGoogleSignup ? pendingSignup.uid : undefined // Pass UID for Google signup
        }),
      })

      const data = await verifyRes.json().catch(() => null)

      if (!verifyRes.ok || !data || !data.ok) {
        // Check for expired code specifically
        if (data?.error === 'CODE_EXPIRED') {
          throw new Error('CODE_EXPIRED')
        }
        throw new Error(data?.error || 'Failed to verify code')
      }

      // Sign in with custom token
      const userCredential = await signInWithCustomToken(auth, data.customToken)
      const verifiedUser = userCredential.user
      let token = await verifiedUser.getIdToken()

      // For Google signup flow, user already exists - just need to ensure phone is updated
      // For email-only flow, user was just created
      
      // Link email to the phone-authenticated user if email exists and not already linked
      if (pendingSignup.email && !verifiedUser.email) {
        try {
          const linkRes = await fetch('/api/auth/link-email', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              email: pendingSignup.email
            })
          })

          const linkJson = await linkRes.json().catch(() => null)
          if (!linkRes.ok || !linkJson?.ok) {
            console.warn('[VERIFY] Email linking failed, but continuing:', linkJson?.error)
            // Continue anyway - email can be added later
          } else {
            // Refresh token to get updated user info
            token = await verifiedUser.getIdToken(true)
          }
        } catch (linkErr) {
          console.warn('[VERIFY] Email linking error, but continuing:', linkErr)
          // Continue anyway - email can be added later
        }
      }

      // Prepare address fields (support both new and legacy field names)
      const addressStreet = pendingSignup.streetName || pendingSignup.addressStreet || null
      const addressStreetNumber = pendingSignup.streetNumber || pendingSignup.addressStreetNumber || null
      const addressFloor = pendingSignup.floor || pendingSignup.addressFloor || null
      const addressApt = pendingSignup.apt || pendingSignup.addressApt || null
      const addressCity = pendingSignup.city || null

      console.log('🔵 [VERIFY] Calling complete-signup API...')
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
          birthday: pendingSignup.birthday,
          interestedIn: pendingSignup.gender || null,
          addressStreet,
          addressStreetNumber,
          addressFloor,
          addressApt,
          addressCity,
          isNewsletter: pendingSignup.isNewsletter
        })
      })

      const json = await res.json().catch(() => null)

      if (!res.ok || !json || !json.ok) {
        throw new Error(json?.error || `HTTP ${res.status}`)
      }

      console.log('✅ [VERIFY] Signup completed successfully')
      sessionStorage.removeItem('pendingSignup')
      
      // Refresh token to get latest user info
      token = await verifiedUser.getIdToken(true)
      
      // Sync profile before redirecting to ensure ProfileCompletionGate sees complete profile
      const syncRes = await fetch('/api/me/sync', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      })
      const syncJson = (await syncRes.json().catch(() => null)) as 
        | { ok: true; needsProfileCompletion: boolean }
        | { error: string }
        | null

      if (!syncRes.ok || !syncJson || 'error' in syncJson) {
        console.warn('[VERIFY] Sync failed, but redirecting anyway:', syncJson)
        // Continue anyway - profile should be complete after complete-signup
      } else if (syncJson.needsProfileCompletion === true) {
        // This shouldn't happen after complete-signup, but redirect to signup if needed
        console.warn('[VERIFY] Profile still incomplete after signup, redirecting to signup')
        router.replace(`/${lng}/signup`)
        return
      }
      
      // Wait a moment for AuthContext to update with the new user state
      await new Promise(resolve => setTimeout(resolve, 200))
      
      // Profile is complete - redirect to profile page
      router.replace(`/${lng}/profile`)
    } catch (err: any) {
      console.error('❌ [VERIFY] Error verifying code:', err)
      const msg = typeof err?.message === 'string' ? err.message : ''

      if (msg === 'CODE_EXPIRED' || msg.includes('CODE_EXPIRED')) {
        setError(t.codeExpired)
      } else if (msg.includes('Invalid') || msg.includes('expired')) {
        setError(t.invalidCode)
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
    const confirmed = window.confirm(t.cancelConfirm)
    if (!confirmed) return

    setBusy(true)
    setError(null)

    try {
      // If user is signed in (after phone verification), cancel via API
      if (firebaseUser) {
        const token = await firebaseUser.getIdToken()
        await fetch('/api/auth/cancel-signup', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        })
      }

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
  
  // Format phone for display: convert +972XXXXXXXX to 0XXXXXXXX
  const displayPhone = pendingSignup.phone.startsWith('+972') 
    ? '0' + pendingSignup.phone.slice(4) 
    : pendingSignup.phone
  
  const smsSent = t.smsSent.replace('{phone}', displayPhone)

  return (
    <ProfileShell title={t.title} subtitle={t.subtitle}>
      <div className={profileTheme.section}>
        {error && (
          <div className={`mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 ${isRTL ? 'text-right' : 'text-left'}`} dir={isRTL ? 'rtl' : 'ltr'}>
            {error}
          </div>
        )}

        <div className="space-y-6">
          <div className="text-center" dir={isRTL ? 'rtl' : 'ltr'}>
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
                disabled={busy || !otpSent}
                autoComplete="one-time-code"
              />
            </div>

            <button
              type="button"
              onClick={handleVerifyCode}
              disabled={!code.trim() || code.length !== 6 || busy || !otpSent}
              className={profileTheme.buttonPrimary}
            >
              {busy ? t.verifying : t.verify}
            </button>

            <div className="flex items-center justify-between border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={() => {
                  hasAttemptedSendRef.current = false
                  setOtpSent(false)
                  void sendSmsCode()
                }}
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

      </div>
    </ProfileShell>
  )
}
