'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  GoogleAuthProvider,
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
  type User
} from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useAuth } from '@/app/contexts/AuthContext'
import ProfileShell from '@/app/components/profile/ProfileShell'
import { profileTheme } from '@/app/components/profile/profileTheme'
import { normalizeIsraelE164, isValidIsraelE164 } from '@/lib/phone'
import { getLanguageDirection } from '@/i18n/settings'
import { Input } from '@/app/components/ui/input'
import { Button } from '@/app/components/ui/button'
import { Label } from '@/app/components/ui/label'
import { IsraelPhoneInput } from '@/app/components/ui/israel-phone-input'
import { Checkbox } from '@/app/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select'
import { cn } from '@/lib/utils'

type SyncResponse =
  | { ok: true; needsProfileCompletion: boolean }
  | { error: string }

// Translations
const translations = {
  en: {
    title: 'Sign Up',
    subtitle: 'Create your account to get started',
    personalInfo: 'Personal Information',
    firstName: 'First Name',
    lastName: 'Last Name',
    email: 'Email Address',
    confirmEmail: 'Confirm Email Address',
    password: 'Password',
    passwordPlaceholder: 'At least 6 characters',
    phone: 'Phone Number',
    phonePlaceholder: '501234567',
    prefferedStyle: 'I am primarily interested in:',
    mens: 'Mens',
    womens: 'Womens',
    other: 'Both',
    preferredLanguage: 'Preferred Language',
    selectLanguage: 'Select Language',
    english: 'English',
    hebrew: 'Hebrew',
    birthday: 'Birthday',
    selectDate: 'Select date',
    selectYear: 'Year',
    selectMonth: 'Month',
    selectDay: 'Day',
    address: 'Address',
    city: 'City',
    streetName: 'Street Name',
    streetNumber: 'Street Number',
    floor: 'Floor',
    apt: 'Apt',
    newsletter: 'Subscribe to Newsletter',
    newsletterDescription: 'Yes, send me updates and offers',
    googleSignIn: 'Sign up with Google',
    orDivider: 'OR',
    continueWithEmail: 'Continue with Email',
    saveProfile: 'Save Profile',
    saving: 'Saving…',
    working: 'Working…',
    signedInWithGoogle: 'Signed in with Google',
    firstNameRequired: 'First name is required',
    lastNameRequired: 'Last name is required',
    emailRequired: 'Email is required',
    confirmEmailRequired: 'Please confirm your email',
    emailInvalid: 'Email must look like name@example.com',
    emailMismatch: 'Emails do not match. Please check and try again.',
    passwordRequired: 'Password must be at least 6 characters',
    phoneRequired: 'Phone number is required',
    phoneInvalid: 'Enter a valid Israeli phone number: +972 followed by 8-9 digits (e.g., +972501234567)',
    languageRequired: 'Preferred language is required',
    birthdayRequired: 'Birthday is required',
    cityPlaceholder: 'e.g., Tel Aviv',
    streetNamePlaceholder: 'e.g., Rothschild Boulevard',
    streetNumberPlaceholder: 'e.g., 123',
    floorPlaceholder: 'e.g., 2',
    aptPlaceholder: 'e.g., 5'
  },
  he: {
    title: 'קצת פרטים כדי שנכיר אותך :)',
    subtitle: 'צרו את החשבון שלכם כדי להתחיל',
    personalInfo: 'מידע אישי',
    firstName: 'שם פרטי',
    lastName: 'שם משפחה',
    email: 'כתובת אימייל',
    confirmEmail: 'אימות כתובת אימייל',
    password: 'סיסמה',
    passwordPlaceholder: 'לפחות 6 תווים',
    phone: 'מספר טלפון',
    phonePlaceholder: '501234567',
    prefferedStyle: 'בעיקר מתעניין ב:',
    mens: 'מוצרים לגבר',
    womens: 'מוצרים לנשים',
    other: 'גם וגם',
    preferredLanguage: 'שפה מועדפת',
    selectLanguage: 'בחר שפה',
    english: 'אנגלית',
    hebrew: 'עברית',
    birthday: 'תאריך לידה',
    selectDate: 'בחר תאריך',
    selectYear: 'שנה',
    selectMonth: 'חודש',
    selectDay: 'יום',
    address: 'כתובת',
    city: 'עיר',
    streetName: 'שם רחוב',
    streetNumber: 'מספר בית',
    floor: 'קומה',
    apt: 'דירה',
    newsletter: 'הרשמה לניוזלטר',
    newsletterDescription: 'כן, שלחו לי עדכונים והצעות',
    googleSignIn: 'הרשמה עם Google',
    orDivider: 'או',
    continueWithEmail: 'המשך עם אימייל',
    saveProfile: 'שמור פרופיל',
    saving: 'שומר…',
    working: 'עובד…',
    signedInWithGoogle: 'מחובר עם Google',
    firstNameRequired: 'שם פרטי הוא חובה',
    lastNameRequired: 'שם משפחה הוא חובה',
    emailRequired: 'אימייל הוא חובה',
    confirmEmailRequired: 'נא לאמת את האימייל',
    emailInvalid: 'אימייל חייב להיות בפורמט name@example.com',
    emailMismatch: 'האימיילים אינם זהים. בדקו ונסו שוב.',
    passwordRequired: 'סיסמה חייבת להיות לפחות 6 תווים',
    phoneRequired: 'מספר טלפון הוא חובה',
    phoneInvalid: 'הזינו מספר ישראלי תקין: 972+ ואחריו 8-9 ספרות (לדוגמה: 972501234567+)',
    languageRequired: 'שפה מועדפת היא חובה',
    birthdayRequired: 'תאריך לידה הוא חובה',
    cityPlaceholder: 'לדוגמה, תל אביב',
    streetNamePlaceholder: 'לדוגמה, שדרות רוטשילד',
    streetNumberPlaceholder: 'לדוגמה, 123',
    floorPlaceholder: 'לדוגמה, 2',
    aptPlaceholder: 'לדוגמה, 5'
  }
}

// Move redirectChecked ref outside component to persist across re-mounts
let redirectChecked = false

export default function SignUpPage() {
  const router = useRouter()
  const params = useParams()
  const lng = (params?.lng as string) || 'en'
  const t = translations[lng as keyof typeof translations] || translations.en
  const isRTL = lng === 'he'
  const direction = isRTL ? 'rtl' : 'ltr'

  const { user: firebaseUser, loading: authLoading, logout } = useAuth()

  // Prevent a brief flash of the sign-up/profile form for already-onboarded users.
  // We first check `/api/me/sync` to know whether profile completion is required.
  const [profileGate, setProfileGate] = useState<'idle' | 'checking' | 'needs_form' | 'redirecting'>('idle')

  // Profile form fields
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phoneLocalNumber, setPhoneLocalNumber] = useState('') // Local number only (8-9 digits)
  const [gender, setGender] = useState('')
  const [language, setLanguage] = useState('')
  const [birthYear, setBirthYear] = useState('')
  const [birthMonth, setBirthMonth] = useState('')
  const [birthDay, setBirthDay] = useState('')
  const [city, setCity] = useState('')
  const [streetName, setStreetName] = useState('')
  const [streetNumber, setStreetNumber] = useState('')
  const [floor, setFloor] = useState('')
  const [apt, setApt] = useState('')
  const [isNewsletter, setIsNewsletter] = useState(true) // Default to true
  
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [serverFieldErrors, setServerFieldErrors] = useState<Record<string, string>>({})
  const [isSignedInWithGoogle, setIsSignedInWithGoogle] = useState(false)
  const [showEmailForm, setShowEmailForm] = useState(false)
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  const syncedUidRef = useRef<string | null>(null)

  // Helper function to get days in a month (handles leap years)
  const getDaysInMonth = (year: number, month: number): number => {
    return new Date(year, month, 0).getDate()
  }

  // Helper function to validate date
  const isValidDate = (year: string, month: string, day: string): boolean => {
    if (!year || !month || !day) return false
    const y = parseInt(year, 10)
    const m = parseInt(month, 10)
    const d = parseInt(day, 10)
    if (isNaN(y) || isNaN(m) || isNaN(d)) return false
    const daysInMonth = getDaysInMonth(y, m)
    return d >= 1 && d <= daysInMonth
  }

  // Generate year options (1940-2020)
  const yearOptions = Array.from({ length: 2020 - 1940 + 1 }, (_, i) => 1940 + i).reverse()

  // Generate month options (1-12)
  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1)

  // Get day options based on selected year and month
  const dayOptions = useMemo(() => {
    if (!birthYear || !birthMonth) {
      return Array.from({ length: 31 }, (_, i) => i + 1)
    }
    const year = parseInt(birthYear, 10)
    const month = parseInt(birthMonth, 10)
    if (isNaN(year) || isNaN(month)) {
      return Array.from({ length: 31 }, (_, i) => i + 1)
    }
    const daysInMonth = getDaysInMonth(year, month)
    return Array.from({ length: daysInMonth }, (_, i) => i + 1)
  }, [birthYear, birthMonth])

  // Reset day if it's invalid for the selected month/year
  useEffect(() => {
    if (birthYear && birthMonth && birthDay) {
      const year = parseInt(birthYear, 10)
      const month = parseInt(birthMonth, 10)
      const day = parseInt(birthDay, 10)
      if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
        const daysInMonth = getDaysInMonth(year, month)
        if (day > daysInMonth) {
          setBirthDay('')
        }
      }
    }
  }, [birthYear, birthMonth, birthDay])

  // Validation
  const validationErrors = useMemo(() => {
    const normalizeEmail = (v: string) => v.trim().toLowerCase()
    const isValidEmail = (v: string) => /\S+@\S+\.\S+/.test(v)

    const errors: Record<string, string> = {}
    if (!firstName.trim()) errors.firstName = t.firstNameRequired
    if (!lastName.trim()) errors.lastName = t.lastNameRequired
    if (!email.trim()) {
      errors.email = t.emailRequired
    } else if (!isValidEmail(normalizeEmail(email))) {
      errors.email = t.emailInvalid
    }
    // Construct full E.164 number from local number
    const fullPhone = phoneLocalNumber ? `+972${phoneLocalNumber}` : ''
    if (!phoneLocalNumber.trim()) {
      errors.phone = t.phoneRequired
    } else if (!isValidIsraelE164(fullPhone)) {
      errors.phone = t.phoneInvalid
    }
    if (!language.trim()) errors.language = t.languageRequired
    if (!birthYear || !birthMonth || !birthDay) {
      errors.birthday = t.birthdayRequired
    } else if (!isValidDate(birthYear, birthMonth, birthDay)) {
      errors.birthday = t.birthdayRequired
    }
    return errors
  }, [firstName, lastName, email, phoneLocalNumber, language, birthYear, birthMonth, birthDay, t])

  const canSubmit = useMemo(() => {
    return (
      Object.keys(validationErrors).length === 0 &&
      Object.keys(serverFieldErrors).length === 0 &&
      !busy
    )
  }, [validationErrors, serverFieldErrors, busy])

  function formatAuthError(e: any, fallback: string) {
    const code = typeof e?.code === 'string' ? e.code : ''
    const msg = typeof e?.message === 'string' ? e.message : ''
    if (code && msg) return `${code}: ${msg}`
    if (code) return code
    if (msg) return msg
    return fallback
  }

  async function checkProfileAndRedirect(user: User): Promise<'needs_form' | 'redirecting'> {
    const token = await user.getIdToken()
    const syncRes = await fetch('/api/me/sync', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    })
    const syncJson = (await syncRes.json().catch(() => null)) as
      | { ok: true; needsProfileCompletion: boolean }
      | { error: string }
      | null

    if (!syncRes.ok || !syncJson || 'error' in syncJson) {
      // If sync fails, fall back to current page behavior (show form).
      return 'needs_form'
    }

    if (syncJson.needsProfileCompletion === false) {
      // Existing user with complete profile - redirect to profile
      setProfileGate('redirecting')
      router.replace(`/${lng}/profile`)
      return 'redirecting'
    }

      // New user or incomplete profile - keep them on the form
      return 'needs_form'
  }

  function isGoogleAccount(user: User) {
    return (user.providerData || []).some((p) => p.providerId === 'google.com')
  }

  async function storeSignupDataAndRedirectToSmsVerify(user: User) {
    // Store pending signup data in sessionStorage
    const fullPhone = phoneLocalNumber ? `+972${phoneLocalNumber}` : ''
    const normalizedPhone = normalizeIsraelE164(fullPhone) || ''
    const pendingSignup = {
      uid: user.uid,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: normalizedPhone,
      language: language === 'he' || language === 'en' ? language : 'en',
      gender: gender || undefined,
      birthday: birthYear && birthMonth && birthDay 
        ? new Date(parseInt(birthYear, 10), parseInt(birthMonth, 10) - 1, parseInt(birthDay, 10)).toISOString()
        : undefined,
      city: city || undefined,
      streetName: streetName || undefined,
      streetNumber: streetNumber || undefined,
      floor: floor || undefined,
      apt: apt || undefined,
      isNewsletter
    }

    sessionStorage.setItem('pendingSignup', JSON.stringify(pendingSignup))

    // Redirect to SMS verification page
    router.push(`/${lng}/verify-sms`)
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
        
        if (result?.user) {
          // Redirect result found! Populate email and show form
          setBusy(true)
          setProfileGate('checking')
        setEmail(result.user.email || '')
        setIsSignedInWithGoogle(isGoogleAccount(result.user))
        const next = await checkProfileAndRedirect(result.user)
          if (!cancelled) setProfileGate(next === 'needs_form' ? 'needs_form' : 'redirecting')
          if (!cancelled) setBusy(false)
        }
      } catch (e: any) {
        if (cancelled) return
        // If there was no redirect in progress, Firebase may throw depending on version.
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
      } finally {
        if (!cancelled) setBusy(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  // Populate email from existing Firebase session (safety net for when redirect result is consumed elsewhere)
  useEffect(() => {
    if (authLoading) return
    if (!firebaseUser) return
    if (syncedUidRef.current === firebaseUser.uid) return
    syncedUidRef.current = firebaseUser.uid

    // Populate email and show form if signed in
    setBusy(true)
    setProfileGate('checking')
    setEmail(firebaseUser.email || '')
    setIsSignedInWithGoogle(isGoogleAccount(firebaseUser))
    void (async () => {
      try {
        const next = await checkProfileAndRedirect(firebaseUser)
        setProfileGate(next === 'needs_form' ? 'needs_form' : 'redirecting')
      } finally {
        setBusy(false)
      }
    })()
  }, [firebaseUser, authLoading])

  async function handleGoogleSignIn() {
    setBusy(true)
    setError(null)
    try {
      const provider = new GoogleAuthProvider()
      provider.setCustomParameters({ prompt: 'select_account' })
      try {
        const cred = await signInWithPopup(auth, provider)
        setEmail(cred.user.email || '')
        setIsSignedInWithGoogle(true)
        await checkProfileAndRedirect(cred.user)
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
      setError(formatAuthError(e, 'Google sign in failed'))
    } finally {
      setBusy(false)
    }
  }

  async function handleSubmit() {
    // Mark all required fields as touched
    setTouched({
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      language: true,
      birthday: true
    })

    // Check if there are validation errors
    if (Object.keys(validationErrors).length > 0) {
      return
    }

    setBusy(true)
    setError(null)
    setServerFieldErrors({})
    try {
      let user: User | null = firebaseUser

      const normalizedEmail = email.trim().toLowerCase()
      const fullPhone = phoneLocalNumber ? `+972${phoneLocalNumber}` : ''
      const normalizedPhone = normalizeIsraelE164(fullPhone)

      if (!normalizedPhone) {
        setError('Invalid phone number format')
        return
      }

      // Precheck duplicates before creating/syncing user
      const precheckRes = await fetch('/api/auth/precheck-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, phone: normalizedPhone })
      })
      const precheckJson = (await precheckRes.json().catch(() => null)) as
        | { ok: true }
        | { ok: false; errors?: Record<string, string>; error?: string }
        | null

      if (!precheckRes.ok) {
        if (precheckJson && typeof precheckJson === 'object' && 'errors' in precheckJson && precheckJson.errors) {
          setServerFieldErrors(precheckJson.errors)
          return
        }
        setError('Unable to validate email/phone. Please try again.')
        return
      }

      // If not signed in with Google, we'll create the account server-side during SMS verification
      // For now, we'll proceed with the email-only flow
      if (!isSignedInWithGoogle && !firebaseUser) {
        // Store the signup data and proceed to SMS verification
        // The account will be created server-side during SMS verification
        const fullPhone = phoneLocalNumber ? `+972${phoneLocalNumber}` : ''
        const normalizedPhone = normalizeIsraelE164(fullPhone) || ''
        const pendingSignup = {
          email: normalizedEmail,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: normalizedPhone,
          language: language === 'he' || language === 'en' ? language : 'en',
          gender: gender || undefined,
          birthday: birthYear && birthMonth && birthDay 
        ? new Date(parseInt(birthYear, 10), parseInt(birthMonth, 10) - 1, parseInt(birthDay, 10)).toISOString()
        : undefined,
          city: city || undefined,
          streetName: streetName || undefined,
          streetNumber: streetNumber || undefined,
          floor: floor || undefined,
          apt: apt || undefined,
          isNewsletter
        }

        sessionStorage.setItem('pendingSignup', JSON.stringify(pendingSignup))
        router.push(`/${lng}/verify-sms`)
        return
      }

      if (!user) {
        throw new Error('No user available')
      }

      await storeSignupDataAndRedirectToSmsVerify(user)
    } catch (e: any) {
      setError(formatAuthError(e, 'Failed to create account'))
    } finally {
      setBusy(false)
    }
  }

  async function handleSignOut() {
    setBusy(true)
    setError(null)
    try {
      await logout()
      syncedUidRef.current = null
      redirectChecked = false // Reset the redirect check when signing out
      setIsSignedInWithGoogle(false)
      setShowEmailForm(false)
      setEmail('')
      setFirstName('')
      setLastName('')
      setPhoneLocalNumber('')
      setGender('')
      setLanguage('')
      setBirthYear('')
      setBirthMonth('')
      setBirthDay('')
      setCity('')
      setStreetName('')
      setStreetNumber('')
      setFloor('')
      setApt('')
      setIsNewsletter(true)
      setServerFieldErrors({})
    } catch (e: any) {
      setError(formatAuthError(e, 'Sign out failed'))
    } finally {
      setBusy(false)
    }
  }

  async function handleCancelSignup() {
    if (!firebaseUser) return

    const confirmMessage = lng === 'he' 
      ? 'האם אתם בטוחים? פעולה זו תמחק את החשבון שלכם ותצטרכו להירשם מחדש מההתחלה.'
      : 'Are you sure? This will delete your account and you\'ll need to sign up again from scratch.'
    
    const confirmed = window.confirm(confirmMessage)
    if (!confirmed) return

    setBusy(true)
    setError(null)

    try {
      const token = await firebaseUser.getIdToken()
      await fetch('/api/auth/cancel-signup', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      })

      // Sign out and redirect to home
      await logout()
      router.replace(`/${lng}`)
    } catch (e: any) {
      setError(formatAuthError(e, 'Failed to cancel signup'))
    } finally {
      setBusy(false)
    }
  }

  const renderButtonsOnly = !isSignedInWithGoogle && !firebaseUser && !showEmailForm
  const shouldGateExistingUser = Boolean(firebaseUser) && profileGate !== 'needs_form'
  const renderForm = (isSignedInWithGoogle || firebaseUser || showEmailForm) && !shouldGateExistingUser

  // While Firebase session is resolving, avoid UI flicker.
  if (authLoading) {
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

  return (
      <ProfileShell
        title={t.title}
      >
      <div className={profileTheme.section} dir={direction}>
        {error ? (
          <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {/* Gate: if already signed in, check whether profile completion is needed before showing the form */}
        {shouldGateExistingUser ? (
          <div className="py-10 text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-slate-900" />
            <div className="mt-4 text-sm font-medium text-slate-900">Signing you in…</div>
            <div className="mt-1 text-xs text-slate-500">Just a moment</div>
          </div>
        ) : null}

        {/* Google Sign-In or Email Option */}
        {renderButtonsOnly && (
          <div className="space-y-2">
            <Button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={busy}
              variant="outline"
              className="w-full text-slate-900 hover:text-slate-900 border-[#856D55]/70"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              {busy ? t.working : t.googleSignIn}
            </Button>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-slate-500">{t.orDivider}</span>
              </div>
            </div>

            <Button
              type="button"
              onClick={() => setShowEmailForm(true)}
              disabled={busy}
              variant="outline"
              className="w-full text-slate-900 hover:text-slate-900 border-[#856D55]/70"
            >
              {t.continueWithEmail}
            </Button>
          </div>
        )}

        {/* Profile Form - shown after Google auth or email option selected */}
        {renderForm && (
          <div className="space-y-8">
            {/* Personal Information Section */}
            <section>
              <h2 className={profileTheme.sectionTitle}>{t.personalInfo}</h2>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="firstName" className="text-sm font-medium text-slate-900">
                    {t.firstName} <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(e) => {
                      setTouched((t) => ({ ...t, firstName: true }))
                      setFirstName(e.target.value)
                    }}
                    className={cn(
                      'text-slate-900',
                      touched.firstName && validationErrors.firstName ? 'border-red-500' : ''
                    )}
                  />
                  {touched.firstName && validationErrors.firstName && (
                    <p className="text-xs text-red-600">{validationErrors.firstName}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lastName" className="text-sm font-medium text-slate-900">
                    {t.lastName} <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(e) => {
                      setTouched((t) => ({ ...t, lastName: true }))
                      setLastName(e.target.value)
                    }}
                    className={cn(
                      'text-slate-900',
                      touched.lastName && validationErrors.lastName ? 'border-red-500' : ''
                    )}
                  />
                  {touched.lastName && validationErrors.lastName && (
                    <p className="text-xs text-red-600">{validationErrors.lastName}</p>
                  )}
                </div>

                <div className="sm:col-span-2 space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium text-slate-900">
                    {t.email} <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setTouched((prev) => ({ ...prev, email: true }))
                        setEmail(e.target.value)
                        setServerFieldErrors((prev) => {
                          const next = { ...prev }
                          delete next.email
                          return next
                        })
                      }}
                      disabled={isSignedInWithGoogle}
                      className={cn(
                        'text-slate-900',
                        touched.email && (validationErrors.email || serverFieldErrors.email) ? 'border-red-500' : '',
                        isSignedInWithGoogle && 'bg-slate-50'
                      )}
                    />
                    {isSignedInWithGoogle && (
                      <div className={cn(
                        "absolute top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-xs text-slate-500 bg-white px-2 py-0.5 rounded",
                        isRTL ? 'left-3' : 'right-3'
                      )}>
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                        <span>{t.signedInWithGoogle}</span>
                      </div>
                    )}
                  </div>
                  {touched.email && (validationErrors.email || serverFieldErrors.email) && (
                    <p className="text-xs text-red-600">{validationErrors.email || serverFieldErrors.email}</p>
                  )}
                </div>

                {!isSignedInWithGoogle && showEmailForm && (
                  <div className="sm:col-span-2">
                    <p className="text-xs text-slate-500">
                      {lng === 'he' 
                        ? 'החשבון ייווצר לאחר אימות SMS'
                        : 'Your account will be created after SMS verification'}
                    </p>
                  </div>
                )}

                <div className="sm:col-span-2 space-y-2">
                  <Label htmlFor="phone" className="text-sm font-medium text-slate-900">
                    {t.phone} <span className="text-red-500">*</span>
                  </Label>
                  <IsraelPhoneInput
                    value={phoneLocalNumber}
                    onChange={(value) => {
                      setTouched((prev) => ({ ...prev, phone: true }))
                      setPhoneLocalNumber(value)
                      setServerFieldErrors((prev) => {
                        const next = { ...prev }
                        delete next.phone
                        return next
                      })
                    }}
                    placeholder={t.phonePlaceholder}
                    disabled={busy}
                    dir={direction}
                    className={touched.phone && (validationErrors.phone || serverFieldErrors.phone) ? 'border-red-500' : ''}
                  />
                  {touched.phone && (validationErrors.phone || serverFieldErrors.phone) && (
                    <p className="text-xs text-red-600">{validationErrors.phone || serverFieldErrors.phone}</p>
                  )}
                </div>

                <div className="sm:col-span-2 space-y-2">
                  <Label htmlFor="gender" className="text-sm font-medium text-slate-900">
                    {t.prefferedStyle}
                  </Label>
                  <Select 
                    value={gender} 
                    onValueChange={setGender} 
                    dir={direction}
                  >
                    <SelectTrigger id="gender" dir={direction}>
                      <SelectValue placeholder={t.prefferedStyle} />
                    </SelectTrigger>
                    <SelectContent dir={direction}>
                      <SelectItem value="mens" dir={direction}>{t.mens}</SelectItem>
                      <SelectItem value="womens" dir={direction}>{t.womens}</SelectItem>
                      <SelectItem value="other" dir={direction}>{t.other}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="sm:col-span-2 space-y-2">
                  <Label htmlFor="language" className="text-sm font-medium text-slate-900">
                    {t.preferredLanguage} <span className="text-red-500">*</span>
                  </Label>
                  <Select 
                    value={language} 
                    onValueChange={(v) => {
                      setTouched((prev) => ({ ...prev, language: true }))
                      setLanguage(v)
                    }} 
                    dir={direction}
                  >
                    <SelectTrigger id="language" dir={direction} className={touched.language && validationErrors.language ? 'border-red-500' : ''}>
                      <SelectValue placeholder={t.selectLanguage} />
                    </SelectTrigger>
                    <SelectContent dir={direction}>
                      <SelectItem value="he" dir={direction}>{t.hebrew}</SelectItem>
                      <SelectItem value="en" dir={direction}>{t.english}</SelectItem>
                    </SelectContent>
                  </Select>
                  {touched.language && validationErrors.language && (
                    <p className="text-xs text-red-600">{validationErrors.language}</p>
                  )}
                </div>

                <div className="sm:col-span-2 space-y-2">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-900">
                      {t.birthday} <span className="text-red-500">*</span>
                    </Label>
                    <div className="grid grid-cols-3 gap-2">
                      {isRTL ? (
                        <>
                          {/* RTL: Year, Month, Day */}
                          <div className="space-y-2">
                            <Label htmlFor="birthYear" className="text-xs text-slate-600">
                              {t.selectYear}
                            </Label>
                            <Select
                              value={birthYear}
                              onValueChange={(value) => {
                                setTouched((prev) => ({ ...prev, birthday: true }))
                                setBirthYear(value)
                              }}
                              dir={direction}
                            >
                              <SelectTrigger 
                                id="birthYear" 
                                dir={direction}
                                className={touched.birthday && validationErrors.birthday ? 'border-red-500' : ''}
                              >
                                <SelectValue placeholder={t.selectYear} />
                              </SelectTrigger>
                              <SelectContent dir={direction}>
                                {yearOptions.map((year) => (
                                  <SelectItem key={year} value={year.toString()} dir={direction}>
                                    {year}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="birthMonth" className="text-xs text-slate-600">
                              {t.selectMonth}
                            </Label>
                            <Select
                              value={birthMonth}
                              onValueChange={(value) => {
                                setTouched((prev) => ({ ...prev, birthday: true }))
                                setBirthMonth(value)
                              }}
                              dir={direction}
                            >
                              <SelectTrigger 
                                id="birthMonth" 
                                dir={direction}
                                className={touched.birthday && validationErrors.birthday ? 'border-red-500' : ''}
                              >
                                <SelectValue placeholder={t.selectMonth} />
                              </SelectTrigger>
                              <SelectContent dir={direction}>
                                {monthOptions.map((month) => (
                                  <SelectItem key={month} value={month.toString()} dir={direction}>
                                    {month}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="birthDay" className="text-xs text-slate-600">
                              {t.selectDay}
                            </Label>
                            <Select
                              value={birthDay}
                              onValueChange={(value) => {
                                setTouched((prev) => ({ ...prev, birthday: true }))
                                setBirthDay(value)
                              }}
                              dir={direction}
                              disabled={!birthYear || !birthMonth}
                            >
                              <SelectTrigger 
                                id="birthDay" 
                                dir={direction}
                                className={touched.birthday && validationErrors.birthday ? 'border-red-500' : ''}
                              >
                                <SelectValue placeholder={t.selectDay} />
                              </SelectTrigger>
                              <SelectContent dir={direction}>
                                {dayOptions.map((day) => (
                                  <SelectItem key={day} value={day.toString()} dir={direction}>
                                    {day}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </>
                      ) : (
                        <>
                          {/* LTR: Day, Month, Year */}
                          <div className="space-y-2">
                            <Label htmlFor="birthDay" className="text-xs text-slate-600">
                              {t.selectDay}
                            </Label>
                            <Select
                              value={birthDay}
                              onValueChange={(value) => {
                                setTouched((prev) => ({ ...prev, birthday: true }))
                                setBirthDay(value)
                              }}
                              dir={direction}
                              disabled={!birthYear || !birthMonth}
                            >
                              <SelectTrigger 
                                id="birthDay" 
                                dir={direction}
                                className={touched.birthday && validationErrors.birthday ? 'border-red-500' : ''}
                              >
                                <SelectValue placeholder={t.selectDay} />
                              </SelectTrigger>
                              <SelectContent dir={direction}>
                                {dayOptions.map((day) => (
                                  <SelectItem key={day} value={day.toString()} dir={direction}>
                                    {day}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="birthMonth" className="text-xs text-slate-600">
                              {t.selectMonth}
                            </Label>
                            <Select
                              value={birthMonth}
                              onValueChange={(value) => {
                                setTouched((prev) => ({ ...prev, birthday: true }))
                                setBirthMonth(value)
                              }}
                              dir={direction}
                            >
                              <SelectTrigger 
                                id="birthMonth" 
                                dir={direction}
                                className={touched.birthday && validationErrors.birthday ? 'border-red-500' : ''}
                              >
                                <SelectValue placeholder={t.selectMonth} />
                              </SelectTrigger>
                              <SelectContent dir={direction}>
                                {monthOptions.map((month) => (
                                  <SelectItem key={month} value={month.toString()} dir={direction}>
                                    {month}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="birthYear" className="text-xs text-slate-600">
                              {t.selectYear}
                            </Label>
                            <Select
                              value={birthYear}
                              onValueChange={(value) => {
                                setTouched((prev) => ({ ...prev, birthday: true }))
                                setBirthYear(value)
                              }}
                              dir={direction}
                            >
                              <SelectTrigger 
                                id="birthYear" 
                                dir={direction}
                                className={touched.birthday && validationErrors.birthday ? 'border-red-500' : ''}
                              >
                                <SelectValue placeholder={t.selectYear} />
                              </SelectTrigger>
                              <SelectContent dir={direction}>
                                {yearOptions.map((year) => (
                                  <SelectItem key={year} value={year.toString()} dir={direction}>
                                    {year}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </>
                      )}
                    </div>
                    {touched.birthday && validationErrors.birthday && (
                      <p className="text-xs text-red-600">{validationErrors.birthday}</p>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* Address Section */}
            <section>
              <h2 className={profileTheme.sectionTitle}>{t.address}</h2>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2 space-y-2">
                  <Label htmlFor="city" className="text-sm font-medium text-slate-900">
                    {t.city}
                  </Label>
                  <Input
                    id="city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder={t.cityPlaceholder}
                    className="text-slate-900"
                  />
                </div>

                <div className="sm:col-span-2 space-y-2">
                  <Label htmlFor="streetName" className="text-sm font-medium text-slate-900">
                    {t.streetName}
                  </Label>
                  <Input
                    id="streetName"
                    value={streetName}
                    onChange={(e) => setStreetName(e.target.value)}
                    placeholder={t.streetNamePlaceholder}
                    className="text-slate-900"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="streetNumber" className="text-sm font-medium text-slate-900">
                    {t.streetNumber}
                  </Label>
                  <Input
                    id="streetNumber"
                    type="text"
                    value={streetNumber}
                    onChange={(e) => setStreetNumber(e.target.value)}
                    placeholder={t.streetNumberPlaceholder}
                    className="text-slate-900"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="floor" className="text-sm font-medium text-slate-900">
                    {t.floor}
                  </Label>
                  <Input
                    id="floor"
                    type="text"
                    value={floor}
                    onChange={(e) => setFloor(e.target.value)}
                    placeholder={t.floorPlaceholder}
                    className="text-slate-900"
                  />
                </div>

                <div className="sm:col-span-2 space-y-2">
                  <Label htmlFor="apt" className="text-sm font-medium text-slate-900">
                    {t.apt}
                  </Label>
                  <Input
                    id="apt"
                    type="text"
                    value={apt}
                    onChange={(e) => setApt(e.target.value)}
                    placeholder={t.aptPlaceholder}
                    className="text-slate-900"
                  />
                </div>
              </div>
            </section>

            {/* Newsletter Section */}
            <section>
              <div className={cn("flex items-start gap-2", isRTL ? "flex-row" : "")}>
                <Checkbox
                  id="newsletter"
                  checked={isNewsletter}
                  onCheckedChange={(checked) => {
                    setIsNewsletter(checked === true)
                  }}
                  className="mt-1 cursor-pointer"
                />
                <div className="space-y-1 leading-none">
                  <Label
                    htmlFor="newsletter"
                    className="text-sm font-medium cursor-pointer text-slate-900"
                  >
                    {t.newsletter}
                  </Label>
                  <p className="text-xs text-slate-500">
                    {t.newsletterDescription}
                  </p>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* Save Profile Button */}
        {renderForm && (
          <div className="mt-8 border-t border-slate-200 pt-6">
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="w-full sm:w-auto bg-[#856D55] text-white hover:bg-[#856D55]/90"
              >
                {busy ? t.saving : t.saveProfile}
              </Button>
              
              {(isSignedInWithGoogle || firebaseUser) && (
                <Button
                  type="button"
                  onClick={handleCancelSignup}
                  disabled={busy}
                  variant="ghost"
                  className="w-full sm:w-auto text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  {lng === 'he' ? 'ביטול הרשמה' : 'Cancel Signup'}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </ProfileShell>
  )
}
