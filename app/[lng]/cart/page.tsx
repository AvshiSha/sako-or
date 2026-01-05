'use client'

import { useState, useEffect, useMemo, useCallback, useRef, Suspense } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { 
  ShoppingBagIcon,
  TrashIcon,
  MinusIcon,
  PlusIcon
} from '@heroicons/react/24/outline'
import { useCart } from '@/app/hooks/useCart'
import CheckoutModal from '@/app/components/CheckoutModal'
import Accordion from '@/app/components/Accordion'
import { trackViewCart } from '@/lib/dataLayer'
import { CouponValidationSuccess } from '@/lib/coupons'
import { useAuth } from '@/app/contexts/AuthContext'
import { getColorName } from '@/lib/colors'

const couponContent = {
  en: {
    label: 'Have a coupon code?',
    placeholder: 'Enter coupon',
    apply: 'Apply',
    remove: 'Remove',
    discount: 'Discount',
    success: 'Coupon applied successfully.',
    removed: 'Coupon removed.',
    stackableNotice: 'This coupon stacks with existing discounts.',
    overridesNotice: 'This coupon replaces your current discount.',
    autoApplied: 'We found a coupon for you!',
    invalid: 'Invalid or expired coupon.',
    perUserRequired: 'Please sign in to use this coupon.',
    loading: 'Checking coupon…'
  },
  he: {
    label: 'יש לך קוד קופון?',
    placeholder: 'קוד קופון',
    apply: 'החל',
    remove: 'הסר',
    discount: 'הנחה',
    success: 'הקופון הופעל בהצלחה.',
    removed: 'הקופון הוסר.',
    stackableNotice: 'קופון זה ניתן לשילוב עם הנחות קיימות.',
    overridesNotice: 'קופון זה מחליף את ההנחה הנוכחית שלך.',
    autoApplied: 'מצאנו עבורך קופון!',
    invalid: 'קופון זה אינו תקף או שפג תוקפו.',
    perUserRequired: 'התחבר/י כדי להשתמש בקופון זה.',
    loading: 'בודק קופון…'
  }
} as const

const COUPON_STORAGE_KEY = 'cart_coupons'

function CartPageFallback() {
  return (
    <div className="min-h-screen bg-[#E1DBD7] pt-16" style={{ backgroundColor: '#E1DBD7' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="space-y-4">
            {[...Array(2)].map((_, idx) => (
              <div key={idx} className="bg-white rounded-lg shadow-sm p-6">
                <div className="h-4 bg-gray-200 rounded w-2/3 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function CartPageContent() {
  const params = useParams()
  const lng = params?.lng as string || 'en'
  const isRTL = lng === 'he'
  const couponStrings = couponContent[lng as keyof typeof couponContent]
  
  const { 
    items, 
    removeFromCart, 
    updateQuantity, 
    getTotalPrice, 
    getTotalItems,
    getDeliveryFee,
    getTotalWithDelivery,
    clearCart,
    loading 
  } = useCart()

  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false)

  const [isClient, setIsClient] = useState(false)
const [couponInput, setCouponInput] = useState('')
const [couponLoading, setCouponLoading] = useState(false)
const [couponStatus, setCouponStatus] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null)
const [appliedCoupons, setAppliedCoupons] = useState<CouponValidationSuccess[]>([])
const [autoApplyAttempted, setAutoApplyAttempted] = useState(false)
const pendingCodesRef = useRef<string[] | null>(null)
const initializedCouponsRef = useRef(false)
const revalidatingRef = useRef(false)
const lastCartSignatureRef = useRef<string | null>(null)
const urlCouponAttemptedRef = useRef<string | null>(null)
const searchParamsObj = useSearchParams()
const { user } = useAuth()
const appliedCodes = useMemo(() => appliedCoupons.map(coupon => coupon.coupon.code), [appliedCoupons])
const userIdentifier = user?.email ? user.email.toLowerCase() : undefined
const cartCurrency = useMemo(() => {
 return 'ILS'
}, [items])

const cartItemsPayload = useMemo(() => {
  return items.map(item => ({
    sku: item.sku,
    quantity: item.quantity,
    price: item.price,
    salePrice: item.salePrice,
    color: item.color,
    size: item.size
  }))
}, [items])

const cartItemsSignature = useMemo(() => JSON.stringify(cartItemsPayload), [cartItemsPayload])

const saveCouponsToStorage = useCallback((codes: string[]) => {
  if (typeof window === 'undefined') return
  try {
    if (codes.length === 0) {
      localStorage.removeItem(COUPON_STORAGE_KEY)
    } else {
      localStorage.setItem(COUPON_STORAGE_KEY, JSON.stringify(codes))
    }
  } catch (storageError) {
    console.warn('Failed to persist coupons:', storageError)
  }
}, [])

const loadCouponsFromStorage = useCallback((): string[] => {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(COUPON_STORAGE_KEY)
    if (!stored || !stored.trim()) return []
    const parsed = JSON.parse(stored)
    return Array.isArray(parsed) ? parsed.filter((code): code is string => typeof code === 'string') : []
  } catch (storageError) {
    console.warn('Failed to load coupons from storage:', storageError)
    return []
  }
}, [])

const applyCouponCode = useCallback(async (
  rawCode: string,
  options?: {
    presetResult?: CouponValidationSuccess
    silent?: boolean
    skipStorageUpdate?: boolean
  }
) => {
  const normalizedCode = rawCode.trim().toUpperCase()
  if (!normalizedCode) {
    return
  }

  if (appliedCodes.includes(normalizedCode)) {
    if (!options?.silent) {
      setCouponStatus({
        type: 'info',
        message: couponStrings.success
      })
    }
    return
  }

  try {
    setCouponLoading(!options?.presetResult)
    if (!options?.silent) {
      setCouponStatus(null)
    }

    let result: CouponValidationSuccess

    if (options?.presetResult) {
      result = options.presetResult
    } else {
      const response = await fetch('/api/coupons/apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          code: normalizedCode,
          cartItems: cartItemsPayload,
          currency: cartCurrency,
          locale: lng,
          userIdentifier,
          existingCouponCodes: appliedCodes
        })
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data.success) {
        if (!options?.silent) {
          const message = data?.messages?.[lng] ??
            (data?.code === 'MISSING_USER_IDENTIFIER'
              ? couponStrings.perUserRequired
              : couponStrings.invalid)
          setCouponStatus({
            type: 'error',
            message
          })
        }
        return
      }

      result = data as CouponValidationSuccess
    }

    setAppliedCoupons(prev => [...prev, result])
    if (!options?.skipStorageUpdate) {
      saveCouponsToStorage([...appliedCodes, result.coupon.code])
    }

    if (!options?.silent) {
      const baseMessage = result.messages[lng as 'en' | 'he'] || couponStrings.success
      const stackableNote = result.coupon.stackable && appliedCodes.length > 0
        ? ` ${couponStrings.stackableNotice}`
        : ''
      setCouponStatus({
        type: 'success',
        message: `${baseMessage}${stackableNote}`
      })
    }
    setCouponInput('')
  } catch (applyError) {
    console.error('[CART_APPLY_COUPON_ERROR]', applyError)
    if (!options?.silent) {
      setCouponStatus({
        type: 'error',
        message: couponStrings.invalid
      })
    }
  } finally {
    setCouponLoading(false)
  }
}, [appliedCodes, cartCurrency, cartItemsPayload, couponStrings.invalid, couponStrings.perUserRequired, couponStrings.success, lng, saveCouponsToStorage, userIdentifier])

const removeCoupon = useCallback((code: string) => {
  setAppliedCoupons(prev => prev.filter(coupon => coupon.coupon.code !== code))
  saveCouponsToStorage(appliedCodes.filter(existing => existing !== code))
  setCouponStatus({
    type: 'info',
    message: `${couponStrings.removed} (${code})`
  })
}, [appliedCodes, couponStrings.removed, saveCouponsToStorage])

const revalidateCouponCodes = useCallback(async (
  codes: string[],
  options?: { silent?: boolean }
) => {
  if (codes.length === 0) {
    setAppliedCoupons([])
    saveCouponsToStorage([])
    if (!options?.silent) {
      setCouponStatus(null)
    }
    return
  }

  if (loading || cartItemsPayload.length === 0) return

  revalidatingRef.current = true
  setCouponLoading(true)

  try {
    const validated: CouponValidationSuccess[] = []
    for (const code of codes) {
      const response = await fetch('/api/coupons/apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          code,
          cartItems: cartItemsPayload,
          currency: cartCurrency,
          locale: lng,
          userIdentifier,
          existingCouponCodes: validated.map(coupon => coupon.coupon.code)
        })
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data.success) {
        const message = data?.messages?.[lng] ?? couponStrings.invalid
        if (!options?.silent) {
          setCouponStatus({
            type: 'error',
            message
          })
        }
        break
      }

      validated.push(data as CouponValidationSuccess)
    }

    setAppliedCoupons(validated)
    saveCouponsToStorage(validated.map(coupon => coupon.coupon.code))

    if (!options?.silent && validated.length > 0) {
      setCouponStatus({
        type: 'success',
        message: couponStrings.success
      })
    }
  } catch (error) {
    console.error('[CART_REVALIDATE_COUPONS_ERROR]', error)
    if (!options?.silent) {
      setCouponStatus({
        type: 'error',
        message: couponStrings.invalid
      })
    }
  } finally {
    revalidatingRef.current = false
    setCouponLoading(false)
  }
}, [cartCurrency, cartItemsPayload, couponStrings.invalid, couponStrings.success, lng, loading, saveCouponsToStorage, userIdentifier])

  // Generate product name from cart items
  const getProductName = () => {
    if (items.length === 0) return 'Sako Order'
    
    if (items.length === 1) {
      const item = items[0]
      return `${item.name[lng as 'en' | 'he']}${item.color ? ` - ${item.color}` : ''}`
    }
    
    if (items.length === 2) {
      const item1 = items[0]
      const item2 = items[1]
      return `${item1.name[lng as 'en' | 'he']}${item1.color ? ` - ${item1.color}` : ''} + ${item2.name[lng as 'en' | 'he']}${item2.color ? ` - ${item2.color}` : ''}`
    }
    
    // For 3+ items, show first item + count
    const firstItem = items[0]
    const remainingCount = items.length - 1
    return `${firstItem.name[lng as 'en' | 'he']}${firstItem.color ? ` - ${firstItem.color}` : ''} + ${remainingCount} ${isRTL ? 'עוד פריטים' : 'more items'}`
  }

  // Localized content
  const content = {
    en: {
      title: 'Shopping Cart',
      emptyTitle: 'Your cart is empty',
      emptyDescription: 'Looks like you haven\'t added any items to your cart yet.',
      emptyButton: 'Continue Shopping',
      quantity: 'Quantity',
      remove: 'Remove',
      subtotal: 'Subtotal',
      delivery: 'Delivery Fee',
      total: 'Total',
      checkout: 'Proceed to Checkout',
      clearCart: 'Clear Cart',
      items: 'items',
      item: 'item',
      freeDelivery: 'Free delivery on orders over ₪300'
    },
    he: {
      title: 'עגלת קניות',
      emptyTitle: 'העגלה שלך ריקה',
      emptyDescription: 'נראה שעדיין לא הוספת פריטים לעגלה.',
      emptyButton: 'המשך לקנות',
      quantity: 'כמות',
      remove: 'הסר',
      subtotal: 'סכום ביניים',
      delivery: 'דמי משלוח',
      total: 'סה"כ',
      checkout: 'המשך לתשלום',
      clearCart: 'נקה עגלה',
      items: 'פריטים',
      item: 'פריט',
      freeDelivery: 'משלוח חינם בהזמנות מעל ₪300'
    }
  }

  const t = content[lng as keyof typeof content]

  useEffect(() => {
    setIsClient(true)
  }, [])

useEffect(() => {
  if (!isClient) return
  if (initializedCouponsRef.current) return
  const storedCodes = loadCouponsFromStorage()
  if (storedCodes.length > 0) {
    pendingCodesRef.current = storedCodes
  }
  initializedCouponsRef.current = true
}, [isClient, loadCouponsFromStorage])

useEffect(() => {
  if (!initializedCouponsRef.current) return
  if (loading) return
  if (!pendingCodesRef.current || pendingCodesRef.current.length === 0) return

  const codes = [...pendingCodesRef.current]
  pendingCodesRef.current = null
  revalidateCouponCodes(codes, { silent: true })
}, [loading, revalidateCouponCodes, cartItemsSignature])

useEffect(() => {
  if (!initializedCouponsRef.current) return
  if (loading) return
  if (revalidatingRef.current) return
  if (appliedCodes.length === 0) return
  if (pendingCodesRef.current && pendingCodesRef.current.length > 0) return

  if (lastCartSignatureRef.current === cartItemsSignature) return
  lastCartSignatureRef.current = cartItemsSignature

  revalidateCouponCodes(appliedCodes, { silent: true })
}, [appliedCodes, cartItemsSignature, loading, revalidateCouponCodes])

useEffect(() => {
  if (!searchParamsObj) return
  if (loading) return
  const couponFromUrl = searchParamsObj.get('coupon')
  if (!couponFromUrl) return
  if (urlCouponAttemptedRef.current === couponFromUrl.toUpperCase()) return

  urlCouponAttemptedRef.current = couponFromUrl.toUpperCase()
  applyCouponCode(couponFromUrl)
}, [applyCouponCode, loading, searchParamsObj])

useEffect(() => {
  if (loading) return
  if (cartItemsPayload.length === 0) return
  if (autoApplyAttempted) return
  if (pendingCodesRef.current && pendingCodesRef.current.length > 0) return
  if (appliedCoupons.length > 0) return

  const autoApply = async () => {
    try {
      const response = await fetch('/api/coupons/auto-apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          cartItems: cartItemsPayload,
          currency: cartCurrency,
          locale: lng,
          userIdentifier
        })
      })

      const data = await response.json().catch(() => ({}))
      if (response.ok && data.success) {
        await applyCouponCode(data.coupon.code, {
          presetResult: data as CouponValidationSuccess,
          silent: true
        })
        setCouponStatus({
          type: 'success',
          message: couponStrings.autoApplied
        })
      }
    } catch (error) {
      console.warn('Auto-apply coupon failed:', error)
    } finally {
      setAutoApplyAttempted(true)
    }
  }

  autoApply()
}, [applyCouponCode, appliedCoupons.length, autoApplyAttempted, cartCurrency, cartItemsPayload, couponStrings.autoApplied, lng, loading, userIdentifier])

useEffect(() => {
  if (!isClient || loading || items.length === 0) return

  try {
    const cartItems = items.map(item => ({
      name: item.name[lng as 'en' | 'he'] || 'Unknown Product',
      id: item.sku,
      price: item.salePrice || item.price,
      brand: undefined,
      categories: undefined,
      variant: [item.size, item.color].filter(Boolean).join('-') || undefined,
      quantity: item.quantity
    }))

    trackViewCart(cartItems, cartCurrency)
  } catch (dataLayerError) {
    console.warn('Data layer tracking error:', dataLayerError)
  }
}, [cartCurrency, isClient, items, loading, lng])

if (!isClient || loading) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#856D55] mx-auto"></div>
        <p className="mt-4 text-gray-600">{lng === 'he' ? 'טוען...' : 'Loading...'}</p>
      </div>
    </div>
  )
}

  const totalItems = getTotalItems()
  const subtotal = getTotalPrice()
  const deliveryFee = getDeliveryFee()
  const totalDiscount = appliedCoupons.reduce((sum, coupon) => sum + coupon.discountAmount, 0)
  const discountedSubtotal = Math.max(subtotal - totalDiscount, 0)
  const finalTotal = Math.max(discountedSubtotal + deliveryFee, 0)
  const cardFontFamily = isRTL ? 'Heebo, sans-serif' : 'Poppins, sans-serif'

  return (
    <div className="min-h-screen bg-[#E1DBD7] pt-16" dir={isRTL ? 'rtl' : 'ltr'} style={{ backgroundColor: '#E1DBD7' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-12">
        {/* Header */}
        <div className="mb-4 mt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <h1 className="text-3xl font-bold text-gray-900 flex items-center pt-1 pb-1 gap-4">
                <ShoppingBagIcon className="h-8 w-8 text-[#856D55] pt-1" />
                {t.title}
              </h1>
            </div>
          </div>
          {items.length > 0 && (
            <p className="text-gray-600 mt-2">
              {totalItems} {totalItems === 1 ? t.item : t.items}
            </p>
          )}
        </div>

        {/* Cart Content */}
        {items.length === 0 ? (
          /* Empty State */
          <div className="text-center py-12">
            <ShoppingBagIcon className="h-16 w-16 text-[#856D55] mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              {t.emptyTitle}
            </h2>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              {t.emptyDescription}
            </p>
            <Link
              href={`/${lng}`}
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-[#856D55] hover:bg-[#856D55]/90"
            >
              {t.emptyButton}
            </Link>
          </div>
        ) : (
          /* Cart Items */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Cart Items List */}
            <div className="lg:col-span-2">
              <div className="space-y-4">
                {items.map((item, index) => (
                  <div
                    key={`${item.sku}-${item.size}-${item.color}-${index}`}
                    className="bg-white border border-gray-200 rounded-[12px] shadow-sm p-4"
                    style={{ fontFamily: cardFontFamily }}
                  >
                    <div className={`flex ${isRTL ? 'flex-row-reverse' : 'flex-row'} items-start gap-4`}>
                      <div className="flex-1 min-w-0 flex flex-col gap-1">
                        <Link href={`/${lng}/product/${item.sku}/${item.color}`} className="block">
                          <h3
                            className="text-base font-semibold text-gray-900 hover:text-indigo-600 truncate"
                            title={item.name[lng as 'en' | 'he']}
                          >
                            {item.name[lng as 'en' | 'he']}
                          </h3>
                        </Link>

                        <div className={`space-y-1 text-sm leading-6 ${isRTL ? 'text-right' : 'text-left'}`} style={{ color: '#555555' }}>
                          {item.size && (
                            <div>
                              {lng === 'he' ? 'מידה' : 'Size'}: <span className="font-medium text-gray-700">{item.size}</span>
                            </div>
                          )}
                          {item.color && (
                            <div>
                              {lng === 'he' ? 'צבע' : 'Color'}: <span className="font-medium text-gray-700 capitalize">{getColorName(item.color, lng as 'en' | 'he')}</span>
                            </div>
                          )}
                        </div>

                        <div className={`${isRTL ? 'text-right' : 'text-left'}`}>
                          {item.salePrice && item.salePrice < item.price ? (
                            <div className="flex items-baseline gap-2">
                              <span className="text-sm line-through" style={{ color: '#888888' }}>
                                ₪{item.price.toFixed(2)}
                              </span>
                              <span className="text-base font-bold" style={{ color: '#d32f2f' }}>
                                ₪{item.salePrice.toFixed(2)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-base font-bold text-black">
                              ₪{(item.salePrice || item.price).toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>

                      <Link href={`/${lng}/product/${item.sku}${item.color ? `/${item.color}` : ''}`} className="flex-shrink-0">
                        <div className="relative h-20 w-20 rounded-lg overflow-hidden">
                          <Image
                            src={item.image || '/images/placeholder.svg'}
                            alt={item.name[lng as 'en' | 'he']}
                            fill
                            className="object-cover"
                          />
                        </div>
                      </Link>
                    </div>

                    <div className={`mt-4 flex items-center justify-between gap-3 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
                      <div className="flex items-center rounded-lg border border-gray-300 overflow-hidden">
                        <button
                          onClick={() => updateQuantity(item.sku, item.quantity - 1, item.size, item.color)}
                          className="flex h-10 w-10 items-center justify-center text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={item.quantity <= 1}
                          aria-label={lng === 'he' ? 'הפחת כמות' : 'Decrease quantity'}
                        >
                          <MinusIcon className="h-4 w-4" />
                        </button>
                        <span className="px-4 text-sm font-medium text-gray-800 min-w-[3rem] text-center">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.sku, item.quantity + 1, item.size, item.color)}
                          className="flex h-10 w-10 items-center justify-center text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={item.quantity >= item.maxStock}
                          aria-label={lng === 'he' ? 'הגדל כמות' : 'Increase quantity'}
                        >
                          <PlusIcon className="h-4 w-4" />
                        </button>
                      </div>

                      <button
                        onClick={() => removeFromCart(item.sku, item.size, item.color)}
                        className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                        title={t.remove}
                        aria-label={t.remove}
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow-sm p-6 sticky top-8">
                <h2 className="text-lg font-medium text-gray-900 mb-4">
                  {t.subtotal}
                </h2>

                <Accordion title={couponStrings.label}>
                  <div className="pb-4" dir={isRTL ? 'rtl' : 'ltr'}>
                    <div className={`flex ${isRTL ? 'flex-row-reverse space-x-reverse' : 'flex-row'} items-center gap-2`}>
                      <input
                        type="text"
                        value={couponInput}
                        onChange={(event) => setCouponInput(event.target.value)}
                        placeholder={couponStrings.placeholder}
                        className={`flex-1 rounded-md border text-gray-900 py-2 px-2 shadow-sm focus:outline-none focus:ring-0.5 focus:ring-[#856D55]/90 ${isRTL ? 'text-right' : 'text-left'}`}
                        disabled={couponLoading}
                        style={{ 
                          borderColor: 'rgba(133, 109, 85, 0.2)',
                          borderRadius: '2px'
                        }}
                        onFocus={(e) => {
                          e.target.style.borderColor = 'rgba(133, 109, 85, 0.7)'
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = 'rgba(133, 109, 85, 0.2)'
                        }}
                      />
                      <button
                        onClick={() => applyCouponCode(couponInput)}
                        disabled={couponLoading || !couponInput.trim()}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-[#856D55]/90 hover:bg-[#856D55] disabled:opacity-70"
                      >
                        {couponLoading ? couponStrings.loading : couponStrings.apply}
                      </button>
                    </div>
                    {couponStatus && (
                      <p className={`mt-2 text-sm ${couponStatus.type === 'error' ? 'text-red-600' : couponStatus.type === 'success' ? 'text-green-600' : 'text-gray-600'}`}>
                        {couponStatus.message}
                      </p>
                    )}

                    {appliedCoupons.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {appliedCoupons.map(coupon => (
                          <span
                            key={coupon.coupon.code}
                            className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700"
                          >
                            {coupon.coupon.code}
                            <button
                              onClick={() => removeCoupon(coupon.coupon.code)}
                              className={`${isRTL ? 'mr-2' : 'ml-2'} text-indigo-500 hover:text-indigo-700`}
                              aria-label={couponStrings.remove}
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </Accordion>

                <hr className="my-6 border-gray-200" />
                
                <div className="mt-6 space-y-3">
                  {items.map((item, index) => (
                    <div key={`${item.sku}-${item.size}-${item.color}-${index}`} className="flex justify-between text-sm">
                      <div className="text-gray-600">
                        <div className="font-medium">{item.name[lng as 'en' | 'he']}</div>
                        <div className="text-xs text-gray-500">
                          {item.size && (
                            <span>{lng === 'he' ? 'מידה' : 'Size'}: {item.size}</span>
                          )}
                          {item.size && item.color && <span> • </span>}
                          {item.color && (
                            <span>{lng === 'he' ? 'צבע' : 'Color'}: {getColorName(item.color, lng as 'en' | 'he')}</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500">
                          {lng === 'he' ? 'כמות' : 'Qty'}: {item.quantity}
                        </div>
                      </div>
                      <span className="font-medium text-gray-700">
                      ₪{((item.salePrice || item.price) * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-gray-200 pt-4 mt-4 space-y-2">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>{t.subtotal}</span>
                    <span>₪{subtotal.toFixed(2)}</span>
                  </div>

                  {totalDiscount > 0 && (
                    <>
                      {appliedCoupons.map(coupon => (
                        <div key={coupon.coupon.code} className="flex justify-between text-xs text-green-600">
                          <span>{coupon.coupon.code} • {coupon.coupon.discountLabel[lng as 'en' | 'he']}</span>
                          <span>-₪{coupon.discountAmount.toFixed(2)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>{lng === 'he' ? 'סכום לאחר הנחות' : 'Subtotal after discounts'}</span>
                        <span>₪{discountedSubtotal.toFixed(2)}</span>
                      </div>
                    </>
                  )}

                  {deliveryFee > 0 ? (
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>{t.delivery}</span>
                      <span>₪{deliveryFee.toFixed(2)}</span>
                    </div>
                  ) : (
                    <div className="text-sm text-green-600 font-medium">
                      {t.freeDelivery}
                    </div>
                  )}

                  <div className="flex justify-between text-lg font-bold text-gray-700 border-t border-gray-200 pt-2">
                    <span>{t.total}</span>
                    <span>₪{finalTotal.toFixed(2)}</span>
                  </div>
                </div>

                <button
                  onClick={() => setIsCheckoutModalOpen(true)}
                  className="w-full mt-6 bg-[#856D55]/90 text-white py-3 px-6 rounded-lg hover:bg-[#856D55] transition-colors font-medium"
                >
                  {t.checkout}
                </button>

                <Link
                  href={`/${lng}`}
                  className="block w-full mt-3 py-3 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 text-center"
                >
                  {t.emptyButton}
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Checkout Modal */}
      <CheckoutModal
        isOpen={isCheckoutModalOpen}
        onClose={() => setIsCheckoutModalOpen(false)}
        orderId={`ORDER-${Date.now()}`}
        amount={finalTotal}
        subtotal={subtotal}
        discountTotal={totalDiscount}
        deliveryFee={deliveryFee}
        currency={cartCurrency}
        productName={getProductName()}
        productSku={items.length > 0 ? items[0].sku : 'UNKNOWN'}
        quantity={totalItems}
        language={lng as 'he' | 'en'}
        items={items}
        appliedCoupons={appliedCoupons.map(coupon => ({
          code: coupon.coupon.code,
          discountAmount: coupon.discountAmount,
          discountType: coupon.coupon.discountType,
          stackable: coupon.coupon.stackable,
          description: coupon.coupon.description?.[lng as 'en' | 'he'] ?? undefined,
          discountLabel: coupon.coupon.discountLabel
        }))}
      />
    </div>
  )
}

export default function CartPage() {
  return (
    <Suspense fallback={<CartPageFallback />}>
      <CartPageContent />
    </Suspense>
  )
}
