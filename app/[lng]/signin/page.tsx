'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getRedirectResult,
  signInWithEmailAndPassword,
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
    password: 'Password',
    passwordPlaceholder: 'At least 6 characters',
    phone: 'Phone Number',
    phonePlaceholder: '123-456-7890',
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
    passwordRequired: 'Password must be at least 6 characters',
    phoneRequired: 'Phone number is required',
    languageRequired: 'Preferred language is required'
  },
  he: {
    title: 'הרשמה',
    subtitle: 'צרו את החשבון שלכם כדי להתחיל',
    personalInfo: 'מידע אישי',
    firstName: 'שם פרטי',
    lastName: 'שם משפחה',
    email: 'כתובת אימייל',
    password: 'סיסמה',
    passwordPlaceholder: 'לפחות 6 תווים',
    phone: 'מספר טלפון',
    phonePlaceholder: '050-123-4567',
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
    passwordRequired: 'סיסמה חייבת להיות לפחות 6 תווים',
    phoneRequired: 'מספר טלפון הוא חובה',
    languageRequired: 'שפה מועדפת היא חובה'
  }
}

// Move redirectChecked ref outside component to persist across re-mounts
let redirectChecked = false

export default function SignInPage() {
  const router = useRouter()
  const params = useParams()
  const lng = (params?.lng as string) || 'en'
  const t = translations[lng as keyof typeof translations] || translations.en

  const { user: firebaseUser, loading: authLoading, logout } = useAuth()

  // Profile form fields
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [countryCode, setCountryCode] = useState('+972')
  const [gender, setGender] = useState('')
  const [language, setLanguage] = useState('')
  const [addressStreet, setAddressStreet] = useState('')
  const [addressApt, setAddressApt] = useState('')
  const [city, setCity] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [isNewsletter, setIsNewsletter] = useState(false)
  
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
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
  const requiredErrors = useMemo(() => {
    const errors: Record<string, string> = {}
    if (!firstName.trim()) errors.firstName = t.firstNameRequired
    if (!lastName.trim()) errors.lastName = t.lastNameRequired
    if (!email.trim()) errors.email = t.emailRequired
    if (!isSignedInWithGoogle && password.length < 6) errors.password = t.passwordRequired
    if (!phone.trim()) errors.phone = t.phoneRequired
    if (!language.trim()) errors.language = t.languageRequired
    return errors
  }, [firstName, lastName, email, password, phone, language, isSignedInWithGoogle, t])

  const canSubmit = useMemo(() => {
    return Object.keys(requiredErrors).length === 0 && !busy && (isSignedInWithGoogle || password.length >= 6)
  }, [requiredErrors, busy, isSignedInWithGoogle, password])

  function formatAuthError(e: any, fallback: string) {
    const code = typeof e?.code === 'string' ? e.code : ''
    const msg = typeof e?.message === 'string' ? e.message : ''
    if (code && msg) return `${code}: ${msg}`
    if (code) return code
    if (msg) return msg
    return fallback
  }

  async function syncToNeonWithProfile(user: User) {
    // #region agent log
    // #endregion
    const token = await user.getIdToken()
    
    // First sync the user to Neon
    const syncRes = await fetch('/api/me/sync', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    })

    const syncJson = (await syncRes.json().catch(() => null)) as SyncResponse | null
    if (!syncRes.ok || !syncJson || 'error' in syncJson) {
      throw new Error((syncJson && 'error' in syncJson && syncJson.error) || `HTTP ${syncRes.status}`)
    }

    // Then update the profile with the form data
    const payload = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: phone.trim(),
      language: language === 'he' || language === 'en' ? language : undefined,
      gender: gender ? gender : null,
      addressStreet: addressStreet ? addressStreet : null,
      addressStreetNumber: null,
      addressFloor: null,
      addressApt: addressApt ? addressApt : null,
      isNewsletter
    }

    const profileRes = await fetch('/api/me/profile', {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    if (!profileRes.ok) {
      const profileJson = await profileRes.json().catch(() => null)
      throw new Error((profileJson && 'error' in profileJson && profileJson.error) || `HTTP ${profileRes.status}`)
    }

    // #region agent log
    // #endregion
    router.replace(`/${lng}`)
    // #region agent log
    // #endregion
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
          setEmail(result.user.email || '')
          setIsSignedInWithGoogle(true)
          setShowEmailForm(false)
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
    setEmail(firebaseUser.email || '')
    setIsSignedInWithGoogle(true)
    setShowEmailForm(false)
    
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
        // #region agent log
        // #endregion
        setBusy(false)
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
      password: !isSignedInWithGoogle,
      phone: true,
      language: true
    })

    // Check if there are validation errors
    if (Object.keys(requiredErrors).length > 0) {
      return
    }

    setBusy(true)
    setError(null)
    try {
      let user: User | null = firebaseUser

      // If not already signed in with Google, create/sign in with email
      if (!isSignedInWithGoogle && !firebaseUser) {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password)
        user = cred.user
      }

      if (!user) {
        throw new Error('No user available')
      }

      await syncToNeonWithProfile(user)
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
      setPhone('')
      setGender('')
      setLanguage('')
      setAddressStreet('')
      setAddressApt('')
      setCity('')
      setPostalCode('')
      setIsNewsletter(false)
    } catch (e: any) {
      setError(formatAuthError(e, 'Sign out failed'))
    } finally {
      setBusy(false)
    }
  }

  // #region agent log
  const renderButtonsOnly = !isSignedInWithGoogle && !firebaseUser && !showEmailForm
  const renderForm = isSignedInWithGoogle || firebaseUser || showEmailForm
  useEffect(() => {
  }, [renderButtonsOnly, renderForm, isSignedInWithGoogle, firebaseUser, showEmailForm, busy])
  // #endregion

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
        {(isSignedInWithGoogle || firebaseUser || showEmailForm) && (
          <div className="space-y-8">
            {/* Personal Information Section */}
            <section>
              <h2 className={profileTheme.sectionTitle}>{t.personalInfo}</h2>
              <div className={profileTheme.grid}>
                <Field
                  label={t.firstName}
                  error={touched.firstName ? requiredErrors.firstName : null}
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

                <Field label={t.lastName} error={touched.lastName ? requiredErrors.lastName : null}>
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
                  <Field label={t.email} error={touched.email ? requiredErrors.email : null}>
                    <div className="relative">
                      <TextInput
                        value={email}
                        onChange={(v) => {
                          setTouched((prev) => ({ ...prev, email: true }))
                          setEmail(v)
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
                    <Field label={t.password} error={touched.password ? requiredErrors.password : null}>
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
                  <Field label={t.phone} error={touched.phone ? requiredErrors.phone : null}>
                    <div className="flex gap-2">
                      <select
                        value={countryCode}
                        onChange={(e) => setCountryCode(e.target.value)}
                        className="mt-1 w-28 flex-shrink-0 rounded-md border border-slate-200 bg-white px-3 py-2 pr-8 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200 appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 fill=%27none%27 viewBox=%270 0 20 20%27%3E%3Cpath stroke=%27%236b7280%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27 stroke-width=%271.5%27 d=%27M6 8l4 4 4-4%27/%3E%3C/svg%3E')] bg-[length:1.25em_1.25em] bg-[right_0.5rem_center] bg-no-repeat"
                      >
                        <option value="+1">🇺🇸 +1</option>
                        <option value="+972">🇮🇱 +972</option>
                        <option value="+44">🇬🇧 +44</option>
                      </select>
                      <TextInput
                        value={phone}
                        onChange={(v) => {
                          setTouched((prev) => ({ ...prev, phone: true }))
                          setPhone(v)
                        }}
                        placeholder={t.phonePlaceholder}
                        inputMode="tel"
                      />
                    </div>
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
                    error={touched.language ? requiredErrors.language : null}
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
        {(isSignedInWithGoogle || firebaseUser || showEmailForm) && (
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
            </div>
          </div>
        )}
      </div>
    </ProfileShell>
  )
}
