'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
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
import { useFavorites } from '@/app/hooks/useFavorites'
import { productService, Product } from '@/lib/firebase'
import { parseFavoriteKey } from '@/lib/favorites'
import {
  PencilIcon,
  CheckIcon,
  XMarkIcon,
  ShoppingBagIcon,
  HeartIcon,
  SparklesIcon,
  CalendarIcon
} from '@heroicons/react/24/outline'
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid'

interface FavoriteItem extends Product {
  favoriteKey: string
  favoriteBaseSku: string
  favoriteColorSlug?: string
}

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

  const { user: firebaseUser, loading: authLoading } = useAuth()
  const { favorites: favoriteKeys, toggleFavorite } = useFavorites()

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

  const requiredErrors = useMemo(() => {
    const errors: Record<string, string> = {}
    if (!firstName.trim()) errors.firstName = 'First name is required'
    if (!lastName.trim()) errors.lastName = 'Last name is required'
    if (!phone.trim()) errors.phone = 'Phone is required'
    if (!language.trim()) errors.language = 'Language is required'
    return errors
  }, [firstName, lastName, phone, language])

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

        const json = await res.json()
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
        if (!cancelled) setError(e?.message || 'Unable to load profile')
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

        const json = await res.json()
        if (!res.ok || !json || json.error) {
          throw new Error(json?.error || 'Failed to load orders')
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

        const json = await res.json()
        if (!res.ok || !json || json.error) {
          throw new Error(json?.error || 'Failed to load points')
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

      const json = await res.json()
      if (!res.ok || !json || json.error) {
        throw new Error(json?.error || `HTTP ${res.status}`)
      }

      setLoadedUser(json.user)
      setIsEditing(false)
    } catch (e: any) {
      setError(e?.message || 'Unable to save profile')
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

  if (authLoading || !loadedUser) {
    return (
      <ProfileShell title="My Profile" subtitle="Loading...">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </ProfileShell>
    )
  }

  const memberSince = new Date(loadedUser.createdAt).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric'
  })

  return (
    <ProfileShell title="My Profile" subtitle={`Welcome back, ${firstName || 'User'}!`}>
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
                Member since {memberSince}
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500">Points Balance</div>
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
            <h3 className={profileTheme.sectionTitle}>Personal Information</h3>
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center text-sm text-indigo-600 hover:text-indigo-700"
              >
                <PencilIcon className="h-4 w-4 mr-1" />
                Edit
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={handleCancelEdit}
                  disabled={busy}
                  className="flex items-center text-sm text-gray-600 hover:text-gray-700"
                >
                  <XMarkIcon className="h-4 w-4 mr-1" />
                  Cancel
                </button>
                <button
                  onClick={handleSaveProfile}
                  disabled={busy || Object.keys(requiredErrors).length > 0}
                  className="flex items-center text-sm text-green-600 hover:text-green-700 disabled:opacity-50"
                >
                  <CheckIcon className="h-4 w-4 mr-1" />
                  {busy ? 'Saving...' : 'Save'}
                </button>
              </div>
            )}
          </div>

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
                disabled={!isEditing}
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
                disabled={!isEditing}
                placeholder="Last name"
              />
            </Field>

            <Field label="Email Address" hint="Cannot be changed">
              <TextInput value={email} onChange={() => {}} disabled placeholder="Email" />
            </Field>

            <Field label="Phone Number" error={touched.phone ? requiredErrors.phone : null}>
              <TextInput
                value={phone}
                onChange={(v) => {
                  setTouched((t) => ({ ...t, phone: true }))
                  setPhone(v)
                }}
                disabled={!isEditing}
                placeholder="+972..."
                inputMode="tel"
              />
            </Field>

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
                disabled={!isEditing}
                placeholder="Select Language"
                options={[
                  { value: 'en', label: 'English' },
                  { value: 'he', label: 'Hebrew' }
                ]}
              />
            </Field>

            <div className="sm:col-span-2">
              <Field label="Gender" hint="Optional">
                <RadioGroup
                  value={gender}
                  onChange={setGender}
                  disabled={!isEditing}
                  options={[
                    { value: 'Male', label: 'Male' },
                    { value: 'Female', label: 'Female' },
                    { value: 'Other', label: 'Other' },
                    { value: 'Prefer not to say', label: 'Prefer not to say' }
                  ]}
                />
              </Field>
            </div>
          </div>

          {/* Address Section */}
          <div className="mt-6">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Address</h4>
            <div className={profileTheme.grid}>
              <Field label="Street Address">
                <TextInput
                  value={addressStreet}
                  onChange={setAddressStreet}
                  disabled={!isEditing}
                  placeholder="e.g., Ben Yehuda"
                />
              </Field>

              <Field label="Street Number">
                <TextInput
                  value={addressStreetNumber}
                  onChange={setAddressStreetNumber}
                  disabled={!isEditing}
                  placeholder="e.g., 12"
                />
              </Field>

              <Field label="Floor">
                <TextInput
                  value={addressFloor}
                  onChange={setAddressFloor}
                  disabled={!isEditing}
                  placeholder="e.g., 3"
                />
              </Field>

              <Field label="Apt">
                <TextInput
                  value={addressApt}
                  onChange={setAddressApt}
                  disabled={!isEditing}
                  placeholder="e.g., 8"
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
              label="Newsletter Subscription"
              description="Receive updates, offers, and news via email."
            />
          </div>
        </div>

        {/* Order History */}
        <div className={profileTheme.section}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={profileTheme.sectionTitle}>Recent Orders</h3>
            {orders.length > 0 && (
              <Link
                href={`/${lng}/orders`}
                className="text-sm text-indigo-600 hover:text-indigo-700"
              >
                View All
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
              <p>No orders yet</p>
              <Link
                href={`/${lng}`}
                className="text-indigo-600 hover:text-indigo-700 text-sm mt-2 inline-block"
              >
                Start Shopping
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
                        Order #{order.orderNumber}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(order.createdAt).toLocaleDateString('en-US', {
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
                    {order.orderItems.length} item{order.orderItems.length !== 1 ? 's' : ''}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Points History */}
        <div className={profileTheme.section}>
          <h3 className={profileTheme.sectionTitle}>Points History</h3>
          <p className="text-sm text-gray-600 mb-4">
            Earn 5% back in points on every purchase. Use points towards future orders!
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
              <p>No points activity yet</p>
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
                      {transaction.kind === 'EARN' ? 'Earned' : 'Spent'} Points
                    </p>
                    {transaction.order && (
                      <p className="text-xs text-gray-500">
                        Order #{transaction.order.orderNumber}
                      </p>
                    )}
                    <p className="text-xs text-gray-400">
                      {new Date(transaction.createdAt).toLocaleDateString('en-US', {
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
            <h3 className={profileTheme.sectionTitle}>Favorites</h3>
            {favoriteProducts.length > 0 && (
              <Link
                href={`/${lng}/favorites`}
                className="text-sm text-indigo-600 hover:text-indigo-700"
              >
                View All ({favoriteKeys.length})
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
              <p>No favorites yet</p>
              <Link
                href={`/${lng}`}
                className="text-indigo-600 hover:text-indigo-700 text-sm mt-2 inline-block"
              >
                Browse Products
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
                        aria-label="Remove from favorites"
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
      </div>
    </ProfileShell>
  )
}

