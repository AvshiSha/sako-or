'use client'

/**
 * Cart, Figma 46:16455 (SAKO OR — V2 WEBSITE DESIGN).
 *
 * Two columns divided by a single black hairline: the line items run down the
 * inline-start side under a 60px Ploni Black heading, the order summary sits on
 * the inline-end side on gray-400 (#e7e3d7). The frame is drawn once, at 1728px
 * and in Hebrew; every side is expressed logically here so the English
 * storefront mirrors rather than hardcoding RTL, and the two columns stack below
 * lg where the 502px aside has no room.
 *
 * All of the cart's behaviour - coupon validation and revalidation, auto-apply,
 * the automatic BOGO deal, points redemption, stock revalidation before
 * checkout, pickup vs delivery - is carried over unchanged from the previous
 * page. Only the surface is new.
 *
 * Design gaps, resolved and noted rather than dropped:
 * - The frame has no delivery-method control, but the storefront charges a
 *   different fee for self-pickup, so the radio pair is kept and restyled onto
 *   the system instead of being deleted with the old layout.
 * - The frame shows no empty, loading, out-of-stock or coupon-error state.
 *   Those are built from the same tokens as the states it does draw.
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import QuantityStepper from '@/app/components/QuantityStepper'
import { useCart } from '@/app/hooks/useCart'
import CheckoutModal from '@/app/components/CheckoutModal'
import PointsUsage from '@/app/components/PointsUsage'
import ProductCarousel from '@/app/components/ProductCarousel'
import { trackViewCart } from '@/lib/dataLayer'
import { CouponValidationSuccess } from '@/lib/coupons'
import { useAuth } from '@/app/contexts/AuthContext'
import { getColorName } from '@/lib/colors'
import { FREE_DELIVERY_THRESHOLD_ILS, DELIVERY_FEE_ILS } from '@/lib/pricing'
import type { Product } from '@/lib/product-types'

const couponContent = {
  en: {
    label: 'I have a coupon code',
    placeholder: 'Coupon code',
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
    label: 'יש לי קוד קופון',
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

/** Shared with PointsUsage — one field shape for both boxes in the summary. */
const FIELD_CLASS =
  'min-w-0 flex-1 border border-sako-black bg-surface-primary px-[10px] py-[17px] text-center font-ploni text-[16px] uppercase text-sako-black outline-none placeholder:text-sako-gray-500 placeholder:normal-case focus:border-sako-ink-900 disabled:bg-sako-gray-300'

const APPLY_CLASS =
  'shrink-0 border border-btn-primary-bg bg-btn-primary-bg px-[18px] py-[14px] font-ploni text-[16px] font-bold leading-none text-btn-primary-text transition-colors hover:bg-sako-ink-800 disabled:border-sako-gray-500 disabled:bg-sako-gray-500'

/** Summary rules (46:16802 / 46:16812 / 46:16816) — a hairline on the panel ground. */
const RULE_CLASS = 'h-px w-full shrink-0 bg-sako-ink-900/20'

/** Typography/Button/Label on Base/Black, used by every summary row. */
const SUMMARY_ROW_CLASS =
  'flex w-full items-start gap-[10px] font-ploni text-[16px] font-bold text-sako-ink-800'

/** Typography/Caption — 9px Ploni with the frame's 0.72px tracking. */
const CAPTION_CLASS = 'font-ploni text-[9px] tracking-[0.72px]'

export interface CartClientProps {
  /** Feeds the "YOU MAY ALSO LIKE" rail below the cart (293:14026). */
  recommendations?: Product[]
}

export default function CartClient({ recommendations = [] }: CartClientProps) {
  const params = useParams()
  const lng = (params?.lng as string) || 'en'
  const isRTL = lng === 'he'
  const couponStrings = couponContent[lng as keyof typeof couponContent]

  const {
    items,
    removeFromCart,
    updateQuantity,
    getTotalPrice,
    getTotalItems,
    getDeliveryFee,
    loading,
    revalidateCart
  } = useCart()

  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false)
  const [isRevalidatingForCheckout, setIsRevalidatingForCheckout] = useState(false)

  const [isClient, setIsClient] = useState(false)
  const STORE_PICKUP_LOCATION = 'Rothschild 51, Rishon Lezion'
  const SHIPPING_METHOD_STORAGE_KEY = 'cart_shipping_method'
  const [shippingMethod, setShippingMethod] = useState<'delivery' | 'pickup'>('delivery')
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

  // Points state
  const [pointsBalance, setPointsBalance] = useState(0)
  const [pointsToUse, setPointsToUse] = useState(0)
  const [pointsLoading, setPointsLoading] = useState(false)
  // Automatic BOGO deal state
  const [bogoDiscountAmount, setBogoDiscountAmount] = useState(0)
  const [bogoHasLeftover, setBogoHasLeftover] = useState(false)
  const appliedCodes = useMemo(() => appliedCoupons.map(coupon => coupon.coupon.code), [appliedCoupons])
  const userIdentifier = user?.email ? user.email.toLowerCase() : undefined
  const cartCurrency = 'ILS'

  const purchasableItems = useMemo(
    () =>
      items.filter(item => {
        const status = item.stockStatus
        const isOutOfStock =
          status === 'out_of_stock' ||
          item.isOutOfStock ||
          item.maxStock <= 0 ||
          item.quantity <= 0

        // Treat both 'checking' and 'in_stock' as purchasable so totals
        // don't flicker to zero while stock is being validated.
        return !isOutOfStock
      }),
    [items]
  )

  const cartItemsPayload = useMemo(() => {
    return purchasableItems.map(item => ({
      sku: item.sku,
      quantity: item.quantity,
      price: item.price,
      salePrice: item.salePrice,
      color: item.color,
      size: item.size
    }))
  }, [purchasableItems])

  const cartItemsSignature = useMemo(() => JSON.stringify(cartItemsPayload), [cartItemsPayload])

  // Load shipping method preference from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const stored = localStorage.getItem(SHIPPING_METHOD_STORAGE_KEY)
      if (stored === 'delivery' || stored === 'pickup') {
        setShippingMethod(stored)
      }
    } catch (e) {
      console.warn('Failed to load shipping method from storage:', e)
    }
  }, [])

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
    // Guardrail: do not apply coupons when automatic BOGO deal is active.
    if (bogoDiscountAmount > 0) {
      if (!options?.silent) {
        setCouponStatus({
          type: 'info',
          message:
            lng === 'he'
              ? 'לא ניתן לשלב קופונים עם מבצע הזוגות.'
              : 'Coupons can’t be combined with the automatic pairs deal.'
        })
      }
      return
    }

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
  }, [appliedCodes, bogoDiscountAmount, cartItemsPayload, couponStrings.invalid, couponStrings.perUserRequired, couponStrings.stackableNotice, couponStrings.success, lng, saveCouponsToStorage, userIdentifier])

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
  }, [cartItemsPayload, couponStrings.invalid, couponStrings.success, lng, loading, saveCouponsToStorage, userIdentifier])

  // Generate product name from purchasable cart items (what will actually be charged)
  const getProductName = () => {
    if (purchasableItems.length === 0) return 'Sako Order'

    if (purchasableItems.length === 1) {
      const item = purchasableItems[0]
      return `${item.name[lng as 'en' | 'he']}${item.color ? ` - ${item.color}` : ''}`
    }

    if (purchasableItems.length === 2) {
      const item1 = purchasableItems[0]
      const item2 = purchasableItems[1]
      return `${item1.name[lng as 'en' | 'he']}${item1.color ? ` - ${item1.color}` : ''} + ${item2.name[lng as 'en' | 'he']}${item2.color ? ` - ${item2.color}` : ''}`
    }

    // For 3+ items, show first item + count
    const firstItem = purchasableItems[0]
    const remainingCount = purchasableItems.length - 1
    return `${firstItem.name[lng as 'en' | 'he']}${firstItem.color ? ` - ${firstItem.color}` : ''} + ${remainingCount} ${isRTL ? 'עוד פריטים' : 'more items'}`
  }

  // Localized content
  const content = {
    en: {
      title: 'Shopping Cart',
      summaryTitle: 'Order Summary',
      emptyTitle: 'Your cart is empty',
      emptyDescription: "Looks like you haven't added any items to your cart yet.",
      emptyButton: 'Continue Shopping',
      remove: 'Remove',
      subtotal: 'Subtotal',
      delivery: 'Shipping',
      notCalculated: 'Not calculated',
      free: 'Free',
      total: 'Order total',
      checkout: 'Proceed to Checkout',
      vatNote: 'Prices include VAT',
      freeDeliveryProgress: (remaining: string) => `₪${remaining} away from free shipping`,
      freeDeliveryReached: 'You’ve earned free shipping',
      deliveryMethod: 'Delivery method',
      homeDelivery: 'Home delivery',
      selfPickup: 'Self pickup (free)',
      pickupNote: 'Pickup available at our store: Rothschild 51, Rishon Lezion',
      afterDiscounts: 'Subtotal after discounts',
      pointsDiscount: 'Points discount',
      bogo: 'BOGO deal',
      recommendationsTitle: 'You may also like',
      recommendationsEyebrow: 'YOU MAY ALSO LIKE',
      outOfStockLabel: 'OUT OF STOCK',
      checking: 'Checking availability…',
      stockDisclaimer: 'Items in your cart are not reserved until you complete your order.',
      cartInvalidMessage: 'One or more products in your cart are no longer available. Please update your cart before continuing.'
    },
    he: {
      title: 'סל קניות',
      summaryTitle: 'סיכום הזמנה',
      emptyTitle: 'הסל שלך ריק',
      emptyDescription: 'נראה שעדיין לא הוספת פריטים לסל.',
      emptyButton: 'המשך לקנות',
      remove: 'הסרה',
      subtotal: 'סך ביניים',
      delivery: 'משלוח',
      notCalculated: 'לא חושב',
      free: 'חינם',
      total: 'סך כל ההזמנה',
      checkout: 'המשך לתשלום',
      vatNote: 'המחירים כוללים מע״מ',
      freeDeliveryProgress: (remaining: string) => `נותרו לך ₪${remaining} לקבלת משלוח חינם`,
      freeDeliveryReached: 'קיבלת משלוח חינם',
      deliveryMethod: 'אופן קבלת ההזמנה',
      homeDelivery: 'משלוח עד הבית',
      selfPickup: 'איסוף עצמי (חינם)',
      pickupNote: 'האיסוף מתבצע מהחנות ברחוב רוטשילד 51, ראשון לציון',
      afterDiscounts: 'סכום לאחר הנחות',
      pointsDiscount: 'הנחת נקודות',
      bogo: 'מבצע זוגות',
      recommendationsTitle: 'אולי תאהבו גם',
      recommendationsEyebrow: 'YOU MAY ALSO LIKE',
      outOfStockLabel: 'אזל מהמלאי',
      checking: 'בודקים זמינות…',
      stockDisclaimer: 'המוצרים בסל אינם שמורים עבורך עד להשלמת ההזמנה',
      cartInvalidMessage: 'אחד או יותר מהמוצרים בסל אינם זמינים יותר. נא לעדכן את הסל לפני שממשיכים.'
    }
  }

  const t = content[lng as keyof typeof content]

  useEffect(() => {
    setIsClient(true)
  }, [])

  // Persist shipping method selection
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(SHIPPING_METHOD_STORAGE_KEY, shippingMethod)
    } catch (e) {
      console.warn('Failed to persist shipping method:', e)
    }
  }, [shippingMethod])

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
  }, [applyCouponCode, appliedCoupons.length, autoApplyAttempted, cartItemsPayload, couponStrings.autoApplied, lng, loading, userIdentifier])

  // Fetch points balance when user is signed in
  useEffect(() => {
    if (!user || !isClient) {
      setPointsBalance(0)
      setPointsToUse(0)
      return
    }

    let cancelled = false
    ;(async () => {
      setPointsLoading(true)
      try {
        const token = await user.getIdToken()
        const res = await fetch('/api/me/points?limit=1', {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` }
        })

        const json = await res.json().catch(() => ({}))
        if (!res.ok || !json || json.error) {
          throw new Error(json?.error || 'Failed to load points')
        }

        if (!cancelled) {
          setPointsBalance(json.pointsBalance || 0)
        }
      } catch (e: any) {
        console.error('Error loading points:', e)
        if (!cancelled) {
          setPointsBalance(0)
        }
      } finally {
        if (!cancelled) {
          setPointsLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [user, isClient])

  useEffect(() => {
    if (!isClient || loading || purchasableItems.length === 0) return

    try {
      const cartItems = purchasableItems.map(item => ({
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
  }, [isClient, loading, lng, purchasableItems])

  // Automatic BOGO deal calculation – recompute whenever cart items change
  useEffect(() => {
    if (!isClient || loading || purchasableItems.length === 0) {
      setBogoDiscountAmount(0)
      setBogoHasLeftover(false)
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        const response = await fetch('/api/cart/bogo', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ items: cartItemsPayload })
        })

        const json = await response.json().catch(() => ({}))
        if (cancelled) return

        if (!response.ok || !json || json.success === false) {
          setBogoDiscountAmount(0)
          setBogoHasLeftover(false)
          return
        }

        const amount =
          typeof json.bogoDiscountAmount === 'number' ? json.bogoDiscountAmount : 0

        setBogoDiscountAmount(amount > 0 ? amount : 0)
        setBogoHasLeftover(!!json.hasLeftover)
      } catch (error) {
        if (!cancelled) {
          console.warn('Failed to calculate automatic BOGO deal:', error)
          setBogoDiscountAmount(0)
          setBogoHasLeftover(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [isClient, loading, cartItemsSignature, cartItemsPayload, purchasableItems.length])

  // Points cap: compute before the early return so the clamp effect below keeps a
  // consistent hook order.
  const totalItems = getTotalItems()
  const subtotal = getTotalPrice()
  const baseDeliveryFee = getDeliveryFee()
  const couponsDiscountTotal = appliedCoupons.reduce(
    (sum, coupon) => sum + coupon.discountAmount,
    0
  )
  const isBogoActive = bogoDiscountAmount > 0
  const totalDiscount = isBogoActive ? bogoDiscountAmount : couponsDiscountTotal
  const cartAmountBeforePoints = Math.max(subtotal - totalDiscount, 0)
  const maxPointsBy15Percent = Math.round(0.15 * cartAmountBeforePoints * 100) / 100
  const usablePoints = Math.min(pointsBalance, maxPointsBy15Percent)
  const isCappedBy15Percent = pointsBalance > maxPointsBy15Percent

  // Clamp pointsToUse when the cap drops (e.g. cart or coupons change). Depends only
  // on primitive inputs so the effect doesn't re-run when we call setPointsToUse.
  useEffect(() => {
    const amountBeforePoints = Math.max(subtotal - totalDiscount, 0)
    const cap = Math.round(0.15 * amountBeforePoints * 100) / 100
    const usable = Math.min(pointsBalance, cap)
    setPointsToUse((prev) => (prev > usable ? usable : prev))
  }, [subtotal, totalDiscount, pointsBalance])

  const pointsDiscount = pointsToUse // 1 point = 1 ILS
  const discountedSubtotal = Math.max(subtotal - totalDiscount - pointsDiscount, 0)
  const hasPromotions = totalDiscount > 0 || pointsDiscount > 0

  const deliveryFee =
    shippingMethod === 'pickup'
      ? 0
      : subtotal >= FREE_DELIVERY_THRESHOLD_ILS
        ? discountedSubtotal >= FREE_DELIVERY_THRESHOLD_ILS
          ? 0
          : hasPromotions
            ? DELIVERY_FEE_ILS
            : 0
        : baseDeliveryFee

  const finalTotal = Math.max(discountedSubtotal + deliveryFee, 0)
  const remainingForFreeDelivery = Math.max(FREE_DELIVERY_THRESHOLD_ILS - subtotal, 0)

  const formatMoney = (value: number) =>
    `₪${value.toLocaleString(isRTL ? 'he-IL' : 'en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`

  const handleCheckout = async () => {
    setIsRevalidatingForCheckout(true)
    let freshItems: typeof items | null = null
    try {
      freshItems = await revalidateCart()
    } finally {
      setIsRevalidatingForCheckout(false)
    }

    const purchasableAfterRevalidate = (freshItems ?? items).filter(item => {
      const isOutOfStock =
        item.stockStatus === 'out_of_stock' ||
        item.isOutOfStock ||
        item.maxStock <= 0 ||
        item.quantity <= 0
      return !isOutOfStock
    })

    if (purchasableAfterRevalidate.length > 0) {
      setIsCheckoutModalOpen(true)
    }
  }

  if (!isClient || loading) {
    return <CartSkeleton title={t.title} />
  }

  const isEmpty = items.length === 0

  return (
    <div className="min-h-screen bg-surface-secondary" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* 46:16469 — the frame's two columns. minmax(0,1fr) keeps the line-item
          column from being widened past the track by a long product name, and the
          aside keeps the frame's 502px. Below lg they stack: the summary follows
          the items, which is the order a one-column checkout reads in. */}
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_502px] lg:items-start">
        {/* ── Line items ─────────────────────────────────────────────── */}
        <section className="lg:border-e lg:border-sako-black">
          <div className="px-[16px] pt-[24px] pb-[24px] lg:px-[30px] lg:pt-[30px] lg:pb-[30px]">
            <h1 className="font-ploni text-[40px] font-black leading-[40px] text-start text-text-primary lg:text-[60px] lg:leading-[50px]">
              {t.title}
            </h1>
            {!isEmpty && (
              <p className={`${CAPTION_CLASS} mt-[12px] text-start text-sako-gray-800`}>
                {t.stockDisclaimer}
              </p>
            )}
          </div>

          {isEmpty ? (
            <div className="border-t border-sako-black px-[16px] py-[60px] text-start lg:px-[30px]">
              <h2 className="font-ploni text-[20px] font-black text-text-primary">{t.emptyTitle}</h2>
              <p className="mt-[10px] font-ploni text-[13px] leading-[16px] text-sako-gray-800">
                {t.emptyDescription}
              </p>
              <Link
                href={`/${lng}`}
                className="mt-[24px] inline-flex border border-btn-primary-bg bg-btn-primary-bg px-[32px] py-[14px] font-ploni text-[16px] font-bold leading-none text-btn-primary-text transition-colors hover:bg-sako-ink-800"
              >
                {t.emptyButton}
              </Link>
            </div>
          ) : (
            <ul className="border-t border-sako-black">
              {items.map((item, index) => {
                const stockStatus = item.stockStatus
                const isChecking = stockStatus === 'checking'
                const derivedOutOfStock =
                  stockStatus === 'out_of_stock' ||
                  item.isOutOfStock ||
                  item.maxStock <= 0 ||
                  item.quantity <= 0
                const isOutOfStock = !isChecking && derivedOutOfStock
                const productHref = `/${lng}/product/${item.sku}${item.color ? `/${item.color}` : ''}`
                const productName = item.name[lng as 'en' | 'he']
                // "שחור / 38" — the frame joins colour and size with a slash on one line.
                const variantLine = [
                  item.color ? getColorName(item.color, lng as 'en' | 'he') : null,
                  item.size
                ]
                  .filter(Boolean)
                  .join(' / ')

                return (
                  <li
                    key={`${item.sku}-${item.size}-${item.color}-${index}`}
                    className={`flex min-h-[150px] border-b border-sako-black lg:min-h-[178px] ${
                      isOutOfStock ? 'opacity-60' : ''
                    }`}
                  >
                    {/* 46:16524 — the image column. self-stretch so the photo fills the
                        row however tall the details make it, object-contain because the
                        catalogue shots are cut out on a light ground. */}
                    <Link
                      href={productHref}
                      className="relative w-[120px] shrink-0 self-stretch lg:w-[185px]"
                      aria-label={productName}
                    >
                      <Image
                        src={item.image || '/images/placeholder.svg'}
                        alt={productName}
                        fill
                        sizes="(min-width: 1024px) 185px, 120px"
                        className="object-contain"
                      />
                    </Link>

                    <div className="flex min-w-0 flex-1 flex-col px-[14px] pt-[17px] pb-[18px] text-start">
                      <Link href={productHref} className="min-w-0">
                        <h2 className="truncate font-ploni text-[16px] font-black uppercase text-text-primary transition-opacity hover:opacity-70 lg:text-[20px]">
                          {productName}
                        </h2>
                      </Link>

                      {variantLine && (
                        <p className="mt-[2px] truncate font-ploni text-[12px] text-sako-gray-800">
                          {variantLine}
                        </p>
                      )}

                      {/* tabular-nums: Ploni's default figures are proportional, so a
                          column of prices would not align without it. */}
                      <p className="pt-[10px] font-ploni text-[13px] leading-[16px] tabular-nums text-text-primary">
                        {item.salePrice && item.salePrice < item.price ? (
                          <>
                            <span className="text-sako-gray-800 line-through">
                              {formatMoney(item.price)}
                            </span>{' '}
                            <span className="text-accent-error">{formatMoney(item.salePrice)}</span>
                          </>
                        ) : (
                          formatMoney(item.salePrice || item.price)
                        )}
                      </p>

                      {isChecking && (
                        <p className={`${CAPTION_CLASS} mt-[6px] text-sako-gray-800`}>{t.checking}</p>
                      )}

                      {isOutOfStock && (
                        <p
                          className={`${CAPTION_CLASS} mt-[6px] inline-flex self-start bg-accent-error px-[8px] py-[4px] text-text-inverse`}
                        >
                          {t.outOfStockLabel}
                        </p>
                      )}

                      {/* 46:16513 — the stepper sits under the price on the inline start,
                          the remove link at the far end of the row. mt-auto pins the pair
                          to the bottom of the cell, which is what the frame's 60px
                          bottom-aligned container does. */}
                      <div className="mt-auto flex items-end justify-between gap-[12px] pt-[16px]">
                        <QuantityStepper
                          value={item.quantity}
                          max={item.maxStock}
                          onChange={(next) => updateQuantity(item.sku, next, item.size, item.color)}
                          language={isRTL ? 'he' : 'en'}
                          disabled={isOutOfStock || isChecking}
                        />

                        <button
                          type="button"
                          onClick={() => removeFromCart(item.sku, item.size, item.color)}
                          className={`${CAPTION_CLASS} text-text-primary underline transition-opacity hover:opacity-60`}
                        >
                          {t.remove}
                        </button>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {/* ── Order summary (46:16708) ────────────────────────────────── */}
        <aside className="bg-sako-gray-400 lg:sticky lg:top-0">
          {/* 46:16790 — a solid brown band across the top of the panel. It reports
              progress in copy rather than as a fill; the frame draws no track. */}
          {shippingMethod === 'delivery' && (
            <div className="border-b border-sako-ink-900">
              <div className="flex min-h-[48px] items-center justify-center bg-sako-brown-500 px-[16px] py-[10px]">
                <p className="text-center font-ploni text-[14px] font-semibold leading-[1.22] text-text-inverse">
                  {remainingForFreeDelivery > 0
                    ? t.freeDeliveryProgress(
                        remainingForFreeDelivery.toLocaleString(isRTL ? 'he-IL' : 'en-US', {
                          maximumFractionDigits: 0
                        })
                      )
                    : t.freeDeliveryReached}
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-[20px] px-[16px] pt-[30px] pb-[30px] lg:px-[30px]">
            <h2 className="font-ploni text-[40px] font-black leading-[40px] text-start text-text-primary lg:text-[60px] lg:leading-[50px]">
              {t.summaryTitle}
            </h2>

            {/* Coupon (46:16793) */}
            <div className="flex flex-col gap-[10px]">
              <label
                htmlFor="cart-coupon"
                className="font-ploni text-[16px] font-bold leading-none text-start text-sako-ink-800"
              >
                {couponStrings.label}
              </label>

              {isBogoActive && (
                <p className="font-ploni text-[12px] text-start text-sako-gray-800">
                  {isRTL
                    ? 'קופונים לא ניתנים לשילוב עם מבצע הזוגות.'
                    : 'Coupons can’t be combined with the automatic pairs deal.'}
                </p>
              )}

              <div className="flex items-stretch">
                <input
                  id="cart-coupon"
                  type="text"
                  value={couponInput}
                  onChange={(event) => setCouponInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      applyCouponCode(couponInput)
                    }
                  }}
                  placeholder={couponStrings.placeholder}
                  disabled={couponLoading || isBogoActive}
                  className={FIELD_CLASS}
                />
                <button
                  type="button"
                  onClick={() => applyCouponCode(couponInput)}
                  disabled={couponLoading || !couponInput.trim() || isBogoActive}
                  className={APPLY_CLASS}
                >
                  {couponLoading ? couponStrings.loading : couponStrings.apply}
                </button>
              </div>

              {couponStatus && (
                <p
                  className={`font-ploni text-[12px] text-start ${
                    couponStatus.type === 'error' ? 'text-accent-error' : 'text-sako-ink-800'
                  }`}
                  role={couponStatus.type === 'error' ? 'alert' : undefined}
                >
                  {couponStatus.message}
                </p>
              )}

              {appliedCoupons.length > 0 && (
                <ul className="flex flex-wrap gap-[8px]">
                  {appliedCoupons.map(coupon => (
                    <li
                      key={coupon.coupon.code}
                      className="inline-flex items-center gap-[8px] border border-sako-ink-900 px-[10px] py-[5px] font-ploni text-[12px] text-sako-ink-900"
                    >
                      {coupon.coupon.code}
                      <button
                        type="button"
                        onClick={() => removeCoupon(coupon.coupon.code)}
                        aria-label={`${couponStrings.remove} ${coupon.coupon.code}`}
                        className="text-[14px] leading-none transition-opacity hover:opacity-60"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Points (258:12402) — signed-in only; the frame draws the block without
                an account state, and there is nothing to redeem without one. */}
            {user && (
              <>
                <div className={RULE_CLASS} />
                <PointsUsage
                  pointsBalance={pointsBalance}
                  maxUsablePoints={usablePoints}
                  isCappedBy15Percent={isCappedBy15Percent}
                  maxPointsBy15Percent={maxPointsBy15Percent}
                  onPointsChange={setPointsToUse}
                  language={isRTL ? 'he' : 'en'}
                  disabled={pointsLoading}
                />
              </>
            )}

            <div className={RULE_CLASS} />

            {/* Delivery method — not in the frame, but the fee depends on it. Built
                from the same type and rules as the rows it sits above. */}
            <fieldset className="flex flex-col gap-[10px]">
              <legend className="mb-[10px] font-ploni text-[16px] font-bold leading-none text-start text-sako-ink-800">
                {t.deliveryMethod}
              </legend>
              {(['delivery', 'pickup'] as const).map(method => (
                <label
                  key={method}
                  className="flex cursor-pointer items-start gap-[10px] text-start font-ploni text-[13px] leading-[16px] text-sako-ink-800"
                >
                  <input
                    type="radio"
                    name="shippingMethod"
                    value={method}
                    checked={shippingMethod === method}
                    onChange={() => setShippingMethod(method)}
                    className="mt-[1px] size-[14px] shrink-0 accent-sako-ink-900"
                  />
                  <span>
                    {method === 'delivery' ? t.homeDelivery : t.selfPickup}
                    {method === 'pickup' && (
                      <span className={`${CAPTION_CLASS} mt-[4px] block text-sako-gray-800`}>
                        {t.pickupNote}
                      </span>
                    )}
                  </span>
                </label>
              ))}
            </fieldset>

            <div className={RULE_CLASS} />

            {/* Totals (46:16803 …) — label on the inline start, figure on the end. */}
            <div className={SUMMARY_ROW_CLASS}>
              <span className="min-w-0 flex-1 text-start">{t.subtotal}</span>
              <span className="shrink-0 tabular-nums">{formatMoney(subtotal)}</span>
            </div>

            <div className={SUMMARY_ROW_CLASS}>
              <span className="min-w-0 flex-1 text-start">{t.delivery}</span>
              <span className="shrink-0 tabular-nums">
                {shippingMethod === 'pickup'
                  ? t.free
                  : deliveryFee > 0
                    ? formatMoney(deliveryFee)
                    : subtotal > 0
                      ? t.free
                      : t.notCalculated}
              </span>
            </div>

            {isBogoActive && (
              <div className={SUMMARY_ROW_CLASS}>
                <span className="min-w-0 flex-1 text-start">{t.bogo}</span>
                <span className="shrink-0 tabular-nums">-{formatMoney(bogoDiscountAmount)}</span>
              </div>
            )}

            {!isBogoActive &&
              appliedCoupons.map(coupon => (
                <div key={coupon.coupon.code} className={SUMMARY_ROW_CLASS}>
                  <span className="min-w-0 flex-1 text-start">
                    {couponStrings.discount}{' '}
                    <span className="text-sako-gray-600">({coupon.coupon.code})</span>
                  </span>
                  <span className="shrink-0 tabular-nums">-{formatMoney(coupon.discountAmount)}</span>
                </div>
              ))}

            {pointsDiscount > 0 && (
              <div className={SUMMARY_ROW_CLASS}>
                <span className="min-w-0 flex-1 text-start">{t.pointsDiscount}</span>
                <span className="shrink-0 tabular-nums">-{formatMoney(pointsDiscount)}</span>
              </div>
            )}

            {isBogoActive && bogoHasLeftover && (
              <p className="font-ploni text-[12px] text-start text-sako-gray-800">
                {isRTL
                  ? 'המבצע חל על זוגות בלבד. הוסיפי עוד פריט זכאי כדי להפעיל זוג נוסף.'
                  : 'Deal applies to pairs only. Add 1 more eligible item to activate another pair.'}
              </p>
            )}

            <div className={RULE_CLASS} />

            <div className={SUMMARY_ROW_CLASS}>
              <span className="min-w-0 flex-1 text-start">{t.total}</span>
              <span className="shrink-0 tabular-nums">{formatMoney(finalTotal)}</span>
            </div>

            <div className={RULE_CLASS} />

            {(purchasableItems.length === 0 || subtotal <= 0) && !isEmpty && (
              <p className="font-ploni text-[12px] text-start text-accent-error" role="alert">
                {t.cartInvalidMessage}
              </p>
            )}

            {/* 46:16817 — a 58px ink bar, label on the inline start and the frame's
                arrow glyph pushed to the far end. */}
            <button
              type="button"
              onClick={handleCheckout}
              disabled={purchasableItems.length === 0 || subtotal <= 0 || isRevalidatingForCheckout}
              className="flex h-[58px] w-full items-center justify-between border border-btn-primary-bg bg-btn-primary-bg px-[19px] transition-colors hover:bg-sako-ink-800 disabled:border-sako-gray-500 disabled:bg-sako-gray-500"
            >
              <span className="font-ploni text-[13px] font-bold text-text-inverse">
                {t.checkout}
              </span>
              <span
                aria-hidden="true"
                className="flex size-[22px] rotate-90 items-center justify-center font-ploni text-[20px] font-black leading-none text-text-inverse"
              >
                ↙
              </span>
            </button>

            <p className={`${CAPTION_CLASS} text-start text-sako-gray-800`}>{t.vatNote}</p>
          </div>
        </aside>
      </div>

      {/* 293:14026 — "YOU MAY ALSO LIKE". Same header band and dark card track as
          the rail on the home and product pages, so it comes from that component. */}
      {recommendations.length > 0 && (
        <ProductCarousel
          products={recommendations}
          title={t.recommendationsTitle}
          eyebrow={t.recommendationsEyebrow}
          language={isRTL ? 'he' : 'en'}
        />
      )}

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
        productSku={purchasableItems.length > 0 ? purchasableItems[0].sku : undefined}
        quantity={totalItems}
        language={isRTL ? 'he' : 'en'}
        items={purchasableItems}
        onCartInvalid={async () => {
          setIsCheckoutModalOpen(false)
          await revalidateCart()
        }}
        appliedCoupons={
          isBogoActive
            ? []
            : appliedCoupons.map(coupon => ({
                code: coupon.coupon.code,
                discountAmount: coupon.discountAmount,
                discountType: coupon.coupon.discountType,
                stackable: coupon.coupon.stackable,
                description: coupon.coupon.description?.[lng as 'en' | 'he'] ?? undefined,
                discountLabel: coupon.coupon.discountLabel
              }))
        }
        pointsToSpend={pointsToUse > 0 ? pointsToUse : undefined}
        shippingMethod={shippingMethod}
        pickupLocation={STORE_PICKUP_LOCATION}
        bogoDiscountAmount={isBogoActive ? bogoDiscountAmount : undefined}
      />
    </div>
  )
}

/**
 * Shown while the cart hydrates from storage and revalidates stock. It reserves
 * the frame's two columns so the heading does not jump sideways once the real
 * cart paints.
 */
export function CartSkeleton({ title }: { title?: string }) {
  return (
    <div className="min-h-screen bg-surface-secondary">
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_502px] lg:items-start">
        <section className="lg:border-e lg:border-sako-black">
          <div className="px-[16px] pt-[24px] pb-[24px] lg:px-[30px] lg:pt-[30px] lg:pb-[30px]">
            {title ? (
              <h1 className="font-ploni text-[40px] font-black leading-[40px] text-start text-text-primary lg:text-[60px] lg:leading-[50px]">
                {title}
              </h1>
            ) : (
              <div className="h-[50px] w-[240px] animate-pulse bg-sako-gray-300" />
            )}
          </div>
          <div className="border-t border-sako-black">
            {[0, 1].map(row => (
              <div
                key={row}
                className="flex min-h-[150px] animate-pulse border-b border-sako-black lg:min-h-[178px]"
              >
                <div className="w-[120px] shrink-0 self-stretch bg-sako-gray-300 lg:w-[185px]" />
                <div className="flex flex-1 flex-col gap-[10px] px-[14px] pt-[17px]">
                  <div className="h-[20px] w-[200px] bg-sako-gray-300" />
                  <div className="h-[12px] w-[90px] bg-sako-gray-300" />
                  <div className="h-[16px] w-[70px] bg-sako-gray-300" />
                </div>
              </div>
            ))}
          </div>
        </section>
        <aside className="min-h-[400px] animate-pulse bg-sako-gray-400" />
      </div>
    </div>
  )
}
