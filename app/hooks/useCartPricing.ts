'use client'

/**
 * Coupons, loyalty points, the automatic BOGO deal and every figure the order
 * summary prints — lifted out of the cart page so checkout can show the same
 * panel without a second copy of the arithmetic.
 *
 * The cart (438:3991) and both checkout frames (438:2725, 438:2836) draw an
 * identical summary aside. Two implementations of "what does this order cost"
 * is exactly the bug you do not want between a cart and the screen that charges
 * the card, so there is one.
 *
 * Owns its own coupon and points state, including localStorage persistence and
 * revalidation whenever the cart contents change. Pass `shippingMethod` in,
 * because that is a per-screen choice; everything else is derived here.
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useSearchParams } from 'next/navigation'

import { useAuth } from '@/app/contexts/AuthContext'
import type { CartItem } from '@/app/hooks/useCart'
import { CouponValidationSuccess } from '@/lib/coupons'
import { FREE_DELIVERY_THRESHOLD_ILS, DELIVERY_FEE_ILS } from '@/lib/pricing'

const COUPON_STORAGE_KEY = 'cart_coupons'

export type CouponStatus = { type: 'success' | 'error' | 'info'; message: string } | null

const couponMessages = {
  en: {
    success: 'Coupon applied successfully.',
    removed: 'Coupon removed.',
    stackableNotice: 'This coupon stacks with existing discounts.',
    autoApplied: 'We found a coupon for you!',
    invalid: 'Invalid or expired coupon.',
    perUserRequired: 'Please sign in to use this coupon.',
    bogoConflict: 'Coupons can’t be combined with the automatic pairs deal.'
  },
  he: {
    success: 'הקופון הופעל בהצלחה.',
    removed: 'הקופון הוסר.',
    stackableNotice: 'קופון זה ניתן לשילוב עם הנחות קיימות.',
    autoApplied: 'מצאנו עבורך קופון!',
    invalid: 'קופון זה אינו תקף או שפג תוקפו.',
    perUserRequired: 'התחבר/י כדי להשתמש בקופון זה.',
    bogoConflict: 'לא ניתן לשלב קופונים עם מבצע הזוגות.'
  }
} as const

export interface UseCartPricingOptions {
  items: CartItem[]
  /** True while useCart is still hydrating; suppresses coupon calls. */
  loading: boolean
  lng: string
  shippingMethod: 'delivery' | 'pickup'
  /** Set false on screens with no coupon field, to skip the auto-apply probe. */
  enableAutoApply?: boolean
}

export function useCartPricing({
  items,
  loading,
  lng,
  shippingMethod,
  enableAutoApply = true
}: UseCartPricingOptions) {
  const { user } = useAuth()
  const searchParams = useSearchParams()
  const strings = couponMessages[lng === 'he' ? 'he' : 'en']
  const cartCurrency = 'ILS'

  const [couponLoading, setCouponLoading] = useState(false)
  const [couponStatus, setCouponStatus] = useState<CouponStatus>(null)
  const [appliedCoupons, setAppliedCoupons] = useState<CouponValidationSuccess[]>([])
  const [autoApplyAttempted, setAutoApplyAttempted] = useState(false)

  const [pointsBalance, setPointsBalance] = useState(0)
  const [pointsToUse, setPointsToUse] = useState(0)
  const [pointsLoading, setPointsLoading] = useState(false)

  const [bogoDiscountAmount, setBogoDiscountAmount] = useState(0)
  const [bogoHasLeftover, setBogoHasLeftover] = useState(false)

  const pendingCodesRef = useRef<string[] | null>(null)
  const initializedCouponsRef = useRef(false)
  const revalidatingRef = useRef(false)
  const lastCartSignatureRef = useRef<string | null>(null)
  const urlCouponAttemptedRef = useRef<string | null>(null)

  const appliedCodes = useMemo(
    () => appliedCoupons.map(coupon => coupon.coupon.code),
    [appliedCoupons]
  )
  const userIdentifier = user?.email ? user.email.toLowerCase() : undefined

  const purchasableItems = useMemo(
    () =>
      items.filter(item => {
        const isOutOfStock =
          item.stockStatus === 'out_of_stock' ||
          item.isOutOfStock ||
          item.maxStock <= 0 ||
          item.quantity <= 0
        // 'checking' counts as purchasable so totals don't flicker to zero while
        // stock is being validated.
        return !isOutOfStock
      }),
    [items]
  )

  const cartItemsPayload = useMemo(
    () =>
      purchasableItems.map(item => ({
        sku: item.sku,
        quantity: item.quantity,
        price: item.price,
        salePrice: item.salePrice,
        color: item.color,
        size: item.size
      })),
    [purchasableItems]
  )

  const cartItemsSignature = useMemo(() => JSON.stringify(cartItemsPayload), [cartItemsPayload])

  const saveCouponsToStorage = useCallback((codes: string[]) => {
    if (typeof window === 'undefined') return
    try {
      if (codes.length === 0) localStorage.removeItem(COUPON_STORAGE_KEY)
      else localStorage.setItem(COUPON_STORAGE_KEY, JSON.stringify(codes))
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
      return Array.isArray(parsed)
        ? parsed.filter((code): code is string => typeof code === 'string')
        : []
    } catch (storageError) {
      console.warn('Failed to load coupons from storage:', storageError)
      return []
    }
  }, [])

  const applyCouponCode = useCallback(
    async (
      rawCode: string,
      options?: {
        presetResult?: CouponValidationSuccess
        silent?: boolean
        skipStorageUpdate?: boolean
      }
    ) => {
      // Guardrail: coupons never stack with the automatic BOGO deal.
      if (bogoDiscountAmount > 0) {
        if (!options?.silent) setCouponStatus({ type: 'info', message: strings.bogoConflict })
        return
      }

      const normalizedCode = rawCode.trim().toUpperCase()
      if (!normalizedCode) return

      if (appliedCodes.includes(normalizedCode)) {
        if (!options?.silent) setCouponStatus({ type: 'info', message: strings.success })
        return
      }

      try {
        setCouponLoading(!options?.presetResult)
        if (!options?.silent) setCouponStatus(null)

        let result: CouponValidationSuccess

        if (options?.presetResult) {
          result = options.presetResult
        } else {
          const response = await fetch('/api/coupons/apply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
              setCouponStatus({
                type: 'error',
                message:
                  data?.messages?.[lng] ??
                  (data?.code === 'MISSING_USER_IDENTIFIER'
                    ? strings.perUserRequired
                    : strings.invalid)
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
          const baseMessage = result.messages[lng as 'en' | 'he'] || strings.success
          const stackableNote =
            result.coupon.stackable && appliedCodes.length > 0 ? ` ${strings.stackableNotice}` : ''
          setCouponStatus({ type: 'success', message: `${baseMessage}${stackableNote}` })
        }
      } catch (applyError) {
        console.error('[CART_APPLY_COUPON_ERROR]', applyError)
        if (!options?.silent) setCouponStatus({ type: 'error', message: strings.invalid })
      } finally {
        setCouponLoading(false)
      }
    },
    [
      appliedCodes,
      bogoDiscountAmount,
      cartItemsPayload,
      lng,
      saveCouponsToStorage,
      strings,
      userIdentifier
    ]
  )

  const removeCoupon = useCallback(
    (code: string) => {
      setAppliedCoupons(prev => prev.filter(coupon => coupon.coupon.code !== code))
      saveCouponsToStorage(appliedCodes.filter(existing => existing !== code))
      setCouponStatus({ type: 'info', message: `${strings.removed} (${code})` })
    },
    [appliedCodes, saveCouponsToStorage, strings.removed]
  )

  const revalidateCouponCodes = useCallback(
    async (codes: string[], options?: { silent?: boolean }) => {
      if (codes.length === 0) {
        setAppliedCoupons([])
        saveCouponsToStorage([])
        if (!options?.silent) setCouponStatus(null)
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
            headers: { 'Content-Type': 'application/json' },
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
            if (!options?.silent) {
              setCouponStatus({ type: 'error', message: data?.messages?.[lng] ?? strings.invalid })
            }
            break
          }
          validated.push(data as CouponValidationSuccess)
        }

        setAppliedCoupons(validated)
        saveCouponsToStorage(validated.map(coupon => coupon.coupon.code))

        if (!options?.silent && validated.length > 0) {
          setCouponStatus({ type: 'success', message: strings.success })
        }
      } catch (error) {
        console.error('[CART_REVALIDATE_COUPONS_ERROR]', error)
        if (!options?.silent) setCouponStatus({ type: 'error', message: strings.invalid })
      } finally {
        revalidatingRef.current = false
        setCouponLoading(false)
      }
    },
    [cartItemsPayload, lng, loading, saveCouponsToStorage, strings, userIdentifier]
  )

  // Seed pending codes from storage once the client is up.
  useEffect(() => {
    if (initializedCouponsRef.current) return
    const storedCodes = loadCouponsFromStorage()
    if (storedCodes.length > 0) pendingCodesRef.current = storedCodes
    initializedCouponsRef.current = true
  }, [loadCouponsFromStorage])

  useEffect(() => {
    if (!initializedCouponsRef.current || loading) return
    if (!pendingCodesRef.current || pendingCodesRef.current.length === 0) return

    const codes = [...pendingCodesRef.current]
    pendingCodesRef.current = null
    revalidateCouponCodes(codes, { silent: true })
  }, [loading, revalidateCouponCodes, cartItemsSignature])

  // Re-check applied coupons whenever the cart's contents actually change.
  useEffect(() => {
    if (!initializedCouponsRef.current || loading || revalidatingRef.current) return
    if (appliedCodes.length === 0) return
    if (pendingCodesRef.current && pendingCodesRef.current.length > 0) return
    if (lastCartSignatureRef.current === cartItemsSignature) return

    lastCartSignatureRef.current = cartItemsSignature
    revalidateCouponCodes(appliedCodes, { silent: true })
  }, [appliedCodes, cartItemsSignature, loading, revalidateCouponCodes])

  // ?coupon= on the URL.
  useEffect(() => {
    if (!searchParams || loading) return
    const couponFromUrl = searchParams.get('coupon')
    if (!couponFromUrl) return
    if (urlCouponAttemptedRef.current === couponFromUrl.toUpperCase()) return

    urlCouponAttemptedRef.current = couponFromUrl.toUpperCase()
    applyCouponCode(couponFromUrl)
  }, [applyCouponCode, loading, searchParams])

  useEffect(() => {
    if (!enableAutoApply || loading || autoApplyAttempted) return
    if (cartItemsPayload.length === 0 || appliedCoupons.length > 0) return
    if (pendingCodesRef.current && pendingCodesRef.current.length > 0) return

    const autoApply = async () => {
      try {
        const response = await fetch('/api/coupons/auto-apply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
          setCouponStatus({ type: 'success', message: strings.autoApplied })
        }
      } catch (error) {
        console.warn('Auto-apply coupon failed:', error)
      } finally {
        setAutoApplyAttempted(true)
      }
    }

    autoApply()
  }, [
    applyCouponCode,
    appliedCoupons.length,
    autoApplyAttempted,
    cartItemsPayload,
    enableAutoApply,
    lng,
    loading,
    strings.autoApplied,
    userIdentifier
  ])

  // Points balance for the signed-in user.
  useEffect(() => {
    if (!user) {
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
        if (!res.ok || !json || json.error) throw new Error(json?.error || 'Failed to load points')
        if (!cancelled) setPointsBalance(json.pointsBalance || 0)
      } catch (e) {
        console.error('Error loading points:', e)
        if (!cancelled) setPointsBalance(0)
      } finally {
        if (!cancelled) setPointsLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [user])

  // Automatic BOGO deal.
  useEffect(() => {
    if (loading || purchasableItems.length === 0) {
      setBogoDiscountAmount(0)
      setBogoHasLeftover(false)
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        const response = await fetch('/api/cart/bogo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: cartItemsPayload })
        })
        const json = await response.json().catch(() => ({}))
        if (cancelled) return

        if (!response.ok || !json || json.success === false) {
          setBogoDiscountAmount(0)
          setBogoHasLeftover(false)
          return
        }

        const amount = typeof json.bogoDiscountAmount === 'number' ? json.bogoDiscountAmount : 0
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
  }, [loading, cartItemsSignature, cartItemsPayload, purchasableItems.length])

  // ── Derived figures ──────────────────────────────────────────────────────
  const subtotal = useMemo(
    () =>
      purchasableItems.reduce(
        (sum, item) => sum + (item.salePrice || item.price) * item.quantity,
        0
      ),
    [purchasableItems]
  )

  const isBogoActive = bogoDiscountAmount > 0
  const couponsDiscountTotal = appliedCoupons.reduce((sum, c) => sum + c.discountAmount, 0)
  const totalDiscount = isBogoActive ? bogoDiscountAmount : couponsDiscountTotal

  const cartAmountBeforePoints = Math.max(subtotal - totalDiscount, 0)
  const maxPointsBy15Percent = Math.round(0.15 * cartAmountBeforePoints * 100) / 100
  const usablePoints = Math.min(pointsBalance, maxPointsBy15Percent)
  const isCappedBy15Percent = pointsBalance > maxPointsBy15Percent

  // Clamp when the cap drops (cart or coupons changed).
  useEffect(() => {
    const before = Math.max(subtotal - totalDiscount, 0)
    const cap = Math.round(0.15 * before * 100) / 100
    const usable = Math.min(pointsBalance, cap)
    setPointsToUse(prev => (prev > usable ? usable : prev))
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
        : subtotal > 0
          ? DELIVERY_FEE_ILS
          : 0

  const finalTotal = Math.max(discountedSubtotal + deliveryFee, 0)
  const remainingForFreeDelivery = Math.max(FREE_DELIVERY_THRESHOLD_ILS - subtotal, 0)

  /**
   * Items hydrate from localStorage with maxStock 0 and stockStatus 'checking',
   * so between mount and the server's stock reply every line looks unpurchasable
   * and the order totals to zero. Callers use this to hold a loading state
   * instead of flashing "your cart is empty" and a ₪0.00 summary at someone who
   * is halfway through checking out.
   */
  const isValidatingStock =
    items.length > 0 &&
    purchasableItems.length === 0 &&
    items.every(item => item.stockStatus === 'checking')

  return {
    purchasableItems,
    cartItemsPayload,
    isValidatingStock,

    couponLoading,
    couponStatus,
    setCouponStatus,
    appliedCoupons,
    applyCouponCode,
    removeCoupon,

    pointsBalance,
    pointsToUse,
    setPointsToUse,
    pointsLoading,
    usablePoints,
    isCappedBy15Percent,
    maxPointsBy15Percent,

    isBogoActive,
    bogoDiscountAmount,
    bogoHasLeftover,

    subtotal,
    totalDiscount,
    pointsDiscount,
    discountedSubtotal,
    deliveryFee,
    finalTotal,
    remainingForFreeDelivery
  }
}

export type CartPricing = ReturnType<typeof useCartPricing>
