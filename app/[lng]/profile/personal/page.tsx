'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
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
import { CheckIcon, XMarkIcon } from '@heroicons/react/24/outline'
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
    profileUpdated: 'Profile updated successfully'
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
    profileUpdated: 'הפרופיל עודכן בהצלחה'
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
      showToast(t.profileUpdated, 'success')
    } catch (e: any) {
      setError(e?.message || t.unableToSaveProfile)
      showToast(e?.message || t.unableToSaveProfile, 'error')
    } finally {
      setBusy(false)
    }
  }

  function handleCancel() {
    if (!loadedUser) return
    setFirstName(loadedUser.firstName ?? '')
    setLastName(loadedUser.lastName ?? '')
    setPhone(loadedUser.phone ?? '')
    setBirthday(loadedUser.birthday ? loadedUser.birthday.split('T')[0] : '')
    setLanguage(loadedUser.language ?? lng ?? '')
    setInterestedIn(loadedUser.interestedIn ?? '')
    setAddressStreet(loadedUser.addressStreet ?? '')
    setAddressStreetNumber(loadedUser.addressStreetNumber ?? '')
    setAddressFloor(loadedUser.addressFloor ?? '')
    setAddressApt(loadedUser.addressApt ?? '')
    setAddressCity(loadedUser.addressCity ?? '')
    setIsNewsletter(Boolean(loadedUser.isNewsletter))
    setTouched({})
    setError(null)
  }

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
            <div className="flex gap-2">
              <button
                onClick={handleCancel}
                disabled={busy}
                className="flex items-center text-xs md:text-sm text-gray-600 hover:text-gray-700 px-3 md:px-4 py-2 rounded-md border border-gray-300 hover:bg-gray-50 transition-colors"
              >
                <XMarkIcon className="h-4 w-4 mr-1" />
                {t.cancel}
              </button>
              <button
                onClick={handleSaveProfile}
                disabled={busy || Object.keys(requiredErrors).length > 0}
                className="flex items-center text-xs md:text-sm text-white bg-[#856D55] hover:bg-[#856D55]/90 disabled:opacity-50 px-3 md:px-4 py-2 rounded-md transition-colors"
              >
                <CheckIcon className="h-4 w-4 mr-1" />
                {busy ? t.saving : t.save}
              </button>
            </div>
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
                />
              </Field>

              <Field label={t.streetNumber}>
                <TextInput
                  value={addressStreetNumber}
                  onChange={setAddressStreetNumber}
                  placeholder={t.streetNumberPlaceholder}
                />
              </Field>

              <Field label={t.floor}>
                <TextInput
                  value={addressFloor}
                  onChange={setAddressFloor}
                  placeholder={t.floorPlaceholder}
                />
              </Field>

              <Field label={t.apt}>
                <TextInput
                  value={addressApt}
                  onChange={setAddressApt}
                  placeholder={t.aptPlaceholder}
                />
              </Field>

              <Field label={t.city}>
                <TextInput
                  value={addressCity}
                  onChange={setAddressCity}
                  placeholder={t.cityPlaceholder}
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
    </div>
  )
}

