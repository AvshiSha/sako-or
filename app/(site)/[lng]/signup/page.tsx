'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { sanitizeRedirect } from '@/lib/safe-redirect'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import {
  GoogleAuthProvider,
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
  type User
} from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useAuth } from '@/app/contexts/AuthContext'
import AuthShell, {
  AuthAside,
  AuthAsideItem,
  AuthError,
  AuthLink,
  AuthSkeleton,
  AuthSubmit,
  AUTH_CELL,
  AUTH_LABEL,
  AUTH_ROW,
} from '@/app/components/auth/AuthShell'
import { normalizeIsraelE164 } from '@/lib/phone'
import { Field, FIELD_SELECT } from '@/app/components/ui/field'
import { IsraelPhoneInput } from '@/app/components/ui/israel-phone-input'
import { Checkbox } from '@/app/components/ui/checkbox'
import { cn } from '@/lib/utils'

/**
 * Sign up, rebuilt on the SAKO OR — Update design system.
 *
 * As with sign in there is no Figma frame for this screen, so it is composed
 * from approved constructions — see app/components/auth/AuthShell.tsx. The club
 * pitch that used to be a grid of tinted icon chips above the form is now the
 * standing panel beside it, which is both where the design system puts a
 * secondary column (checkout's summary, 438:2781) and the right place for copy
 * that is read once and then ignored while the form is filled in.
 *
 * Only the presentation changed. The Google popup-then-redirect fallback, the
 * /api/me/sync gate, the duplicate precheck, the validation rules and the
 * sessionStorage hand-off to verify-sms are untouched.
 */
/**
 * /api/me/sync. The two Google name fields are only present for an account that
 * signed in with Google and has not completed its profile — they are offered as
 * placeholders, never pre-filled.
 */
type SyncResponse =
  | {
      ok: true
      needsProfileCompletion: boolean
      googleFirstName?: string | null
      googleLastName?: string | null
    }
  | { error: string }

/* ── Pure helpers ────────────────────────────────────────────────────────────
   At module scope, not inside the component. They close over nothing, so
   declaring them per-render only gave every useMemo/useCallback below a
   dependency that changed on every keystroke — which is what the exhaustive-deps
   warnings on the validation memo were actually pointing at. Hoisted, they drop
   out of the dependency graph entirely instead of being memoised around. */

/** Day count for a 1-based month, leap years included. */
function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

function isValidDate(year: string, month: string, day: string): boolean {
  if (!year || !month || !day) return false
  const y = parseInt(year, 10)
  const m = parseInt(month, 10)
  const d = parseInt(day, 10)
  if (isNaN(y) || isNaN(m) || isNaN(d)) return false
  return d >= 1 && d <= getDaysInMonth(y, m)
}

/** Accepts the local number with or without its 0 prefix; null if unparseable. */
function normalizePhoneForValidation(phone: string): string | null {
  if (!phone.trim()) return null
  const phoneWithZero = phone.startsWith('0') ? phone : `0${phone}`
  return normalizeIsraelE164(phoneWithZero)
}

function formatAuthError(e: any, fallback: string) {
  const code = typeof e?.code === 'string' ? e.code : ''
  const msg = typeof e?.message === 'string' ? e.message : ''
  if (code && msg) return `${code}: ${msg}`
  if (code) return code
  if (msg) return msg
  return fallback
}

function isGoogleAccount(user: User) {
  return (user.providerData || []).some((p) => p.providerId === 'google.com')
}

/** Splits a Google displayName into first/last for the name placeholders. */
function parseGoogleDisplayName(displayName: string | null | undefined): {
  firstName: string | null
  lastName: string | null
} {
  if (!displayName) return { firstName: null, lastName: null }
  const parts = displayName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { firstName: null, lastName: null }
  if (parts.length === 1) return { firstName: parts[0], lastName: null }
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') }
}

// Translations
const translations = {
  en: {
    title: 'Sign Up',
    subtitle: 'Create your account to get started',
    eyebrow: 'ACCOUNT / SIGN UP',
    sectionAccount: '01 — Your details',
    sectionAddress: '02 — Address',
    sectionPreferences: '03 — Preferences',
    optional: 'Optional',
    selectArrow: 'Choose',
    clubTitle: 'The SAKO OR club is waiting for you ✨',
    clubSubtitle: 'Discounts. Surprises. Early access. Points on every purchase.',
    clubPoints: 'Points on every purchase',
    clubGifts: 'Gifts and benefits',
    clubEarlyAccess: 'Early access to sales',
    clubCollections: 'Collections before everyone else',
    clubStoreMembers: 'Already a store club member? Register here to see and use all your points from past purchases online too!',
    personalInfo: 'Personal Information',
    firstName: 'First Name',
    lastName: 'Last Name',
    email: 'Email Address',
    confirmEmail: 'Confirm Email Address',
    password: 'Password',
    emailPlaceholder: 'name@example.com',
    phone: 'Phone Number',
    phonePlaceholder: '0501234567',
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
    continueWithGoogle: 'Continue with Google',
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
    eyebrow: 'חשבון / הרשמה',
    sectionAccount: '01 — הפרטים שלך',
    sectionAddress: '02 — כתובת',
    sectionPreferences: '03 — העדפות',
    optional: 'לא חובה',
    selectArrow: 'בחרו',
    clubTitle: 'המועדון של SAKO OR מחכה לך ✨',
    clubSubtitle: 'הנחות. הפתעות. גישה מוקדמת. נקודות בכל רכישה.',
    clubPoints: 'נקודות על כל קנייה',
    clubGifts: 'מתנות והטבות',
    clubEarlyAccess: 'גישה מוקדמת לסייל',
    clubCollections: 'קולקציות לפני כולן',
    clubStoreMembers: 'כבר חברת מועדון מהחנות? 💖 אם תירשמי לאתר – תוכלי לראות את כל הנקודות שצברת בקניות הקודמות שלך, ולהשתמש בהן גם כאן באתר!',
    personalInfo: 'מידע אישי',
    firstName: 'שם פרטי',
    lastName: 'שם משפחה',
    email: 'כתובת אימייל',
    confirmEmail: 'אימות כתובת אימייל',
    password: 'סיסמה',
    emailPlaceholder: 'name@example.com',
    phone: 'מספר טלפון',
    phonePlaceholder: '0501234567',
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
    continueWithGoogle: 'המשיכו עם Google',
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
  // useSearchParams needs a Suspense boundary or Next bails out of static rendering
  // for the whole route. Mirrors the wrapper already used by the signin page.
  return (
    <Suspense fallback={null}>
      <SignUpClient />
    </Suspense>
  )
}

function SignUpClient() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  // Where to return the customer after signup. Validated on read, and again in
  // verify-sms before it is acted on — it arrives from a URL we put in an SMS.
  const returnTo = sanitizeRedirect(searchParams?.get('redirect'))
  const lng = (params?.lng as string) || 'en'
  const t = translations[lng as keyof typeof translations] || translations.en
  // isRTL only decides date-part ORDER now. Everything else is laid out with
  // logical properties and inherits direction from the <html> the [lng] layout
  // writes it on, so no `dir` is set per node any more.
  const isRTL = lng === 'he'

  const { user: firebaseUser, loading: authLoading, logout } = useAuth()

  // Prevent a brief flash of the sign-up/profile form for already-onboarded users.
  // We first check `/api/me/sync` to know whether profile completion is required.
  const [profileGate, setProfileGate] = useState<'idle' | 'checking' | 'needs_form' | 'redirecting'>('idle')

  // Profile form fields
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phoneLocalNumber, setPhoneLocalNumber] = useState('') // Local number only (8-9 digits)
  const [interestedIn, setInterestedIn] = useState('')
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
  const [isGoogleSignInInProgress, setIsGoogleSignInInProgress] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [serverFieldErrors, setServerFieldErrors] = useState<Record<string, string>>({})
  const [isSignedInWithGoogle, setIsSignedInWithGoogle] = useState(false)
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  // Google name placeholders (not pre-filled values)
  const [googleFirstNamePlaceholder, setGoogleFirstNamePlaceholder] = useState<string>('')
  const [googleLastNamePlaceholder, setGoogleLastNamePlaceholder] = useState<string>('')

  const syncedUidRef = useRef<string | null>(null)

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
    // Validate phone number (handles both 0-prefixed and non-prefixed)
    if (!phoneLocalNumber.trim()) {
      errors.phone = t.phoneRequired
    } else {
      const normalizedPhone = normalizePhoneForValidation(phoneLocalNumber)
      if (!normalizedPhone) {
        errors.phone = t.phoneInvalid
      }
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

  /**
   * Syncs the signed-in account and decides whether this page still has a job.
   *
   * useCallback because two effects depend on it; its identity changes only when
   * the redirect target does (router / returnTo / lng), never per render, so
   * adding it to those dependency arrays cannot loop. The setters it closes over
   * are useState setters, which React guarantees are stable.
   */
  const checkProfileAndRedirect = useCallback(
    async (user: User): Promise<'needs_form' | 'redirecting'> => {
      const token = await user.getIdToken()
      const syncRes = await fetch('/api/me/sync', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      })
      const syncJson = (await syncRes.json().catch(() => null)) as SyncResponse | null

      if (!syncRes.ok || !syncJson || 'error' in syncJson) {
        // If sync fails, fall back to current page behavior (show form).
        return 'needs_form'
      }

      // Extract Google names for use as placeholders (only for new users)
      if ('googleFirstName' in syncJson || 'googleLastName' in syncJson) {
        setGoogleFirstNamePlaceholder(syncJson.googleFirstName || '')
        setGoogleLastNamePlaceholder(syncJson.googleLastName || '')
      }

      if (syncJson.needsProfileCompletion === false) {
        // Existing user with complete profile - redirect to profile
        setProfileGate('redirecting')
        router.replace(returnTo ?? `/${lng}/profile`)
        return 'redirecting'
      }

      // New user or incomplete profile - keep them on the form
      return 'needs_form'
    },
    [router, returnTo, lng]
  )

  async function storeSignupDataAndRedirectToSmsVerify(user: User) {
    // Store pending signup data in sessionStorage
    // Normalize phone (handles both 0-prefixed and non-prefixed)
    const normalizedPhone = normalizePhoneForValidation(phoneLocalNumber) || ''
    const pendingSignup = {
      uid: user.uid,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: normalizedPhone,
      language: language === 'he' || language === 'en' ? language : 'en',
      gender: interestedIn || undefined,
      birthday: birthYear && birthMonth && birthDay 
        ? `${birthYear}-${String(birthMonth).padStart(2, '0')}-${String(birthDay).padStart(2, '0')}`
        : undefined,
      city: city || undefined,
      streetName: streetName || undefined,
      streetNumber: streetNumber || undefined,
      floor: floor || undefined,
      apt: apt || undefined,
      isNewsletter,
      redirectTo: returnTo ?? undefined
    }

    sessionStorage.setItem('pendingSignup', JSON.stringify(pendingSignup))

    // Redirect to SMS verification page
    router.push(`/${lng}/verify-sms`)
  }

  /**
   * Settle the Google redirect sign-in (the fallback used when popups are
   * blocked) and surface anything that went wrong with it.
   *
   * That is ALL this effect does. It used to also populate the form and call
   * checkProfileAndRedirect itself, which was redundant and cost a second
   * request: completing a redirect makes Firebase emit an auth state change, so
   * `firebaseUser` lands and the effect below runs for the very same account —
   * and because that effect guards on uid while this one guarded on a module
   * flag, neither suppressed the other and /api/me/sync was POSTed twice per
   * redirect sign-in. One owner for that work now, keyed on the user.
   *
   * Mount-only, and genuinely so: nothing here reads props, state or the
   * callback, so the empty dependency array is accurate rather than silenced.
   * `redirectChecked` is module-scoped so a remount does not re-consume the
   * result — which also makes dropping a cancelled run harmless, since the
   * sign-in itself is carried by the auth state change, not by this effect.
   */
  useEffect(() => {
    if (redirectChecked) return
    redirectChecked = true

    let cancelled = false
    ;(async () => {
      try {
        await getRedirectResult(auth)
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
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  /**
   * The single owner of "someone is signed in — does this page still apply?".
   * Reached by every route in: an existing session, a Google popup, and a Google
   * redirect once the effect above lets Firebase finish it.
   *
   * `syncedUidRef` keys the work on the account rather than on a render, so the
   * effect re-running — because `checkProfileAndRedirect` changed identity, or
   * because React re-mounted it in StrictMode — returns early instead of issuing
   * a second /api/me/sync. Deliberately NOT cancelled on unmount: the ref is
   * already marked, so a cancelled run would leave the gate stuck at 'checking'
   * with nothing able to retry it.
   */
  useEffect(() => {
    if (authLoading) return
    if (!firebaseUser) return
    if (syncedUidRef.current === firebaseUser.uid) return
    syncedUidRef.current = firebaseUser.uid

    // Populate email and show form if signed in
    setBusy(true)
    setProfileGate('checking')
    setEmail(firebaseUser.email || '')
    const isGoogle = isGoogleAccount(firebaseUser)
    setIsSignedInWithGoogle(isGoogle)

    // If Google user, parse names from displayName as fallback
    if (isGoogle && firebaseUser.displayName) {
      const parsed = parseGoogleDisplayName(firebaseUser.displayName)
      if (parsed.firstName) setGoogleFirstNamePlaceholder(parsed.firstName)
      if (parsed.lastName) setGoogleLastNamePlaceholder(parsed.lastName)
    }

    void (async () => {
      try {
        const next = await checkProfileAndRedirect(firebaseUser)
        setProfileGate(next === 'needs_form' ? 'needs_form' : 'redirecting')
      } finally {
        setBusy(false)
      }
    })()
  }, [firebaseUser, authLoading, checkProfileAndRedirect])

  async function handleGoogleSignIn() {
    setBusy(true)
    setIsGoogleSignInInProgress(true)
    setError(null)
    try {
      const provider = new GoogleAuthProvider()
      provider.setCustomParameters({ prompt: 'select_account' })
      try {
        // Just complete the sign-in. Populating the form and syncing the
        // profile belong to the firebaseUser effect, which onAuthStateChanged
        // triggers the moment this resolves — doing it here as well is what
        // made the popup path POST /api/me/sync twice, since that effect keys
        // off a uid this function never marked as seen.
        await signInWithPopup(auth, provider)
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
      setError(formatAuthError(e, 'Google sign in failed'))
    } finally {
      setBusy(false)
      setIsGoogleSignInInProgress(false)
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
      const user: User | null = firebaseUser

      const normalizedEmail = email.trim().toLowerCase()
      // Normalize phone (handles both 0-prefixed and non-prefixed)
      const normalizedPhone = normalizePhoneForValidation(phoneLocalNumber)

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
        // Normalize phone (handles both 0-prefixed and non-prefixed)
        const normalizedPhone = normalizePhoneForValidation(phoneLocalNumber) || ''
        const pendingSignup = {
          email: normalizedEmail,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: normalizedPhone,
          language: language === 'he' || language === 'en' ? language : 'en',
          gender: interestedIn || undefined,
          birthday: birthYear && birthMonth && birthDay 
        ? `${birthYear}-${String(birthMonth).padStart(2, '0')}-${String(birthDay).padStart(2, '0')}`
        : undefined,
          city: city || undefined,
          streetName: streetName || undefined,
          streetNumber: streetNumber || undefined,
          floor: floor || undefined,
          apt: apt || undefined,
          isNewsletter,
          redirectTo: returnTo ?? undefined
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

      // Sign out and redirect to home. Clearing the two guards is what the old
      // unreachable handleSignOut used to do and this path now inherits: without
      // it, signing in again in the same SPA session would find the uid already
      // marked as synced and skip the gate.
      await logout()
      syncedUidRef.current = null
      redirectChecked = false
      setProfileGate('idle')
      setIsSignedInWithGoogle(false)
      router.replace(`/${lng}`)
    } catch (e: any) {
      setError(formatAuthError(e, 'Failed to cancel signup'))
    } finally {
      setBusy(false)
    }
  }

  const shouldGateExistingUser = Boolean(firebaseUser) && profileGate !== 'needs_form'

  // While Firebase session is resolving, avoid UI flicker.
  if (authLoading) {
    return <AuthSkeleton title={t.title} />
  }

  // Already signed in and being routed onwards — the same skeleton, so the page
  // does not change shape between the two waits.
  if (shouldGateExistingUser) {
    return <AuthSkeleton title={t.title} />
  }

  /** A ruled section header inside the form column — blog list 438:3332. */
  function sectionHeader(label: string, hint?: string) {
    return (
      <div className="mb-[20px] flex items-end justify-between gap-[16px] border-t border-sako-black pt-[20px]">
        <h2 className="font-ploni text-[20px] font-black text-start text-text-primary">{label}</h2>
        {hint ? (
          <p className={cn(AUTH_LABEL, 'shrink-0 text-text-secondary')}>{hint}</p>
        ) : null}
      </div>
    )
  }

  /**
   * A native <select> wearing the Form Input Field. The caret is the system's
   * own turned arrow rather than the OS chevron, and it is positioned with
   * `end-0` so it sits at the reading end in both directions — `right-0` would
   * put it under the first character of the Hebrew value.
   */
  function selectField({
    id,
    label,
    value,
    onChange,
    options,
    placeholder,
    required,
    disabled,
    error,
    fieldClassName,
  }: {
    id: string
    label: string
    value: string
    onChange: (v: string) => void
    options: { value: string; label: string }[]
    placeholder: string
    required?: boolean
    disabled?: boolean
    error?: string | null
    fieldClassName?: string
  }) {
    return (
      <Field
        id={id}
        label={label}
        required={required}
        error={error ?? null}
        fieldClassName={fieldClassName}
      >
        <div className="relative flex flex-1 items-center">
          <select
            id={id}
            value={value}
            disabled={disabled}
            required={required}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            onChange={(e) => onChange(e.target.value)}
            className={cn(FIELD_SELECT, 'pe-[20px]', !value && 'text-text-secondary')}
          >
            <option value="">{placeholder}</option>
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute end-0 rotate-90 font-ploni text-[14px] font-black leading-none text-text-primary"
          >
            &#8601;
          </span>
        </div>
      </Field>
    )
  }

  return (
    <AuthShell
      title={t.title}
      eyebrow={t.eyebrow}
      aside={
        <AuthAside heading={t.clubTitle}>
          <p className="font-ploni text-[14px] leading-[22px] text-start text-text-primary">
            {t.clubSubtitle}
          </p>
          {/* The four benefits as ruled lines. The old lucide gems, gift boxes
              and sparkles are gone: this system draws no decorative pictograms,
              and tinted chips were the clearest sign the page predated it. */}
          <AuthAsideItem>{t.clubPoints}</AuthAsideItem>
          <AuthAsideItem>{t.clubGifts}</AuthAsideItem>
          <AuthAsideItem>{t.clubEarlyAccess}</AuthAsideItem>
          <AuthAsideItem>{t.clubCollections}</AuthAsideItem>
          <AuthAsideItem>
            <span className="text-text-secondary">{t.clubStoreMembers}</span>
          </AuthAsideItem>
        </AuthAside>
      }
    >
      <AuthError>{error}</AuthError>

      {/* Google first: it is the shortest path through this form, and the
          outlined CTA (438:7685) is how this system draws a secondary action. */}
      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={isGoogleSignInInProgress}
        aria-busy={isGoogleSignInInProgress || undefined}
        className={cn(
          'flex h-[54px] w-full items-center justify-center gap-[12px] border border-border-default bg-transparent px-[19px] font-ploni text-[16px] font-bold leading-none text-btn-secondary-text transition-colors',
          'hover:bg-sako-ink-900 hover:text-btn-primary-text',
          'disabled:cursor-not-allowed disabled:border-sako-gray-500 disabled:bg-transparent disabled:text-sako-gray-500 disabled:hover:bg-transparent disabled:hover:text-sako-gray-500',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sako-ink-900'
        )}
      >
        <svg className="size-[20px] shrink-0" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        {busy ? t.working : t.continueWithGoogle}
      </button>

      <div className="my-[30px] flex items-center gap-[14px]">
        <span className="h-px flex-1 bg-border-subtle" />
        <span className={cn(AUTH_LABEL, 'text-text-secondary')}>{t.orDivider}</span>
        <span className="h-px flex-1 bg-border-subtle" />
      </div>

      <div className="flex flex-col gap-[40px]">
        <section>
          {sectionHeader(t.sectionAccount)}
          <div className={AUTH_ROW}>
            <Field
              fieldClassName={AUTH_CELL}
              id="firstName"
              label={t.firstName}
              required
              autoComplete="given-name"
              value={firstName}
              onChange={(e) => {
                setTouched((t) => ({ ...t, firstName: true }))
                setFirstName(e.target.value)
              }}
              placeholder={googleFirstNamePlaceholder || t.firstName}
              error={touched.firstName ? validationErrors.firstName ?? null : null}
            />

            <Field
              fieldClassName={AUTH_CELL}
              id="lastName"
              label={t.lastName}
              required
              autoComplete="family-name"
              value={lastName}
              onChange={(e) => {
                setTouched((t) => ({ ...t, lastName: true }))
                setLastName(e.target.value)
              }}
              placeholder={googleLastNamePlaceholder || t.lastName}
              error={touched.lastName ? validationErrors.lastName ?? null : null}
            />

            {/* Locked to the Google address once signed in — the disabled state
                (grey rule, grey value) is what says so now, in place of the
                floating white "Signed in with Google" chip that used to sit on
                top of the input. The chip is a caption below instead. */}
            <Field
              fieldClassName={cn(AUTH_CELL, 'sm:col-span-2')}
              id="email"
              label={t.email}
              type="email"
              required
              autoComplete="email"
              dir="ltr"
              value={email}
              placeholder={t.emailPlaceholder}
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
              error={
                touched.email ? validationErrors.email || serverFieldErrors.email || null : null
              }
            />

            <p className="sm:col-span-2 -mt-[8px] pb-[15px] font-ploni text-[12px] leading-[18px] text-start text-text-secondary">
              {isSignedInWithGoogle
                ? t.signedInWithGoogle
                : lng === 'he'
                  ? 'החשבון ייווצר לאחר אימות SMS'
                  : 'Your account will be created after SMS verification'}
            </p>

            <Field
              fieldClassName={cn(AUTH_CELL, 'sm:col-span-2')}
              id="phone"
              label={t.phone}
              required
              error={
                touched.phone ? validationErrors.phone || serverFieldErrors.phone || null : null
              }
            >
              <IsraelPhoneInput
                variant="sako"
                id="phone"
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
                aria-invalid={
                  touched.phone && (validationErrors.phone || serverFieldErrors.phone)
                    ? true
                    : undefined
                }
                aria-describedby={
                  touched.phone && (validationErrors.phone || serverFieldErrors.phone)
                    ? 'phone-error'
                    : undefined
                }
              />
            </Field>

            {/* Birthday. Three selects on one row, ordered day/month/year under
                /en and year/month/day under /he, which is how each locale says
                a date — the one place the markup legitimately branches on
                direction rather than relying on logical properties. */}
            <div className={cn(AUTH_CELL, 'sm:col-span-2')}>
              <p className="font-ploni text-[9px] leading-none text-text-secondary">
                {t.birthday} <span aria-hidden="true">*</span>
              </p>
              <div className="mt-[10px] grid grid-cols-3 gap-[18px]">
                {(isRTL
                  ? ([
                      ['birthYear', t.selectYear, birthYear, setBirthYear, yearOptions],
                      ['birthMonth', t.selectMonth, birthMonth, setBirthMonth, monthOptions],
                      ['birthDay', t.selectDay, birthDay, setBirthDay, dayOptions],
                    ] as const)
                  : ([
                      ['birthDay', t.selectDay, birthDay, setBirthDay, dayOptions],
                      ['birthMonth', t.selectMonth, birthMonth, setBirthMonth, monthOptions],
                      ['birthYear', t.selectYear, birthYear, setBirthYear, yearOptions],
                    ] as const)
                ).map(([id, caption, value, setValue, options]) =>
                  selectField({
                    id,
                    label: caption,
                    value,
                    placeholder: caption,
                    disabled: id === 'birthDay' && (!birthYear || !birthMonth),
                    onChange: (v) => {
                      setTouched((prev) => ({ ...prev, birthday: true }))
                      setValue(v)
                    },
                    options: options.map((n) => ({ value: String(n), label: String(n) })),
                  })
                )}
              </div>
              {touched.birthday && validationErrors.birthday && (
                <p role="alert" className="pt-[6px] font-ploni text-[12px] text-accent-error">
                  {validationErrors.birthday}
                </p>
              )}
            </div>
          </div>
        </section>

        <section>
          {sectionHeader(t.sectionAddress, t.optional)}
          <div className={AUTH_ROW}>
            <Field
              fieldClassName={cn(AUTH_CELL, 'sm:col-span-2')}
              id="city"
              label={t.city}
              autoComplete="address-level2"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder={t.cityPlaceholder}
            />

            <Field
              fieldClassName={cn(AUTH_CELL, 'sm:col-span-2')}
              id="streetName"
              label={t.streetName}
              autoComplete="address-line1"
              value={streetName}
              onChange={(e) => setStreetName(e.target.value)}
              placeholder={t.streetNamePlaceholder}
            />

            <Field
              fieldClassName={AUTH_CELL}
              id="streetNumber"
              label={t.streetNumber}
              inputMode="numeric"
              value={streetNumber}
              onChange={(e) => setStreetNumber(e.target.value)}
              placeholder={t.streetNumberPlaceholder}
            />

            <Field
              fieldClassName={AUTH_CELL}
              id="floor"
              label={t.floor}
              inputMode="numeric"
              value={floor}
              onChange={(e) => setFloor(e.target.value)}
              placeholder={t.floorPlaceholder}
            />

            <Field
              fieldClassName={cn(AUTH_CELL, 'sm:col-span-2')}
              id="apt"
              label={t.apt}
              inputMode="numeric"
              value={apt}
              onChange={(e) => setApt(e.target.value)}
              placeholder={t.aptPlaceholder}
            />
          </div>
        </section>

        <section>
          {sectionHeader(t.sectionPreferences)}
          <div className={AUTH_ROW}>
            {selectField({
              id: 'language',
              label: t.preferredLanguage,
              required: true,
              value: language,
              placeholder: t.selectLanguage,
              fieldClassName: cn(AUTH_CELL, 'sm:col-span-2'),
              error: touched.language ? validationErrors.language ?? null : null,
              onChange: (v) => {
                setTouched((prev) => ({ ...prev, language: true }))
                setLanguage(v)
              },
              options: [
                { value: 'he', label: t.hebrew },
                { value: 'en', label: t.english },
              ],
            })}

            {selectField({
              id: 'interestedIn',
              label: t.prefferedStyle,
              value: interestedIn,
              placeholder: t.prefferedStyle,
              fieldClassName: cn(AUTH_CELL, 'sm:col-span-2'),
              onChange: setInterestedIn,
              options: [
                { value: 'mens', label: t.mens },
                { value: 'womens', label: t.womens },
                { value: 'both', label: t.other },
              ],
            })}
          </div>

          <div className="mt-[10px] flex items-start gap-[10px] text-start">
            <Checkbox
              id="newsletter"
              variant="sako"
              className="mt-[3px]"
              checked={isNewsletter}
              onCheckedChange={(checked) => {
                setIsNewsletter(checked === true)
              }}
            />
            <div>
              <label
                htmlFor="newsletter"
                className="cursor-pointer font-ploni text-[14px] font-bold leading-none text-text-primary"
              >
                {t.newsletter}
              </label>
              <p className="mt-[6px] font-ploni text-[12px] leading-[18px] text-text-secondary">
                {t.newsletterDescription}
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* The commit. A rule above it, as checkout closes its form. */}
      <div className="mt-[40px] border-t border-sako-black pt-[24px]">
        <AuthSubmit
          label={t.saveProfile}
          loadingLabel={t.saving}
          loading={busy}
          disabled={!canSubmit}
          onClick={handleSubmit}
        />

        {(isSignedInWithGoogle || firebaseUser) && (
          <div className="mt-[24px] flex">
            <AuthLink onClick={handleCancelSignup} disabled={busy}>
              {lng === 'he' ? 'ביטול הרשמה' : 'Cancel Signup'}
            </AuthLink>
          </div>
        )}
      </div>
    </AuthShell>
  )
}
