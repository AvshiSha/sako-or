'use client'

import { useEffect, useMemo, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { useAuth } from '@/app/contexts/AuthContext'
import ProfileShell from '@/app/components/profile/ProfileShell'
import { profileTheme } from '@/app/components/profile/profileTheme'
import { cn } from '@/lib/utils'
import {
  Checkbox,
  Field,
  RadioGroup,
  SelectInput,
  TextInput
} from '@/app/components/profile/ProfileFormFields'
import { useFavorites } from '@/app/hooks/useFavorites'
import { useCart } from '@/app/hooks/useCart'
import { productService, Product } from '@/lib/firebase'
import { parseFavoriteKey } from '@/lib/favorites'
import { clearGuestStateStorage } from '@/lib/guestReset'
import {
  PencilIcon,
  CheckIcon,
  XMarkIcon,
  ShoppingBagIcon,
  HeartIcon,
  SparklesIcon,
  CalendarIcon,
  ArrowRightOnRectangleIcon
} from '@heroicons/react/24/outline'
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid'

interface FavoriteItem extends Product {
  favoriteKey: string
  favoriteBaseSku: string
  favoriteColorSlug?: string
}

const translations = {
  en: {
    pageTitle: 'My Profile',
    loading: 'Loading…',
    welcomeBack: (name: string) => `Welcome back, ${name}!`,
    userFallback: 'User',
    unableToLoadProfile: 'Unable to load profile',
    pointsBalance: 'Points Balance',
    personalInformation: 'Personal Information',
    edit: 'Edit',
    cancel: 'Cancel',
    save: 'Save',
    saving: 'Saving…',
    firstName: 'First Name',
    firstNamePlaceholder: 'First name',
    lastName: 'Last Name',
    lastNamePlaceholder: 'Last name',
    emailAddress: 'Email Address',
    emailPlaceholder: 'Email',
    cannotBeChanged: 'Cannot be changed',
    phoneNumber: 'Phone Number',
    phonePlaceholder: '+972...',
    preferredLanguage: 'Preferred Language',
    selectLanguage: 'Select Language',
    english: 'English',
    hebrew: 'Hebrew',
    gender: 'Gender',
    optional: 'Optional',
    male: 'Male',
    female: 'Female',
    other: 'Other',
    preferNotToSay: 'Prefer not to say',
    address: 'Address',
    streetAddress: 'Street Address',
    streetAddressPlaceholder: 'e.g., Ben Yehuda',
    streetNumber: 'Street Number',
    streetNumberPlaceholder: 'e.g., 12',
    floor: 'Floor',
    floorPlaceholder: 'e.g., 3',
    apt: 'Apt',
    aptPlaceholder: 'e.g., 8',
    newsletterSubscription: 'Newsletter Subscription',
    newsletterDescription: 'Receive updates, offers, and news via email.',
    recentOrders: 'Recent Orders',
    viewAll: 'View All',
    noOrdersYet: 'No orders yet',
    startShopping: 'Start Shopping',
    orderNumber: (n: string) => `Order #${n}`,
    itemsCount: (n: number) => `${n} item${n === 1 ? '' : 's'}`,
    pointsHistory: 'Points History',
    pointsHelp: 'Earn 5% back in points on every purchase. Use points towards future orders!',
    noPointsActivityYet: 'No points activity yet',
    earnedPoints: 'Earned Points',
    spentPoints: 'Spent Points',
    favorites: 'Favorites',
    viewAllWithCount: (n: number) => `View All (${n})`,
    noFavoritesYet: 'No favorites yet',
    browseProducts: 'Browse Products',
    removeFromFavorites: 'Remove from favorites',
    accountActions: 'Account Actions',
    logOut: 'Log out',
    signInDifferentAccount: 'Sign in with a different account',
    logoutInfo:
      'Logging out will clear your cart, favorites, and coupons on this device. Your order history and points stay in your account and will be available when you sign in again.',
    closeDialog: 'Close dialog',
    logoutDialogTitle: 'Log out and continue as guest?',
    logoutDialogDescription:
      'This will clear your cart, favorites, and coupons on this device. Your profile, order history, and points stay in your account and will be available when you sign in again.',
    // Validation
    firstNameRequired: 'First name is required',
    lastNameRequired: 'Last name is required',
    phoneRequired: 'Phone is required',
    languageRequired: 'Language is required',
    memberSince: (value: string) => `Member since ${value}`
    ,
    failedToLoadOrders: 'Failed to load orders',
    failedToLoadPoints: 'Failed to load points',
    unableToSaveProfile: 'Unable to save profile',
    failedToLogout: 'Failed to log out. Please try again.'
  },
  he: {
    pageTitle: 'הפרופיל שלי',
    loading: 'טוען…',
    welcomeBack: (name: string) => `ברוך שובך, ${name}!`,
    userFallback: 'משתמש',
    unableToLoadProfile: 'לא ניתן לטעון את הפרופיל',
    pointsBalance: 'יתרת נקודות',
    personalInformation: 'מידע אישי',
    edit: 'עריכה',
    cancel: 'ביטול',
    save: 'שמירה',
    saving: 'שומר…',
    firstName: 'שם פרטי',
    firstNamePlaceholder: 'שם פרטי',
    lastName: 'שם משפחה',
    lastNamePlaceholder: 'שם משפחה',
    emailAddress: 'אימייל',
    emailPlaceholder: 'אימייל',
    cannotBeChanged: 'לא ניתן לשינוי',
    phoneNumber: 'מספר טלפון',
    phonePlaceholder: '+972...',
    preferredLanguage: 'שפה מועדפת',
    selectLanguage: 'בחר שפה',
    english: 'אנגלית',
    hebrew: 'עברית',
    gender: 'מגדר',
    optional: 'אופציונלי',
    male: 'זכר',
    female: 'נקבה',
    other: 'אחר',
    preferNotToSay: 'מעדיף/ה לא לציין',
    address: 'כתובת',
    streetAddress: 'רחוב',
    streetAddressPlaceholder: 'לדוגמה, בן יהודה',
    streetNumber: 'מספר',
    streetNumberPlaceholder: 'לדוגמה, 12',
    floor: 'קומה',
    floorPlaceholder: 'לדוגמה, 3',
    apt: 'דירה',
    aptPlaceholder: 'לדוגמה, 8',
    newsletterSubscription: 'הרשמה לניוזלטר',
    newsletterDescription: 'קבלו עדכונים, מבצעים וחדשות במייל.',
    recentOrders: 'הזמנות אחרונות',
    viewAll: 'צפה בהכל',
    noOrdersYet: 'אין הזמנות עדיין',
    startShopping: 'התחל לקנות',
    orderNumber: (n: string) => `הזמנה #${n}`,
    itemsCount: (n: number) => `${n} פריט${n === 1 ? '' : 'ים'}`,
    pointsHistory: 'היסטוריית נקודות',
    pointsHelp: 'צברו 5% בחזרה כנקודות על כל רכישה. השתמשו בנקודות להזמנות עתידיות!',
    noPointsActivityYet: 'אין פעילות נקודות עדיין',
    earnedPoints: 'נקודות שנצברו',
    spentPoints: 'נקודות שנוצלו',
    favorites: 'מועדפים',
    viewAllWithCount: (n: number) => `צפה בהכל (${n})`,
    noFavoritesYet: 'אין מועדפים עדיין',
    browseProducts: 'עיינו במוצרים',
    removeFromFavorites: 'הסר מהמועדפים',
    accountActions: 'פעולות חשבון',
    logOut: 'התנתקות',
    signInDifferentAccount: 'התחבר עם חשבון אחר',
    logoutInfo:
      'התנתקות תנקה את העגלה, המועדפים והקופונים במכשיר זה. היסטוריית ההזמנות והנקודות נשמרות בחשבון ויהיו זמינות כשתתחברו שוב.',
    closeDialog: 'סגור חלון',
    logoutDialogTitle: 'להתנתק ולהמשיך כאורח?',
    logoutDialogDescription:
      'זה ינקה את העגלה, המועדפים והקופונים במכשיר זה. הפרופיל, היסטוריית ההזמנות והנקודות נשמרים בחשבון ויהיו זמינים כשתתחברו שוב.',
    // Validation
    firstNameRequired: 'שם פרטי הוא חובה',
    lastNameRequired: 'שם משפחה הוא חובה',
    phoneRequired: 'מספר טלפון הוא חובה',
    languageRequired: 'שפה היא חובה',
    memberSince: (value: string) => `חבר מאז ${value}`
    ,
    failedToLoadOrders: 'לא ניתן לטעון הזמנות',
    failedToLoadPoints: 'לא ניתן לטעון נקודות',
    unableToSaveProfile: 'לא ניתן לשמור את הפרופיל',
    failedToLogout: 'ההתנתקות נכשלה. נסו שוב.'
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
  gender: string | null
  addressStreet: string | null
  addressStreetNumber: string | null
  addressFloor: string | null
  addressApt: string | null
  isNewsletter: boolean
  pointsBalance: number
  role: string
  createdAt: string
  updatedAt: string
}

type OrderItem = {
  id: string
  quantity: number
  price: number
  total: number
  productName: string
  productSku: string
  colorName: string | null
  size: string | null
}

type Order = {
  id: string
  orderNumber: string
  status: string
  total: number
  currency: string
  createdAt: string
  orderItems: OrderItem[]
}

type PointsTransaction = {
  id: string
  kind: 'EARN' | 'SPEND'
  delta: number
  reason: string
  createdAt: string
  order: {
    orderNumber: string
    total: number
    currency: string
    createdAt: string
  } | null
}

export default function ProfilePage() {
  const router = useRouter()
  const params = useParams()
  const lng = (params?.lng as string) || 'en'
  const t = (translations as any)[lng] || translations.en
  const locale = lng === 'he' ? 'he-IL' : 'en-US'

  const { user: firebaseUser, loading: authLoading, logout } = useAuth()
  const { favorites: favoriteKeys, toggleFavorite, clearAllLocal: clearFavorites } = useFavorites()
  const { clearCart } = useCart()

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadedUser, setLoadedUser] = useState<ApiUser | null>(null)
  const [isEditing, setIsEditing] = useState(false)

  // Form fields
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [language, setLanguage] = useState('')
  const [gender, setGender] = useState('')
  const [addressStreet, setAddressStreet] = useState('')
  const [addressStreetNumber, setAddressStreetNumber] = useState('')
  const [addressFloor, setAddressFloor] = useState('')
  const [addressApt, setAddressApt] = useState('')
  const [isNewsletter, setIsNewsletter] = useState(false)

  // Orders and points
  const [orders, setOrders] = useState<Order[]>([])
  const [ordersLoading, setOrdersLoading] = useState(true)
  const [pointsHistory, setPointsHistory] = useState<PointsTransaction[]>([])
  const [pointsLoading, setPointsLoading] = useState(true)

  // Favorites
  const [favoriteProducts, setFavoriteProducts] = useState<FavoriteItem[]>([])
  const [favoritesLoading, setFavoritesLoading] = useState(true)

  const [touched, setTouched] = useState<Record<string, boolean>>({})

  // Logout state
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const isLoggingOutRef = useRef(false)
  const cancelLogoutButtonRef = useRef<HTMLButtonElement | null>(null)

  const requiredErrors = useMemo(() => {
    const errors: Record<string, string> = {}
    if (!firstName.trim()) errors.firstName = t.firstNameRequired
    if (!lastName.trim()) errors.lastName = t.lastNameRequired
    if (!phone.trim()) errors.phone = t.phoneRequired
    if (!language.trim()) errors.language = t.languageRequired
    return errors
  }, [firstName, lastName, phone, language, t])

  // Load user profile
  useEffect(() => {
    if (authLoading) return
    if (!firebaseUser) {
      // Don't redirect to signin if we're in the process of logging out to guest mode
      if (!isLoggingOutRef.current) {
        router.replace(`/${lng}/signin`)
      }
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
        setLanguage(json.user.language ?? lng ?? '')
        setGender(json.user.gender ?? '')
        setAddressStreet(json.user.addressStreet ?? '')
        setAddressStreetNumber(json.user.addressStreetNumber ?? '')
        setAddressFloor(json.user.addressFloor ?? '')
        setAddressApt(json.user.addressApt ?? '')
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
  }, [firebaseUser, authLoading, router, lng])

  // Load orders
  useEffect(() => {
    if (!firebaseUser || !loadedUser) return

    let cancelled = false
    ;(async () => {
      setOrdersLoading(true)
      try {
        const token = await firebaseUser.getIdToken()
        const res = await fetch('/api/me/orders?limit=5', {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` }
        })

        const json = await res.json().catch(() => ({}))
        if (!res.ok || !json || json.error) {
          throw new Error(json?.error || t.failedToLoadOrders)
        }

        if (!cancelled) setOrders(json.orders || [])
      } catch (e: any) {
        console.error('Error loading orders:', e)
      } finally {
        if (!cancelled) setOrdersLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [firebaseUser, loadedUser])

  // Load points
  useEffect(() => {
    if (!firebaseUser || !loadedUser) return

    let cancelled = false
    ;(async () => {
      setPointsLoading(true)
      try {
        const token = await firebaseUser.getIdToken()
        const res = await fetch('/api/me/points?limit=5', {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` }
        })

        const json = await res.json().catch(() => ({}))
        if (!res.ok || !json || json.error) {
          throw new Error(json?.error || t.failedToLoadPoints)
        }

        if (!cancelled) setPointsHistory(json.pointsHistory || [])
      } catch (e: any) {
        console.error('Error loading points:', e)
      } finally {
        if (!cancelled) setPointsLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [firebaseUser, loadedUser])

  // Load favorite products
  useEffect(() => {
    if (!favoriteKeys || favoriteKeys.length === 0) {
      setFavoriteProducts([])
      setFavoritesLoading(false)
      return
    }

    let cancelled = false
    ;(async () => {
      setFavoritesLoading(true)
      try {
        const productsToLoad = favoriteKeys.slice(0, 4)
        const favoriteItems: FavoriteItem[] = []
        
        // Cache by baseSku to avoid refetching the same product for multiple colors
        const productCache = new Map<string, Product | null>()

        for (const favoriteKey of productsToLoad) {
          const { baseSku, colorSlug } = parseFavoriteKey(favoriteKey)
          if (!baseSku) continue

          let product = productCache.get(baseSku)
          if (product === undefined) {
            try {
              product = await productService.getProductByBaseSku(baseSku)
              if (!product) {
                product = await productService.getProductBySku(baseSku)
              }
            } catch (e) {
              console.error(`Error loading product ${baseSku}:`, e)
              product = null
            }
            productCache.set(baseSku, product)
          }

          if (product && product.isEnabled && !product.isDeleted) {
            favoriteItems.push({
              ...product,
              favoriteKey,
              favoriteBaseSku: baseSku,
              favoriteColorSlug: colorSlug || undefined
            })
          }
        }

        if (!cancelled) setFavoriteProducts(favoriteItems)
      } catch (e: any) {
        console.error('Error loading favorites:', e)
      } finally {
        if (!cancelled) setFavoritesLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [favoriteKeys])

  async function handleSaveProfile() {
    if (!firebaseUser) return
    setTouched({
      firstName: true,
      lastName: true,
      phone: true,
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
        language: language === 'he' || language === 'en' ? language : undefined,
        gender: gender ? gender : null,
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

      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json || json.error) {
        throw new Error(json?.error || `HTTP ${res.status}`)
      }

      setLoadedUser(json.user)
      setIsEditing(false)
    } catch (e: any) {
      setError(e?.message || t.unableToSaveProfile)
    } finally {
      setBusy(false)
    }
  }

  function handleCancelEdit() {
    if (!loadedUser) return
    setFirstName(loadedUser.firstName ?? '')
    setLastName(loadedUser.lastName ?? '')
    setPhone(loadedUser.phone ?? '')
    setLanguage(loadedUser.language ?? lng ?? '')
    setGender(loadedUser.gender ?? '')
    setAddressStreet(loadedUser.addressStreet ?? '')
    setAddressStreetNumber(loadedUser.addressStreetNumber ?? '')
    setAddressFloor(loadedUser.addressFloor ?? '')
    setAddressApt(loadedUser.addressApt ?? '')
    setIsNewsletter(Boolean(loadedUser.isNewsletter))
    setIsEditing(false)
    setTouched({})
    setError(null)
  }

  async function handleLogoutToGuest() {
    setShowLogoutConfirm(false)
    isLoggingOutRef.current = true
    
    try {
      // 1. Clear React state for favorites and cart (this will also trigger localStorage removal)
      clearFavorites()
      clearCart()
      
      // 2. Clear remaining localStorage (coupons, etc.)
      clearGuestStateStorage()
      
      // 3. Sign out from Firebase
      await logout()
      
      // 4. Redirect to home as guest
      router.replace(`/${lng}`)
    } catch (error) {
      console.error('Error during logout:', error)
      isLoggingOutRef.current = false
      setError(t.failedToLogout)
    }
  }

  // Basic dialog UX: ESC closes, focus cancel on open
  useEffect(() => {
    if (!showLogoutConfirm) return

    cancelLogoutButtonRef.current?.focus()

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowLogoutConfirm(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [showLogoutConfirm])

  if (authLoading || !loadedUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#856D55] mx-auto"></div>
          <p className="mt-4 text-gray-600">{lng === 'he' ? 'טוען...' : 'Loading...'}</p>
        </div>
      </div>
    )
  }

  const memberSince = new Date(loadedUser.createdAt).toLocaleDateString(locale, {
    month: 'long',
    year: 'numeric'
  })

  return (
    <ProfileShell
      title={t.pageTitle}
      subtitle={t.welcomeBack(firstName || t.userFallback)}
    >
      <div className="space-y-8">
        {/* Profile Header */}
        <div className={profileTheme.section}>
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {firstName} {lastName}
              </h2>
              <p className="text-sm text-gray-500">{email}</p>
              <p className="text-xs text-gray-400 flex items-center mt-1">
                <CalendarIcon className="h-4 w-4 mr-1" />
                {t.memberSince(memberSince)}
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500">{t.pointsBalance}</div>
              <div className="text-3xl font-bold text-indigo-600 flex items-center">
                <SparklesIcon className="h-6 w-6 mr-1" />
                {loadedUser.pointsBalance}
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Personal Information */}
        <div className={profileTheme.section}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={profileTheme.sectionTitle}>{t.personalInformation}</h3>
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center text-sm text-indigo-600 hover:text-indigo-700"
              >
                <PencilIcon className="h-4 w-4 mr-1" />
                {t.edit}
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={handleCancelEdit}
                  disabled={busy}
                  className="flex items-center text-sm text-gray-600 hover:text-gray-700"
                >
                  <XMarkIcon className="h-4 w-4 mr-1" />
                  {t.cancel}
                </button>
                <button
                  onClick={handleSaveProfile}
                  disabled={busy || Object.keys(requiredErrors).length > 0}
                  className="flex items-center text-sm text-green-600 hover:text-green-700 disabled:opacity-50"
                >
                  <CheckIcon className="h-4 w-4 mr-1" />
                  {busy ? t.saving : t.save}
                </button>
              </div>
            )}
          </div>

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
                disabled={!isEditing}
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
                disabled={!isEditing}
                placeholder={t.lastNamePlaceholder}
              />
            </Field>

            <Field label={t.emailAddress} hint={t.cannotBeChanged}>
              <TextInput value={email} onChange={() => {}} disabled placeholder={t.emailPlaceholder} />
            </Field>

            <Field label={t.phoneNumber} error={touched.phone ? requiredErrors.phone : null}>
              <TextInput
                value={phone}
                onChange={(v) => {
                  setTouched((t) => ({ ...t, phone: true }))
                  setPhone(v)
                }}
                disabled={!isEditing}
                placeholder={t.phonePlaceholder}
                inputMode="tel"
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
                disabled={!isEditing}
                placeholder={t.selectLanguage}
                options={[
                  { value: 'en', label: t.english },
                  { value: 'he', label: t.hebrew }
                ]}
              />
            </Field>

            <div className="sm:col-span-2">
              <Field label={t.gender} hint={t.optional}>
                <RadioGroup
                  value={gender}
                  onChange={setGender}
                  disabled={!isEditing}
                  options={[
                    { value: 'Male', label: t.male },
                    { value: 'Female', label: t.female },
                    { value: 'Other', label: t.other },
                    { value: 'Prefer not to say', label: t.preferNotToSay }
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
                  disabled={!isEditing}
                  placeholder={t.streetAddressPlaceholder}
                />
              </Field>

              <Field label={t.streetNumber}>
                <TextInput
                  value={addressStreetNumber}
                  onChange={setAddressStreetNumber}
                  disabled={!isEditing}
                  placeholder={t.streetNumberPlaceholder}
                />
              </Field>

              <Field label={t.floor}>
                <TextInput
                  value={addressFloor}
                  onChange={setAddressFloor}
                  disabled={!isEditing}
                  placeholder={t.floorPlaceholder}
                />
              </Field>

              <Field label={t.apt}>
                <TextInput
                  value={addressApt}
                  onChange={setAddressApt}
                  disabled={!isEditing}
                  placeholder={t.aptPlaceholder}
                />
              </Field>
            </div>
          </div>

          {/* Newsletter Section */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <Checkbox
              checked={isNewsletter}
              onChange={setIsNewsletter}
              disabled={!isEditing}
              label={t.newsletterSubscription}
              description={t.newsletterDescription}
            />
          </div>
        </div>

        {/* Order History */}
        <div className={profileTheme.section}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={profileTheme.sectionTitle}>{t.recentOrders}</h3>
            {orders.length > 0 && (
              <Link
                href={`/${lng}/orders`}
                className="text-sm text-indigo-600 hover:text-indigo-700"
              >
                {t.viewAll}
              </Link>
            )}
          </div>

          {ordersLoading ? (
            <div className="animate-pulse space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-20 bg-gray-100 rounded"></div>
              ))}
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <ShoppingBagIcon className="h-12 w-12 mx-auto mb-2 text-gray-300" />
              <p>{t.noOrdersYet}</p>
              <Link
                href={`/${lng}`}
                className="text-indigo-600 hover:text-indigo-700 text-sm mt-2 inline-block"
              >
                {t.startShopping}
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="border border-gray-200 rounded-lg p-4 hover:border-indigo-300 transition-colors"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-semibold text-gray-900">
                        {t.orderNumber(order.orderNumber)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(order.createdAt).toLocaleDateString(locale, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900">
                        {order.currency === 'ILS' ? '₪' : '$'}
                        {order.total.toFixed(2)}
                      </p>
                      <p className="text-xs text-gray-500 capitalize">{order.status}</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600">
                    {t.itemsCount(order.orderItems.length)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Points History */}
        <div className={profileTheme.section}>
          <h3 className={profileTheme.sectionTitle}>{t.pointsHistory}</h3>
          <p className="text-sm text-gray-600 mb-4">
            {t.pointsHelp}
          </p>

          {pointsLoading ? (
            <div className="animate-pulse space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-100 rounded"></div>
              ))}
            </div>
          ) : pointsHistory.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <SparklesIcon className="h-12 w-12 mx-auto mb-2 text-gray-300" />
              <p>{t.noPointsActivityYet}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {pointsHistory.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex justify-between items-center py-3 border-b border-gray-100 last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {transaction.kind === 'EARN' ? t.earnedPoints : t.spentPoints}
                    </p>
                    {transaction.order && (
                      <p className="text-xs text-gray-500">
                        {t.orderNumber(transaction.order.orderNumber)}
                      </p>
                    )}
                    <p className="text-xs text-gray-400">
                      {new Date(transaction.createdAt).toLocaleDateString(locale, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </p>
                  </div>
                  <div
                    className={`text-lg font-bold ${
                      transaction.kind === 'EARN' ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {transaction.delta > 0 ? '+' : ''}
                    {transaction.delta}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Favorites Preview */}
        <div className={profileTheme.section}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={profileTheme.sectionTitle}>{t.favorites}</h3>
            {favoriteProducts.length > 0 && (
              <Link
                href={`/${lng}/favorites`}
                className="text-sm text-indigo-600 hover:text-indigo-700"
              >
                {t.viewAllWithCount(favoriteKeys.length)}
              </Link>
            )}
          </div>

          {favoritesLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="aspect-square bg-gray-200 rounded-lg mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                </div>
              ))}
            </div>
          ) : favoriteProducts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <HeartIcon className="h-12 w-12 mx-auto mb-2 text-gray-300" />
              <p>{t.noFavoritesYet}</p>
              <Link
                href={`/${lng}`}
                className="text-indigo-600 hover:text-indigo-700 text-sm mt-2 inline-block"
              >
                {t.browseProducts}
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {favoriteProducts.map((product) => {
                const activeVariants = product.colorVariants
                  ? Object.values(product.colorVariants).filter((v: any) => v?.isActive !== false)
                  : []

                // Find the preferred color variant based on favoriteColorSlug
                const preferredVariant = product.favoriteColorSlug
                  ? activeVariants.find((v: any) => v?.colorSlug === product.favoriteColorSlug) || null
                  : null

                const firstVariant = preferredVariant || activeVariants[0] || null
                const chosenColorSlug = firstVariant?.colorSlug || product.favoriteColorSlug || 'default'
                const imageSrc =
                  firstVariant?.primaryImage ||
                  firstVariant?.images?.[0] ||
                  (product as any).primaryImage ||
                  (product as any).images?.[0] ||
                  '/images/placeholder.svg'

                return (
                  <div key={product.favoriteKey} className="group">
                    <div className="aspect-square relative rounded-lg overflow-hidden bg-gray-100 mb-2">
                      <Link href={`/${lng}/product/${product.favoriteBaseSku}/${chosenColorSlug}`}>
                        <Image
                          src={imageSrc}
                          alt={lng === 'he' ? product.title_he : product.title_en}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform"
                        />
                      </Link>
                      
                      {/* Favorite Button */}
                      <button
                        onClick={() => void toggleFavorite(product.favoriteKey)}
                        className="absolute top-2 right-2 p-1.5 bg-white rounded-full shadow-md hover:shadow-lg transition-shadow z-10"
                        aria-label={t.removeFromFavorites}
                      >
                        <HeartSolidIcon className="h-4 w-4 text-red-500" />
                      </button>
                    </div>
                    <Link href={`/${lng}/product/${product.favoriteBaseSku}/${chosenColorSlug}`}>
                      <p className="text-sm text-gray-900 line-clamp-2 group-hover:text-indigo-600">
                        {lng === 'he' ? product.title_he : product.title_en}
                      </p>
                    </Link>
                    <p className="text-sm font-bold text-gray-900">
                      ₪{product.salePrice && product.salePrice < product.price
                        ? product.salePrice.toFixed(2)
                        : product.price.toFixed(2)}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Account Actions */}
        <div className={profileTheme.section}>
          <h3 className={profileTheme.sectionTitle}>{t.accountActions}</h3>
          <div className="space-y-4">
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className={cn(profileTheme.buttonPrimary, 'gap-2')}
            >
              <ArrowRightOnRectangleIcon className="h-5 w-5" />
              {t.logOut}
            </button>
            
            <p className="text-sm text-slate-500">
              {t.logoutInfo}
            </p>
          </div>
        </div>
      </div>

      {/* Logout Confirmation Dialog */}
      {showLogoutConfirm && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="logout-confirm-title"
          aria-describedby="logout-confirm-desc"
        >
          <button
            type="button"
            className="fixed inset-0 bg-black/20 backdrop-blur-[1px]"
            aria-label={t.closeDialog}
            onClick={() => setShowLogoutConfirm(false)}
          />
          <div
            className={cn(
              'relative w-full max-w-md rounded-xl bg-white p-6 shadow-xl ring-1 ring-black/5'
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="logout-confirm-title" className="text-base font-semibold text-slate-900">
              {t.logoutDialogTitle}
            </h3>
            <p id="logout-confirm-desc" className="mt-2 text-sm leading-6 text-slate-600">
              {t.logoutDialogDescription}
            </p>

            <div className={cn(profileTheme.actions, 'mt-6')}>
              <button
                ref={cancelLogoutButtonRef}
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className={cn(profileTheme.buttonSecondary, 'w-full sm:w-auto')}
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={handleLogoutToGuest}
                className={cn(profileTheme.buttonPrimary, 'w-full sm:w-auto')}
              >
                {t.logOut}
              </button>
            </div>
          </div>
        </div>
      )}
    </ProfileShell>
  )
}

