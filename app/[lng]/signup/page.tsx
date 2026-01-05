'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
  type User
} from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useAuth } from '@/app/contexts/AuthContext'
import ProfileShell from '@/app/components/profile/ProfileShell'
import { profileTheme } from '@/app/components/profile/profileTheme'
import {
  Checkbox,
  Field,
  RadioGroup,
  SelectInput,
  TextInput
} from '@/app/components/profile/ProfileFormFields'
import { normalizeIsraelE164, isValidIsraelE164 } from '@/lib/phone'

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
    phonePlaceholder: '+972501234567',
    gender: 'Gender',
    male: 'Male',
    female: 'Female',
    other: 'Other',
    preferredLanguage: 'Preferred Language',
    selectLanguage: 'Select Language',
    english: 'English',
    hebrew: 'Hebrew',
    address: 'Address',
    streetAddress: 'Street Address',
    streetPlaceholder: 'e.g., 123 Main St',
    aptFloor: 'Apt / Floor',
    aptPlaceholder: 'Apt 5 / Floor 2',
    city: 'City',
    cityPlaceholder: 'e.g., New York',
    postalCode: 'Postal Code',
    postalPlaceholder: 'e.g., 10001',
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
    languageRequired: 'Preferred language is required'
  },
  he: {
    title: 'הרשמה',
    subtitle: 'צרו את החשבון שלכם כדי להתחיל',
    personalInfo: 'מידע אישי',
    firstName: 'שם פרטי',
    lastName: 'שם משפחה',
    email: 'כתובת אימייל',
    confirmEmail: 'אימות כתובת אימייל',
    password: 'סיסמה',
    passwordPlaceholder: 'לפחות 6 תווים',
    phone: 'מספר טלפון',
    phonePlaceholder: '972501234567+',
    gender: 'מגדר',
    male: 'זכר',
    female: 'נקבה',
    other: 'אחר',
    preferredLanguage: 'שפה מועדפת',
    selectLanguage: 'בחר שפה',
    english: 'אנגלית',
    hebrew: 'עברית',
    address: 'כתובת',
    streetAddress: 'רחוב',
    streetPlaceholder: 'לדוגמה, רחוב הרצל 123',
    aptFloor: 'דירה / קומה',
    aptPlaceholder: 'דירה 5 / קומה 2',
    city: 'עיר',
    cityPlaceholder: 'לדוגמה, תל אביב',
    postalCode: 'מיקוד',
    postalPlaceholder: 'לדוגמה, 12345',
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
    languageRequired: 'שפה מועדפת היא חובה'
  }
}

// Move redirectChecked ref outside component to persist across re-mounts
let redirectChecked = false

export default function SignUpPage() {
  const router = useRouter()
  const params = useParams()
  const lng = (params?.lng as string) || 'en'
  const t = translations[lng as keyof typeof translations] || translations.en

  const { user: firebaseUser, loading: authLoading, logout } = useAuth()

  // Prevent a brief flash of the sign-up/profile form for already-onboarded users.
  // We first check `/api/me/sync` to know whether profile completion is required.
  const [profileGate, setProfileGate] = useState<'idle' | 'checking' | 'needs_form' | 'redirecting'>('idle')

  // Profile form fields
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [confirmEmail, setConfirmEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [gender, setGender] = useState('')
  const [language, setLanguage] = useState('')
  const [addressStreet, setAddressStreet] = useState('')
  const [addressApt, setAddressApt] = useState('')
  const [city, setCity] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [isNewsletter, setIsNewsletter] = useState(false)
  
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [serverFieldErrors, setServerFieldErrors] = useState<Record<string, string>>({})
  const [isSignedInWithGoogle, setIsSignedInWithGoogle] = useState(false)
  const [showEmailForm, setShowEmailForm] = useState(false)
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  // #region agent log
  useEffect(() => {
  }, [busy])
  // #endregion

  const syncedUidRef = useRef<string | null>(null)

  // #region agent log
  useEffect(() => {
  }, [])
  // #endregion

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
    if (!isSignedInWithGoogle && showEmailForm) {
      if (!confirmEmail.trim()) {
        errors.confirmEmail = t.confirmEmailRequired
      } else if (normalizeEmail(confirmEmail) !== normalizeEmail(email)) {
        errors.confirmEmail = t.emailMismatch
      }
    }
    if (!isSignedInWithGoogle && password.length < 6) errors.password = t.passwordRequired
    if (!phone.trim()) {
      errors.phone = t.phoneRequired
    } else if (!isValidIsraelE164(normalizeIsraelE164(phone))) {
      errors.phone = t.phoneInvalid
    }
    if (!language.trim()) errors.language = t.languageRequired
    return errors
  }, [firstName, lastName, email, confirmEmail, password, phone, language, isSignedInWithGoogle, showEmailForm, t])

  const canSubmit = useMemo(() => {
    return (
      Object.keys(validationErrors).length === 0 &&
      Object.keys(serverFieldErrors).length === 0 &&
      !busy &&
      (isSignedInWithGoogle || password.length >= 6)
    )
  }, [validationErrors, serverFieldErrors, busy, isSignedInWithGoogle, password])

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
    setShowEmailForm(false)
    return 'needs_form'
  }

  function isGoogleAccount(user: User) {
    return (user.providerData || []).some((p) => p.providerId === 'google.com')
  }

  async function storeSignupDataAndRedirectToSmsVerify(user: User) {
    // Store pending signup data in sessionStorage
    const normalizedPhone = normalizeIsraelE164(phone) || ''
    const pendingSignup = {
      uid: user.uid,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: normalizedPhone,
      language: language === 'he' || language === 'en' ? language : 'en',
      gender: gender || undefined,
      addressStreet: addressStreet || undefined,
      addressStreetNumber: undefined,
      addressFloor: undefined,
      addressApt: addressApt || undefined,
      isNewsletter
    }

    sessionStorage.setItem('pendingSignup', JSON.stringify(pendingSignup))

    // Redirect to SMS verification page
    router.push(`/${lng}/verify-sms`)
  }

  // Complete Google redirect sign-in (fallback when popups are blocked)
  useEffect(() => {
    // #region agent log
    // #endregion
    if (redirectChecked) return
    redirectChecked = true

    let cancelled = false
    ;(async () => {
      try {
        // #region agent log
        // #endregion
        setError(null)
        const result = await getRedirectResult(auth)
        // #region agent log
        // #endregion
        if (cancelled) return
        
        if (result?.user) {
          // Redirect result found! Populate email and show form
          // #region agent log
          // #endregion
          setBusy(true)
          setProfileGate('checking')
          setEmail(result.user.email || '')
          setIsSignedInWithGoogle(isGoogleAccount(result.user))
          setShowEmailForm(false)
          const next = await checkProfileAndRedirect(result.user)
          if (!cancelled) setProfileGate(next === 'needs_form' ? 'needs_form' : 'redirecting')
          if (!cancelled) setBusy(false)
        }
      } catch (e: any) {
        // #region agent log
        // #endregion
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
      // #region agent log
      // #endregion
      cancelled = true
    }
  }, [])

  // Populate email from existing Firebase session (safety net for when redirect result is consumed elsewhere)
  useEffect(() => {
    // #region agent log
    // #endregion
    if (authLoading) return
    if (!firebaseUser) return
    if (syncedUidRef.current === firebaseUser.uid) return
    syncedUidRef.current = firebaseUser.uid

    // #region agent log
    // #endregion

    // Populate email and show form if signed in
    setBusy(true)
    setProfileGate('checking')
    setEmail(firebaseUser.email || '')
    setIsSignedInWithGoogle(isGoogleAccount(firebaseUser))
    setShowEmailForm(false)
    void (async () => {
      try {
        const next = await checkProfileAndRedirect(firebaseUser)
        setProfileGate(next === 'needs_form' ? 'needs_form' : 'redirecting')
      } finally {
        setBusy(false)
      }
    })()
    
    // #region agent log
    // #endregion
  }, [firebaseUser, authLoading])

  async function handleGoogleSignIn() {
    // #region agent log
    // #endregion
    setBusy(true)
    setError(null)
    try {
      const provider = new GoogleAuthProvider()
      provider.setCustomParameters({ prompt: 'select_account' })
      try {
        // #region agent log
        // #endregion
        const cred = await signInWithPopup(auth, provider)
        // #region agent log
        // #endregion
        setEmail(cred.user.email || '')
        setIsSignedInWithGoogle(true)
        setShowEmailForm(false)
        await checkProfileAndRedirect(cred.user)
        // #region agent log
        // #endregion
        return
      } catch (e: any) {
        const code = typeof e?.code === 'string' ? e.code : ''
        // #region agent log
        // #endregion
        if (
          code === 'auth/popup-blocked' ||
          code === 'auth/popup-closed-by-user' ||
          code === 'auth/cancelled-popup-request'
        ) {
          // #region agent log
          // #endregion
          await signInWithRedirect(auth, provider)
          return
        }
        throw e
      }
    } catch (e: any) {
      const code = typeof e?.code === 'string' ? e.code : ''
      // #region agent log
      // #endregion
      if (code === 'auth/account-exists-with-different-credential') {
        setError(
          'An account already exists with the same email but a different sign-in method. Please sign in with Email/Password first.'
        )
      } else {
        setError(formatAuthError(e, 'Google sign in failed'))
      }
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
      confirmEmail: !isSignedInWithGoogle && showEmailForm,
      password: !isSignedInWithGoogle,
      phone: true,
      language: true
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
      const normalizedPhone = normalizeIsraelE164(phone)

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

      // If not already signed in with Google, create/sign in with email
      if (!isSignedInWithGoogle && !firebaseUser) {
        const cred = await createUserWithEmailAndPassword(auth, normalizedEmail, password)
        user = cred.user
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
      setConfirmEmail('')
      setFirstName('')
      setLastName('')
      setPhone('')
      setGender('')
      setLanguage('')
      setAddressStreet('')
      setAddressApt('')
      setCity('')
      setPostalCode('')
      setIsNewsletter(false)
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

  // #region agent log
  const renderButtonsOnly = !isSignedInWithGoogle && !firebaseUser && !showEmailForm
  const shouldGateExistingUser = Boolean(firebaseUser) && profileGate !== 'needs_form'
  const renderForm = (isSignedInWithGoogle || firebaseUser || showEmailForm) && !shouldGateExistingUser
  useEffect(() => {
  }, [renderButtonsOnly, renderForm, isSignedInWithGoogle, firebaseUser, showEmailForm, busy])
  // #endregion

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
      subtitle={t.subtitle}
    >
      <div className={profileTheme.section}>
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
        {!isSignedInWithGoogle && !firebaseUser && !showEmailForm && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={busy}
              className="w-full flex items-center justify-center gap-3 rounded-md border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              {busy ? t.working : t.googleSignIn}
            </button>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-slate-500">{t.orDivider}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowEmailForm(true)}
              disabled={busy}
              className="w-full flex items-center justify-center gap-3 rounded-md border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {t.continueWithEmail}
            </button>
          </div>
        )}

        {/* Profile Form - shown after Google auth or email option selected */}
        {!shouldGateExistingUser && (isSignedInWithGoogle || firebaseUser || showEmailForm) && (
          <div className="space-y-8">
            {/* Personal Information Section */}
            <section>
              <h2 className={profileTheme.sectionTitle}>{t.personalInfo}</h2>
              <div className={profileTheme.grid}>
                <Field
                  label={t.firstName}
                  error={touched.firstName ? validationErrors.firstName : null}
                >
                  <TextInput
                    value={firstName}
                    onChange={(v) => {
                      setTouched((t) => ({ ...t, firstName: true }))
                      setFirstName(v)
                    }}
                    placeholder=""
                  />
                </Field>

                <Field label={t.lastName} error={touched.lastName ? validationErrors.lastName : null}>
                  <TextInput
                    value={lastName}
                    onChange={(v) => {
                      setTouched((t) => ({ ...t, lastName: true }))
                      setLastName(v)
                    }}
                    placeholder=""
                  />
                </Field>

                <div className="sm:col-span-2">
                  <Field
                    label={t.email}
                    error={
                      touched.email
                        ? validationErrors.email || serverFieldErrors.email || null
                        : null
                    }
                  >
                    <div className="relative">
                      <TextInput
                        value={email}
                        onChange={(v) => {
                          setTouched((prev) => ({ ...prev, email: true }))
                          setEmail(v)
                          setServerFieldErrors((prev) => {
                            const next = { ...prev }
                            delete next.email
                            return next
                          })
                        }}
                        disabled={isSignedInWithGoogle}
                        placeholder=""
                      />
                      {isSignedInWithGoogle && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-xs text-slate-500 bg-white px-2 py-0.5 rounded">
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
                  </Field>
                </div>

                {!isSignedInWithGoogle && showEmailForm && (
                  <div className="sm:col-span-2">
                    <Field
                      label={t.confirmEmail}
                      error={
                        touched.confirmEmail
                          ? validationErrors.confirmEmail || serverFieldErrors.confirmEmail || null
                          : null
                      }
                    >
                      <TextInput
                        value={confirmEmail}
                        onChange={(v) => {
                          setTouched((prev) => ({ ...prev, confirmEmail: true }))
                          setConfirmEmail(v)
                          setServerFieldErrors((prev) => {
                            const next = { ...prev }
                            delete next.confirmEmail
                            return next
                          })
                        }}
                        placeholder=""
                      />
                    </Field>
                  </div>
                )}

                {!isSignedInWithGoogle && showEmailForm && (
                  <div className="sm:col-span-2">
                    <Field
                      label={t.password}
                      error={touched.password ? validationErrors.password : null}
                    >
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => {
                          setTouched((prev) => ({ ...prev, password: true }))
                          setPassword(e.target.value)
                        }}
                        placeholder={t.passwordPlaceholder}
                        className={profileTheme.input}
                      />
                    </Field>
                  </div>
                )}

                <div className="sm:col-span-2">
                  <Field
                    label={t.phone}
                    error={
                      touched.phone
                        ? validationErrors.phone || serverFieldErrors.phone || null
                        : null
                    }
                  >
                    <TextInput
                      value={phone}
                      onChange={(v) => {
                        setTouched((prev) => ({ ...prev, phone: true }))
                        setPhone(v)
                        setServerFieldErrors((prev) => {
                          const next = { ...prev }
                          delete next.phone
                          return next
                        })
                      }}
                      placeholder={t.phonePlaceholder}
                      inputMode="tel"
                    />
                  </Field>
                </div>
              </div>
            </section>

            {/* Gender Section */}
            <section>
              <h2 className={profileTheme.sectionTitle}>{t.gender}</h2>
              <RadioGroup
                value={gender}
                onChange={setGender}
                options={[
                  { value: 'Male', label: t.male },
                  { value: 'Female', label: t.female },
                  { value: 'Other', label: t.other }
                ]}
              />
            </section>

            {/* Preferred Language Section */}
            <section>
              <h2 className={profileTheme.sectionTitle}>{t.preferredLanguage}</h2>
              <div className={profileTheme.grid}>
                <div className="sm:col-span-2">
                  <Field
                    label={t.preferredLanguage}
                  error={touched.language ? validationErrors.language : null}
                  >
                    <SelectInput
                      value={language}
                      onChange={(v) => {
                        setTouched((prev) => ({ ...prev, language: true }))
                        setLanguage(v)
                      }}
                      placeholder={t.selectLanguage}
                      options={[
                        { value: 'en', label: t.english },
                        { value: 'he', label: t.hebrew }
                      ]}
                    />
                  </Field>
                </div>
              </div>
            </section>

            {/* Address Section */}
            <section>
              <h2 className={profileTheme.sectionTitle}>{t.address}</h2>
              <div className={profileTheme.grid}>
                <Field label={t.streetAddress}>
                  <TextInput
                    value={addressStreet}
                    onChange={setAddressStreet}
                    placeholder={t.streetPlaceholder}
                  />
                </Field>

                <Field label={t.aptFloor}>
                  <TextInput
                    value={addressApt}
                    onChange={setAddressApt}
                    placeholder={t.aptPlaceholder}
                  />
                </Field>

                <Field label={t.city}>
                  <TextInput value={city} onChange={setCity} placeholder={t.cityPlaceholder} />
                </Field>

                <Field label={t.postalCode}>
                  <TextInput
                    value={postalCode}
                    onChange={setPostalCode}
                    placeholder={t.postalPlaceholder}
                  />
                </Field>
              </div>
            </section>

            {/* Newsletter Section */}
            <section>
              <Checkbox
                checked={isNewsletter}
                onChange={setIsNewsletter}
                label={t.newsletter}
                description={t.newsletterDescription}
              />
            </section>
          </div>
        )}

        {/* Save Profile Button */}
        {!shouldGateExistingUser && (isSignedInWithGoogle || firebaseUser || showEmailForm) && (
          <div className="mt-8 border-t border-slate-200 pt-6">
            <div className={profileTheme.actions}>
              <button
                type="button"
                className={profileTheme.buttonPrimary}
                onClick={handleSubmit}
                disabled={!canSubmit}
              >
                {busy ? t.saving : t.saveProfile}
              </button>
              
              {(isSignedInWithGoogle || firebaseUser) && (
                <button
                  type="button"
                  onClick={handleCancelSignup}
                  disabled={busy}
                  className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {lng === 'he' ? 'ביטול הרשמה' : 'Cancel Signup'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </ProfileShell>
  )
}
