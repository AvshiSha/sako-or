'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
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
  isNewsletter: boolean
  pointsBalance: number
  role: string
  isDelete: boolean
  lastLoginAt: string | null
  createdAt: string
  updatedAt: string
}

type ProfileGetResponse =
  | { ok: true; user: ApiUser; needsProfileCompletion: boolean }
  | { error: string }

type ProfilePatchResponse =
  | { ok: true; user: ApiUser; needsProfileCompletion: boolean }
  | { error: string; issues?: any[] }

export default function CompleteProfilePage() {
  const router = useRouter()
  const params = useParams()
  const lng = (params?.lng as string) || 'en'

  const { user: firebaseUser, loading } = useAuth()

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadedUser, setLoadedUser] = useState<ApiUser | null>(null)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [birthday, setBirthday] = useState('')
  const [language, setLanguage] = useState('')
  const [interestedIn, setInterestedIn] = useState('') // '', 'mens', 'womens', 'both'

  const [addressStreet, setAddressStreet] = useState('')
  const [addressStreetNumber, setAddressStreetNumber] = useState('')
  const [addressFloor, setAddressFloor] = useState('')
  const [addressApt, setAddressApt] = useState('')
  const [isNewsletter, setIsNewsletter] = useState(false)

  const [touched, setTouched] = useState<Record<string, boolean>>({})

  const requiredErrors = useMemo(() => {
    const errors: Record<string, string> = {}
    if (!firstName.trim()) errors.firstName = 'First name is required'
    if (!lastName.trim()) errors.lastName = 'Last name is required'
    if (!phone.trim()) errors.phone = 'Phone is required'
    if (!birthday.trim()) errors.birthday = 'Birthday is required'
    if (!language.trim()) errors.language = 'Preferred language is required'
    return errors
  }, [firstName, lastName, phone, birthday, language])

  const canSubmit = useMemo(() => {
    return Object.keys(requiredErrors).length === 0 && !busy
  }, [requiredErrors, busy])

  useEffect(() => {
    if (loading) return
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

        const json = (await res.json().catch(() => null)) as ProfileGetResponse | null
        if (!res.ok || !json || 'error' in json) {
          throw new Error((json && 'error' in json && json.error) || `HTTP ${res.status}`)
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
        setIsNewsletter(Boolean(json.user.isNewsletter))
      } catch (e: any) {
        if (!cancelled) setError(typeof e?.message === 'string' ? e.message : 'Unable to load profile')
      } finally {
        if (!cancelled) setBusy(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [firebaseUser, loading, router, lng])

  async function handleSubmit() {
    if (!firebaseUser) return
    setTouched({
      firstName: true,
      lastName: true,
      phone: true,
      birthday: true,
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
        phone: phone.trim(),
        birthday: birthday.trim(),
        language: language === 'he' || language === 'en' ? language : undefined,
        interestedIn: interestedIn ? interestedIn : null,
        addressStreet: addressStreet ? addressStreet : null,
        addressStreetNumber: addressStreetNumber ? addressStreetNumber : null,
        addressFloor: addressFloor ? addressFloor : null,
        addressApt: addressApt ? addressApt : null,
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

      const json = (await res.json().catch(() => null)) as ProfilePatchResponse | null
      if (!res.ok || !json || 'error' in json) {
        throw new Error((json && 'error' in json && json.error) || `HTTP ${res.status}`)
      }

      router.replace(`/${lng}/profile`)
    } catch (e: any) {
      setError(typeof e?.message === 'string' ? e.message : 'Unable to save profile')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ProfileShell
      title="Complete Your Profile"
      subtitle="Please fill in the details below to finish setting up your account."
    >
      <div className={profileTheme.section}>
        {error ? (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="space-y-8">
          <section>
            <div className={profileTheme.sectionTitle}>Personal</div>
            <div className={profileTheme.grid}>
              <Field
                label="First Name"
                error={touched.firstName ? requiredErrors.firstName : null}
              >
                <TextInput
                  value={firstName}
                  onChange={(v) => {
                    setTouched((t) => ({ ...t, firstName: true }))
                    setFirstName(v)
                  }}
                  placeholder="First name"
                />
              </Field>

              <Field label="Last Name" error={touched.lastName ? requiredErrors.lastName : null}>
                <TextInput
                  value={lastName}
                  onChange={(v) => {
                    setTouched((t) => ({ ...t, lastName: true }))
                    setLastName(v)
                  }}
                  placeholder="Last name"
                />
              </Field>

              <Field label="Email Address" hint="Signed in with Firebase">
                <TextInput value={email} onChange={setEmail} disabled placeholder="Email" />
              </Field>

              <Field label="Phone Number" error={touched.phone ? requiredErrors.phone : null}>
                <TextInput
                  value={phone}
                  onChange={(v) => {
                    setTouched((t) => ({ ...t, phone: true }))
                    setPhone(v)
                  }}
                  placeholder="+972..."
                  inputMode="tel"
                />
              </Field>

              <Field label="Birthday" error={touched.birthday ? requiredErrors.birthday : null}>
                <TextInput
                  value={birthday}
                  onChange={(v) => {
                    setTouched((t) => ({ ...t, birthday: true }))
                    setBirthday(v)
                  }}
                  placeholder="YYYY-MM-DD"
                  inputMode="text"
                />
              </Field>
            </div>
          </section>

          <section>
            <div className={profileTheme.sectionTitle}>Preferences</div>
            <div className={profileTheme.grid}>
              <Field
                label="Preferred Language"
                error={touched.language ? requiredErrors.language : null}
              >
                <SelectInput
                  value={language}
                  onChange={(v) => {
                    setTouched((t) => ({ ...t, language: true }))
                    setLanguage(v)
                  }}
                  placeholder="Select Language"
                  options={[
                    { value: 'en', label: 'English' },
                    { value: 'he', label: 'Hebrew' }
                  ]}
                />
              </Field>

              <div className="sm:col-span-2">
                <Field label="I am primarily interested in" hint="Optional">
                  <RadioGroup
                    value={interestedIn}
                    onChange={setInterestedIn}
                    options={[
                      { value: 'mens', label: 'Mens' },
                      { value: 'womens', label: 'Womens' },
                      { value: 'both', label: 'Both' }
                    ]}
                  />
                </Field>
              </div>

              <div className="sm:col-span-2">
                <Checkbox
                  checked={isNewsletter}
                  onChange={setIsNewsletter}
                  label="Subscribe to Newsletter"
                  description="Yes, send me updates and offers."
                />
              </div>
            </div>
          </section>

          <section>
            <div className={profileTheme.sectionTitle}>Address</div>
            <div className={profileTheme.grid}>
              <Field label="Street Address">
                <TextInput
                  value={addressStreet}
                  onChange={setAddressStreet}
                  placeholder="e.g., Ben Yehuda"
                />
              </Field>

              <Field label="Street Number">
                <TextInput
                  value={addressStreetNumber}
                  onChange={setAddressStreetNumber}
                  placeholder="e.g., 12"
                />
              </Field>

              <Field label="Floor">
                <TextInput value={addressFloor} onChange={setAddressFloor} placeholder="e.g., 3" />
              </Field>

              <Field label="Apt">
                <TextInput value={addressApt} onChange={setAddressApt} placeholder="e.g., 8" />
              </Field>
            </div>
          </section>
        </div>

        <div className="mt-8 border-t border-slate-100 pt-6">
          <div className={profileTheme.actions}>
            <button
              type="button"
              className={profileTheme.buttonPrimary}
              onClick={handleSubmit}
              disabled={!canSubmit}
            >
              {busy ? 'Saving…' : 'Save Profile'}
            </button>
          </div>
          {loadedUser ? (
            <div className="mt-3 text-xs text-slate-400">
              Your points: <span className="font-semibold">{loadedUser.pointsBalance ?? 0}</span>
            </div>
          ) : null}
        </div>
      </div>
    </ProfileShell>
  )
}


