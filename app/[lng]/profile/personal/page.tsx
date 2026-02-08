'use client'

import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { useRouter, useParams, usePathname } from 'next/navigation'
import { useAuth } from '@/app/contexts/AuthContext'
import { profileTheme } from '@/app/components/profile/profileTheme'
import {
  Field,
  TextInput,
  SelectInput,
  RadioGroup,
  Checkbox
} from '@/app/components/profile/ProfileFormFields'
import Toast, { useToast } from '@/app/components/Toast'
import ConfirmDialog from '@/app/components/profile/ConfirmDialog'
import { CheckIcon, XMarkIcon, PencilIcon } from '@heroicons/react/24/outline'
import { FaWhatsapp } from 'react-icons/fa'
import { formatIsraelE164ToLocalDigits } from '@/lib/phone'

const translations = {
  en: {
    pageTitle: 'Personal Details',
    loading: 'Loading…',
    save: 'Save',
    saving: 'Saving…',
    cancel: 'Cancel',
    firstName: 'First Name',
    firstNamePlaceholder: 'First name',
    lastName: 'Last Name',
    lastNamePlaceholder: 'Last name',
    emailAddress: 'Email Address',
    emailPlaceholder: 'Email',
    cannotBeChanged: 'Cannot be changed',
    phoneNumber: 'Phone Number',
    phonePlaceholder: '+972...',
    birthday: 'Birthday',
    birthdayPlaceholder: 'YYYY-MM-DD',
    preferredLanguage: 'Preferred Language',
    selectLanguage: 'Select Language',
    english: 'English',
    hebrew: 'Hebrew',
    interestedIn: 'I am primarily interested in',
    optional: 'Optional',
    mens: 'Mens',
    womens: 'Womens',
    both: 'Both',
    address: 'Address',
    streetAddress: 'Street Address',
    streetAddressPlaceholder: 'e.g., Ben Yehuda',
    streetNumber: 'Street Number',
    streetNumberPlaceholder: 'e.g., 12',
    floor: 'Floor',
    floorPlaceholder: 'e.g., 3',
    apt: 'Apt',
    aptPlaceholder: 'e.g., 8',
    city: 'City',
    cityPlaceholder: 'e.g., Tel Aviv',
    newsletterSubscription: 'Newsletter Subscription',
    newsletterDescription: 'Receive updates, offers, and news via email.',
    lockedFieldsHelp:
      'Need to change your email, phone number or birthday? Contact us on WhatsApp or email and we\'ll help you update it.',
    contactWhatsApp: 'Contact us on WhatsApp',
    contactEmail: 'Contact us by email',
    firstNameRequired: 'First name is required',
    lastNameRequired: 'Last name is required',
    languageRequired: 'Language is required',
    unableToLoadProfile: 'Unable to load profile',
    unableToSaveProfile: 'Unable to save profile',
    profileUpdated: 'Profile updated successfully',
    edit: 'Edit',
    unsavedChangesTitle: 'Unsaved Changes',
    unsavedChangesMessage: 'You have unsaved changes. Do you want to save before leaving?',
    stay: 'Stay'
  },
  he: {
    pageTitle: 'פרטים אישיים',
    loading: 'טוען…',
    save: 'שמירה',
    saving: 'שומר…',
    cancel: 'ביטול',
    firstName: 'שם פרטי',
    firstNamePlaceholder: 'שם פרטי',
    lastName: 'שם משפחה',
    lastNamePlaceholder: 'שם משפחה',
    emailAddress: 'אימייל',
    emailPlaceholder: 'אימייל',
    cannotBeChanged: 'לא ניתן לשינוי',
    phoneNumber: 'מספר טלפון',
    phonePlaceholder: '+972...',
    birthday: 'תאריך לידה',
    birthdayPlaceholder: 'YYYY-MM-DD',
    preferredLanguage: 'שפה מועדפת',
    selectLanguage: 'בחר שפה',
    english: 'אנגלית',
    hebrew: 'עברית',
    interestedIn: 'בעיקר מתעניין ב',
    optional: 'אופציונלי',
    mens: 'מוצרים לגבר',
    womens: 'מוצרים לנשים',
    both: 'גם וגם',
    address: 'כתובת',
    streetAddress: 'רחוב',
    streetAddressPlaceholder: 'לדוגמה, בן יהודה',
    streetNumber: 'מספר',
    streetNumberPlaceholder: 'לדוגמה, 12',
    floor: 'קומה',
    floorPlaceholder: 'לדוגמה, 3',
    apt: 'דירה',
    aptPlaceholder: 'לדוגמה, 8',
    city: 'עיר',
    cityPlaceholder: 'לדוגמה, תל אביב',
    newsletterSubscription: 'הרשמה לניוזלטר',
    newsletterDescription: 'קבלו עדכונים, מבצעים וחדשות במייל.',
    lockedFieldsHelp:
      'רוצים לשנות את האימייל, מספר הטלפון או תאריך הלידה? צרו איתנו קשר ב-WhatsApp או במייל ונעזור לעדכן.',
    contactWhatsApp: 'צרו קשר ב-WhatsApp',
    contactEmail: 'צרו קשר במייל',
    firstNameRequired: 'שם פרטי הוא חובה',
    lastNameRequired: 'שם משפחה הוא חובה',
    languageRequired: 'שפה היא חובה',
    unableToLoadProfile: 'לא ניתן לטעון את הפרופיל',
    unableToSaveProfile: 'לא ניתן לשמור את הפרופיל',
    profileUpdated: 'הפרופיל עודכן בהצלחה',
    edit: 'עריכה',
    unsavedChangesTitle: 'שינויים שלא נשמרו',
    unsavedChangesMessage: 'שינית פרטים אבל לא שמרת. האם לשמור לפני היציאה?',
    stay: 'ביטול'
  }
} as const

type ApiUser = {
  id: string
  firebaseUid: string | null
  email: string | null
  phone: string | null
  firstName: string | null
  lastName: string | null
  language: string | null
  birthday: string | null
  interestedIn: string | null
  addressStreet: string | null
  addressStreetNumber: string | null
  addressFloor: string | null
  addressApt: string | null
  addressCity: string | null
  isNewsletter: boolean
  pointsBalance: number
  role: string
  createdAt: string
  updatedAt: string
}

export default function PersonalDetailsPage() {
  const router = useRouter()
  const params = useParams()
  const pathname = usePathname()
  const lng = (params?.lng as string) || 'en'
  const t = (translations as any)[lng] || translations.en
  const isRTL = lng === 'he'

  // Reuse the existing WhatsApp contact number used across the app (e.g. WhatsAppButton/SizeChart).
  const phoneNumber = '+972504487979'
  const defaultMessage = isRTL
    ? 'היי, אני צריך לעדכן את פרטי החשבון שלי (אימייל/טלפון/תאריך לידה)'
    : 'Hi, I need to update my account details (email/phone/birthday)'
  const encodedMessage = encodeURIComponent(defaultMessage)
  const whatsappUrl = `https://wa.me/${phoneNumber.replace(/[^0-9]/g, '')}?text=${encodedMessage}`

  const { user: firebaseUser, loading: authLoading } = useAuth()
  const { toast, showToast, hideToast } = useToast()

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadedUser, setLoadedUser] = useState<ApiUser | null>(null)
  
  // Edit mode and dirty state
  const [isEditMode, setIsEditMode] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null)
  const navigationBlockedRef = useRef(false)

  // Form fields
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [birthday, setBirthday] = useState('')
  const [language, setLanguage] = useState('')
  const [interestedIn, setInterestedIn] = useState('')
  const [addressStreet, setAddressStreet] = useState('')
  const [addressStreetNumber, setAddressStreetNumber] = useState('')
  const [addressFloor, setAddressFloor] = useState('')
  const [addressApt, setAddressApt] = useState('')
  const [addressCity, setAddressCity] = useState('')
  const [isNewsletter, setIsNewsletter] = useState(false)

  const [touched, setTouched] = useState<Record<string, boolean>>({})

  const requiredErrors = useMemo(() => {
    const errors: Record<string, string> = {}
    if (!firstName.trim()) errors.firstName = t.firstNameRequired
    if (!lastName.trim()) errors.lastName = t.lastNameRequired
    if (!language.trim()) errors.language = t.languageRequired
    return errors
  }, [firstName, lastName, language, t])

  // Track original values for dirty state detection
  const originalValuesRef = useRef<{
    firstName: string
    lastName: string
    language: string
    interestedIn: string
    addressStreet: string
    addressStreetNumber: string
    addressFloor: string
    addressApt: string
    addressCity: string
    isNewsletter: boolean
  } | null>(null)

  // Calculate dirty state
  const isDirty = useMemo(() => {
    if (!originalValuesRef.current || !isEditMode) return false
    
    const orig = originalValuesRef.current
    return (
      firstName.trim() !== orig.firstName ||
      lastName.trim() !== orig.lastName ||
      language !== orig.language ||
      interestedIn !== orig.interestedIn ||
      addressStreet !== orig.addressStreet ||
      addressStreetNumber !== orig.addressStreetNumber ||
      addressFloor !== orig.addressFloor ||
      addressApt !== orig.addressApt ||
      addressCity !== orig.addressCity ||
      isNewsletter !== orig.isNewsletter
    )
  }, [
    firstName,
    lastName,
    language,
    interestedIn,
    addressStreet,
    addressStreetNumber,
    addressFloor,
    addressApt,
    addressCity,
    isNewsletter,
    isEditMode
  ])

  // Load user profile
  useEffect(() => {
    if (authLoading) return
    if (!firebaseUser) {
      router.replace(`/${lng}/signin`)
      return
    }

    let cancelled = false
    ;(async () => {
      setBusy(true)
      setError(null)
      try {
        const token = await firebaseUser.getIdToken()
        const res = await fetch('/api/me/profile', {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` }
        })

        const json = await res.json().catch(() => ({}))
        if (!res.ok || !json || json.error) {
          throw new Error(json?.error || `HTTP ${res.status}`)
        }

        if (cancelled) return
        setLoadedUser(json.user)

        setEmail(json.user.email ?? firebaseUser.email ?? '')
        setFirstName(json.user.firstName ?? '')
        setLastName(json.user.lastName ?? '')
        setPhone(json.user.phone ?? '')
        setBirthday(json.user.birthday ? json.user.birthday.split('T')[0] : '')
        setLanguage(json.user.language ?? lng ?? '')
        setInterestedIn(json.user.interestedIn ?? '')
        setAddressStreet(json.user.addressStreet ?? '')
        setAddressStreetNumber(json.user.addressStreetNumber ?? '')
        setAddressFloor(json.user.addressFloor ?? '')
        setAddressApt(json.user.addressApt ?? '')
        setAddressCity(json.user.addressCity ?? '')
        setIsNewsletter(Boolean(json.user.isNewsletter))
        
        // Store original values for dirty state tracking
        originalValuesRef.current = {
          firstName: json.user.firstName ?? '',
          lastName: json.user.lastName ?? '',
          language: json.user.language ?? lng ?? '',
          interestedIn: json.user.interestedIn ?? '',
          addressStreet: json.user.addressStreet ?? '',
          addressStreetNumber: json.user.addressStreetNumber ?? '',
          addressFloor: json.user.addressFloor ?? '',
          addressApt: json.user.addressApt ?? '',
          addressCity: json.user.addressCity ?? '',
          isNewsletter: Boolean(json.user.isNewsletter)
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || t.unableToLoadProfile)
      } finally {
        if (!cancelled) setBusy(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [firebaseUser, authLoading, router, lng, t])

  async function handleSaveProfile() {
    if (!firebaseUser) return
    setTouched({
      firstName: true,
      lastName: true,
      language: true
    })
    if (Object.keys(requiredErrors).length > 0) return

    setBusy(true)
    setError(null)
    try {
      const token = await firebaseUser.getIdToken()

      const payload = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        language: language === 'he' || language === 'en' ? language : undefined,
        interestedIn: interestedIn ? interestedIn : null,
        addressStreet: addressStreet ? addressStreet : null,
        addressStreetNumber: addressStreetNumber ? addressStreetNumber : null,
        addressFloor: addressFloor ? addressFloor : null,
        addressApt: addressApt ? addressApt : null,
        addressCity: addressCity ? addressCity : null,
        isNewsletter
      }

      const res = await fetch('/api/me/profile', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json || json.error) {
        throw new Error(json?.error || `HTTP ${res.status}`)
      }

      setLoadedUser(json.user)
      
      // Update original values after successful save
      if (originalValuesRef.current) {
        originalValuesRef.current = {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          language: language,
          interestedIn: interestedIn,
          addressStreet: addressStreet,
          addressStreetNumber: addressStreetNumber,
          addressFloor: addressFloor,
          addressApt: addressApt,
          addressCity: addressCity,
          isNewsletter: isNewsletter
        }
      }
      
      // Exit edit mode and reset dirty state
      setIsEditMode(false)
      setTouched({})
      showToast(t.profileUpdated, 'success')
    } catch (e: any) {
      setError(e?.message || t.unableToSaveProfile)
      showToast(e?.message || t.unableToSaveProfile, 'error')
    } finally {
      setBusy(false)
    }
  }

  function handleCancel() {
    if (!loadedUser || !originalValuesRef.current) return
    
    // Revert to original values
    const orig = originalValuesRef.current
    setFirstName(orig.firstName)
    setLastName(orig.lastName)
    setLanguage(orig.language)
    setInterestedIn(orig.interestedIn)
    setAddressStreet(orig.addressStreet)
    setAddressStreetNumber(orig.addressStreetNumber)
    setAddressFloor(orig.addressFloor)
    setAddressApt(orig.addressApt)
    setAddressCity(orig.addressCity)
    setIsNewsletter(orig.isNewsletter)
    
    setTouched({})
    setError(null)
    setIsEditMode(false)
  }

  function handleEdit() {
    setIsEditMode(true)
  }

  // Handle navigation with unsaved changes guard
  const handleNavigationAttempt = useCallback((targetPath: string) => {
    if (isEditMode && isDirty) {
      setPendingNavigation(targetPath)
      setShowConfirmDialog(true)
      return false
    }
    return true
  }, [isEditMode, isDirty])

  // Handle confirmation dialog actions
  const handleConfirmSave = async () => {
    const navPath = pendingNavigation
    setShowConfirmDialog(false)
    setPendingNavigation(null)
    
    await handleSaveProfile()
    
    // After save, if there was a pending navigation, allow it
    // If navPath is null, it means back button was pressed - allow default back behavior
    if (navPath) {
      navigationBlockedRef.current = false
      // Small delay to ensure state is updated
      setTimeout(() => {
        router.push(navPath)
      }, 100)
    } else {
      // Back button case - allow navigation after save
      navigationBlockedRef.current = false
      setTimeout(() => {
        router.back()
      }, 100)
    }
  }

  const handleConfirmStay = () => {
    setShowConfirmDialog(false)
    setPendingNavigation(null)
    // If back button was pressed, push state again to prevent navigation
    if (isEditMode && isDirty) {
      window.history.pushState(null, '', window.location.href)
    }
  }

  // Browser beforeunload guard for refresh/close
  useEffect(() => {
    if (!isEditMode || !isDirty) return

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = '' // Chrome requires returnValue to be set
      return '' // Some browsers require return value
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [isEditMode, isDirty])

  // Browser back button guard
  useEffect(() => {
    if (!isEditMode || !isDirty) return

    // Push a state to track back button
    window.history.pushState({ preventBack: true }, '', window.location.href)
    
    const handlePopState = (e: PopStateEvent) => {
      // Show confirmation dialog
      setShowConfirmDialog(true)
      setPendingNavigation(null) // Back button - no specific target
      // Push state back to prevent navigation
      window.history.pushState({ preventBack: true }, '', window.location.href)
    }

    window.addEventListener('popstate', handlePopState)
    
    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [isEditMode, isDirty])

  // Next.js router guard for internal navigation - intercept Link clicks
  useEffect(() => {
    if (!isEditMode || !isDirty) {
      navigationBlockedRef.current = false
      return
    }

    const handleClick = (e: MouseEvent) => {
      // Find the closest anchor tag
      const target = e.target as HTMLElement
      const anchor = target.closest('a')
      
      if (!anchor) return
      
      const href = anchor.getAttribute('href')
      if (!href) return
      
      // Only intercept internal links (relative paths)
      if (href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('tel:')) {
        return
      }
      
      // Don't block if navigating to the same page
      if (href === pathname) return
      
      // Don't block external links or special links
      if (anchor.hasAttribute('target') && anchor.getAttribute('target') === '_blank') {
        return
      }
      
      // Block navigation and show confirmation
      e.preventDefault()
      e.stopPropagation()
      
      navigationBlockedRef.current = true
      setPendingNavigation(href)
      setShowConfirmDialog(true)
    }

    // Also intercept programmatic navigation via router
    const handleRouterPush = () => {
      // This is a workaround - we'll handle it via the click handler for Links
      // For programmatic router.push calls, we need to check before calling
    }

    document.addEventListener('click', handleClick, true)
    
    return () => {
      document.removeEventListener('click', handleClick, true)
    }
  }, [isEditMode, isDirty, pathname])

  if (authLoading || !loadedUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#856D55] mx-auto"></div>
          <p className="mt-4 text-gray-600">{t.loading}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="pt-6 pb-20 md:pb-6">
      <div className={profileTheme.card}>
        <div className={profileTheme.section}>
          <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">{t.pageTitle}</h1>
            {!isEditMode ? (
              <button
                onClick={handleEdit}
                disabled={busy}
                className={`flex items-center gap-2 text-xs md:text-sm text-white bg-[#856D55] hover:bg-[#856D55]/90 disabled:opacity-50 px-3 md:px-4 py-2 rounded-md transition-colors ${
                  isRTL ? 'flex-row-reverse' : ''
                }`}
              >
                <PencilIcon className="h-4 w-4" />
                {t.edit}
              </button>
            ) : (
              <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <button
                  onClick={handleCancel}
                  disabled={busy}
                  className={`flex items-center text-xs md:text-sm text-gray-600 hover:text-gray-700 px-3 md:px-4 py-2 rounded-md border border-gray-300 hover:bg-gray-50 transition-colors ${
                    isRTL ? 'flex-row-reverse' : ''
                  }`}
                >
                  <XMarkIcon className={`h-4 w-4 ${isRTL ? 'ml-1' : 'mr-1'}`} />
                  {t.cancel}
                </button>
                <button
                  onClick={handleSaveProfile}
                  disabled={busy || (!isDirty && Object.keys(requiredErrors).length > 0)}
                  className={`flex items-center text-xs md:text-sm text-white bg-[#856D55] hover:bg-[#856D55]/90 disabled:opacity-50 px-3 md:px-4 py-2 rounded-md transition-colors ${
                    isRTL ? 'flex-row-reverse' : ''
                  }`}
                >
                  <CheckIcon className={`h-4 w-4 ${isRTL ? 'ml-1' : 'mr-1'}`} />
                  {busy ? t.saving : t.save}
                </button>
              </div>
            )}
          </div>

          {error && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

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
                placeholder={t.firstNamePlaceholder}
                disabled={!isEditMode}
              />
            </Field>

            <Field label={t.lastName} error={touched.lastName ? requiredErrors.lastName : null}>
              <TextInput
                value={lastName}
                onChange={(v) => {
                  setTouched((t) => ({ ...t, lastName: true }))
                  setLastName(v)
                }}
                placeholder={t.lastNamePlaceholder}
                disabled={!isEditMode}
              />
            </Field>

            <Field label={t.emailAddress} hint={t.cannotBeChanged}>
              <TextInput value={email} onChange={() => {}} disabled placeholder={t.emailPlaceholder} />
            </Field>

            <Field label={t.phoneNumber} hint={t.cannotBeChanged}>
              <TextInput
                value={formatIsraelE164ToLocalDigits(phone)}
                onChange={() => {}}
                disabled
                placeholder={t.phonePlaceholder}
                inputMode="tel"
              />
            </Field>

            <Field label={t.birthday} hint={t.cannotBeChanged}>
              <TextInput
                value={birthday}
                onChange={() => {}}
                disabled
                placeholder={t.birthdayPlaceholder}
              />
            </Field>

            <Field
              label={t.preferredLanguage}
              error={touched.language ? requiredErrors.language : null}
            >
              <SelectInput
                value={language}
                onChange={(v) => {
                  setTouched((t) => ({ ...t, language: true }))
                  setLanguage(v)
                }}
                placeholder={t.selectLanguage}
                disabled={!isEditMode}
                options={[
                  { value: 'en', label: t.english },
                  { value: 'he', label: t.hebrew }
                ]}
              />
            </Field>

            <div className="sm:col-span-2">
              <Field label={t.interestedIn} hint={t.optional}>
                <RadioGroup
                  value={interestedIn}
                  onChange={setInterestedIn}
                  disabled={!isEditMode}
                  options={[
                    { value: 'mens', label: t.mens },
                    { value: 'womens', label: t.womens },
                    { value: 'both', label: t.both }
                  ]}
                />
              </Field>
            </div>
          </div>

          {/* Address Section */}
          <div className="mt-6">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">{t.address}</h4>
            <div className={profileTheme.grid}>
              <Field label={t.streetAddress}>
                <TextInput
                  value={addressStreet}
                  onChange={setAddressStreet}
                  placeholder={t.streetAddressPlaceholder}
                  disabled={!isEditMode}
                />
              </Field>

              <Field label={t.streetNumber}>
                <TextInput
                  value={addressStreetNumber}
                  onChange={setAddressStreetNumber}
                  placeholder={t.streetNumberPlaceholder}
                  disabled={!isEditMode}
                />
              </Field>

              <Field label={t.floor}>
                <TextInput
                  value={addressFloor}
                  onChange={setAddressFloor}
                  placeholder={t.floorPlaceholder}
                  disabled={!isEditMode}
                />
              </Field>

              <Field label={t.apt}>
                <TextInput
                  value={addressApt}
                  onChange={setAddressApt}
                  placeholder={t.aptPlaceholder}
                  disabled={!isEditMode}
                />
              </Field>

              <Field label={t.city}>
                <TextInput
                  value={addressCity}
                  onChange={setAddressCity}
                  placeholder={t.cityPlaceholder}
                  disabled={!isEditMode}
                />
              </Field>
            </div>
          </div>

          {/* Newsletter Section */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <Checkbox
              checked={isNewsletter}
              onChange={setIsNewsletter}
              label={t.newsletterSubscription}
              description={t.newsletterDescription}
              disabled={!isEditMode}
            />

            {/* Locked fields help */}
            <div className="mt-4 rounded-lg bg-gray-50 border border-gray-200 p-4">
              <p className="text-sm text-gray-700">{t.lockedFieldsHelp}</p>
              <div className="mt-3 flex flex-col sm:flex-row gap-3">
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#856D55] hover:bg-[#6B5745] text-white rounded-md font-medium transition-colors duration-200"
                >
                  <FaWhatsapp className="w-5 h-5" />
                  {t.contactWhatsApp}
                </a>
                <a
                  href={`/${lng}/contact`}
                  className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 hover:border-gray-400 text-gray-700 rounded-md font-medium transition-colors duration-200"
                >
                  {t.contactEmail}
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      <Toast
        message={toast.message}
        isVisible={toast.isVisible}
        onClose={hideToast}
        type={toast.type}
      />

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showConfirmDialog}
        title={t.unsavedChangesTitle}
        message={t.unsavedChangesMessage}
        confirmLabel={t.save}
        cancelLabel={t.stay}
        onConfirm={handleConfirmSave}
        onCancel={handleConfirmStay}
        isRTL={isRTL}
        isLoading={busy}
      />
    </div>
  )
}

