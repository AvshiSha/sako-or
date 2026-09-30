'use client'

/**
 * Checkout — Figma 438:2725 "Checkout Details / Desktop".
 *
 * One screen. Delivery method, contact and address, the terms checkbox and the
 * CTA all live here, and the Cardcom gateway opens as an overlay on top of it.
 * The design file also has a "Checkout Payment" frame (438:2836) that re-shows
 * the same details for confirmation; it is deliberately not built, because it
 * adds a step without adding a decision.
 *
 * The frame draws the delivery choice as two checkboxes, not radios. They behave
 * as radios — exactly one is always selected, since an order is either picked up
 * or delivered — so they carry role="radio" for assistive tech while keeping the
 * designed square box.
 *
 * Design gaps, resolved and noted:
 * - The frame has no terms checkbox, but /api/payments/create-low-profile
 *   requires termsAccepted, so one sits under the form on the system's controls.
 * - No validation, empty-cart, gateway-error or loading state is drawn. Built
 *   from the same tokens as the states that are.
 * - The address fields are a flat list with no country or region, matching a
 *   storefront that ships within Israel only.
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

import CheckoutShell from '@/app/components/checkout/CheckoutShell'
import OrderSummaryPanel from '@/app/components/checkout/OrderSummaryPanel'
import ProductCarousel from '@/app/components/ProductCarousel'
import PaymentIframe from '@/app/components/PaymentIframe'
import { Field } from '@/app/components/ui/field'
import { Checkbox } from '@/app/components/ui/checkbox'
import { useCart } from '@/app/hooks/useCart'
import { useCartPricing } from '@/app/hooks/useCartPricing'
import { useAuth } from '@/app/contexts/AuthContext'
import {
  SHIPPING_METHOD_STORAGE_KEY,
  emptyCheckoutDetails,
  isDetailsComplete,
  splitStreetAddress,
  type ShippingMethod
} from '@/lib/checkout-session'
import {
  createPaymentSession,
  saveCheckoutInfo,
  markCartCheckedOut,
  CART_INVALID_ERROR_CODES
} from '@/lib/cardcom-session'
import {
  trackBeginCheckout,
  trackAddShippingInfo,
  trackAddPaymentInfo
} from '@/lib/dataLayer'
import { setFacebookPixelAdvancedMatching } from '@/lib/facebookPixel'
import { normalizeIsraelPhoneInput, formatIsraelE164ToLocalDigits } from '@/lib/phone'
import type { CheckoutFormData } from '@/app/types/checkout'
import type { Product } from '@/lib/product-types'

const content = {
  en: {
    title: 'Checkout',
    eyebrow: 'SECURE CHECKOUT',
    methodHeading: 'How would you like to receive your order?',
    pickup: 'Self pickup',
    delivery: 'Delivery',
    pickupNote: 'Pickup from our store at Rothschild 51, Rishon Lezion',
    firstName: 'First name',
    lastName: 'Last name',
    email: 'Email',
    phone: 'Phone',
    street: 'Street and house number',
    city: 'City',
    zip: 'Postal code',
    floor: 'Floor',
    apartment: 'Apartment',
    notes: 'Notes for the courier',
    termsPrefix: 'I have read and accept the ',
    termsLink: 'terms of sale',
    termsRequired: 'Please accept the terms to continue.',
    cta: 'Proceed to payment',
    preparing: 'Opening secure payment…',
    payTitle: 'Secure payment',
    close: 'Close',
    emptyTitle: 'Your cart is empty',
    emptyBody: 'Add something to your cart before checking out.',
    emptyCta: 'Continue shopping',
    required: 'This field is required',
    invalidEmail: 'Enter a valid email address',
    invalidPhone: 'Enter a valid phone number',
    incomplete: 'Please complete the required fields above.',
    genericError: 'Something went wrong opening the payment page. Please try again.',
    cartInvalid:
      'One or more products in your cart are no longer available. Please update your cart before continuing.',
    backToCart: 'Back to cart',
    recommendationsTitle: 'You may also like',
    recommendationsEyebrow: 'YOU MAY ALSO LIKE'
  },
  he: {
    title: 'תשלום',
    eyebrow: 'SECURE CHECKOUT',
    methodHeading: 'אופן קבלת ההזמנה',
    pickup: 'איסוף עצמי',
    delivery: 'משלוח',
    pickupNote: 'האיסוף מתבצע מהחנות ברחוב רוטשילד 51, ראשון לציון',
    firstName: 'שם פרטי',
    lastName: 'שם משפחה',
    email: 'מייל',
    phone: 'טלפון',
    street: 'רחוב ומספר בית',
    city: 'עיר',
    zip: 'מיקוד',
    floor: 'קומה',
    apartment: 'דירה',
    notes: 'הערות לשליח',
    termsPrefix: 'קראתי ואני מאשר/ת את ',
    termsLink: 'תנאי המכירה',
    termsRequired: 'יש לאשר את תנאי המכירה כדי להמשיך.',
    cta: 'המשך לתשלום',
    preparing: 'פותח עמוד תשלום מאובטח…',
    payTitle: 'תשלום מאובטח',
    close: 'סגירה',
    emptyTitle: 'הסל שלך ריק',
    emptyBody: 'יש להוסיף פריטים לסל לפני המעבר לתשלום.',
    emptyCta: 'המשך לקנות',
    required: 'שדה חובה',
    invalidEmail: 'יש להזין כתובת מייל תקינה',
    invalidPhone: 'יש להזין מספר טלפון תקין',
    incomplete: 'יש להשלים את שדות החובה שלמעלה.',
    genericError: 'אירעה תקלה בפתיחת עמוד התשלום. נא לנסות שוב.',
    cartInvalid: 'אחד או יותר מהמוצרים בסל אינם זמינים יותר. נא לעדכן את הסל לפני שממשיכים.',
    backToCart: 'חזרה לסל',
    recommendationsTitle: 'אולי תאהבו גם',
    recommendationsEyebrow: 'YOU MAY ALSO LIKE'
  }
} as const

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** 438:2749 — two 331.5px columns, 18px apart, each cell closing with 15px. */
const ROW_GRID = 'grid grid-cols-1 gap-x-[18px] gap-y-0 sm:grid-cols-2'
const CELL = 'pb-[15px]'

export interface CheckoutClientProps {
  recommendations?: Product[]
}

export default function CheckoutClient({ recommendations = [] }: CheckoutClientProps) {
  const params = useParams()
  const lng = (params?.lng as string) || 'en'
  const language: 'he' | 'en' = lng === 'he' ? 'he' : 'en'
  const t = content[language]

  const { items, loading, revalidateCart } = useCart()
  const { user } = useAuth()

  const [isClient, setIsClient] = useState(false)
  const [details, setDetails] = useState<CheckoutFormData>(() => emptyCheckoutDetails())
  const [showErrors, setShowErrors] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [termsError, setTermsError] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [redirectUrl, setRedirectUrl] = useState('')
  const [lowProfileId, setLowProfileId] = useState('')
  const [createdOrderId, setCreatedOrderId] = useState('')

  const shippingMethod = details.shippingMethod
  const pricing = useCartPricing({ items, loading, lng, shippingMethod })
  const {
    purchasableItems,
    subtotal,
    totalDiscount,
    deliveryFee,
    finalTotal,
    pointsToUse,
    appliedCoupons,
    isBogoActive,
    bogoDiscountAmount,
    isValidatingStock
  } = pricing

  useEffect(() => {
    setIsClient(true)
  }, [])

  /**
   * GA4 item payload, same shape the cart builds for view_cart so the two events
   * describe the order identically.
   */
  const checkoutItems = useMemo(
    () =>
      purchasableItems.map(item => ({
        name: item.name[language] || 'Unknown Product',
        id: item.sku,
        price: item.salePrice || item.price,
        brand: undefined,
        categories: undefined,
        variant: [item.size, item.color].filter(Boolean).join('-') || undefined,
        quantity: item.quantity
      })),
    [purchasableItems, language]
  )

  /**
   * begin_checkout. The modal fired this when it opened; reaching this page is
   * the same moment. Keyed on the item signature rather than on mount, because
   * the cart is still being priced against live stock when the page first
   * renders and firing then would report an empty order.
   */
  const beginCheckoutSignatureRef = useRef<string | null>(null)
  useEffect(() => {
    if (checkoutItems.length === 0) return

    const signature = JSON.stringify(checkoutItems)
    if (beginCheckoutSignatureRef.current === signature) return

    try {
      trackBeginCheckout(checkoutItems, 'ILS')
      beginCheckoutSignatureRef.current = signature
    } catch (dataLayerError) {
      console.warn('Data layer tracking error:', dataLayerError)
    }
  }, [checkoutItems])

  // Carry the cart's delivery choice over, and prefill from the account.
  useEffect(() => {
    if (typeof window === 'undefined') return

    let method: ShippingMethod = 'delivery'
    try {
      const fromCart = localStorage.getItem(SHIPPING_METHOD_STORAGE_KEY)
      if (fromCart === 'pickup' || fromCart === 'delivery') method = fromCart
    } catch {
      /* cart preference is a nicety; default to delivery */
    }

    setDetails(prev => ({
      ...prev,
      shippingMethod: method,
      payer: { ...prev.payer, email: user?.email ?? prev.payer.email }
    }))
  }, [user?.email])

  const setPayer = (key: keyof CheckoutFormData['payer'], value: string) =>
    setDetails(prev => ({ ...prev, payer: { ...prev.payer, [key]: value } }))

  const setAddress = (key: keyof CheckoutFormData['deliveryAddress'], value: string) =>
    setDetails(prev => ({
      ...prev,
      deliveryAddress: { ...prev.deliveryAddress, [key]: value }
    }))

  const setShippingMethod = (method: ShippingMethod) => {
    setDetails(prev => ({ ...prev, shippingMethod: method }))
    try {
      localStorage.setItem(SHIPPING_METHOD_STORAGE_KEY, method)
    } catch {
      /* non-fatal */
    }
  }

  const errors = useMemo(() => {
    const { payer, deliveryAddress } = details
    const next: Record<string, string> = {}

    if (!payer.firstName.trim()) next.firstName = t.required
    if (!payer.lastName.trim()) next.lastName = t.required
    if (!payer.email.trim()) next.email = t.required
    else if (!EMAIL_RE.test(payer.email.trim())) next.email = t.invalidEmail
    // Via lib/phone, so "+972 50-123-4567" is as acceptable as "050-123-4567".
    // The previous hand-rolled regex stripped the "+" before matching, which made
    // every international-format number invalid.
    if (!payer.mobile.trim()) next.mobile = t.required
    else if (!normalizeIsraelPhoneInput(payer.mobile)) next.mobile = t.invalidPhone

    if (details.shippingMethod === 'delivery') {
      if (!deliveryAddress.streetName.trim()) next.streetName = t.required
      if (!deliveryAddress.city.trim()) next.city = t.required
    }

    return next
  }, [details, t])

  const errorFor = (key: string) => (showErrors ? errors[key] ?? null : null)

  const isEmpty =
    isClient && !loading && !isValidatingStock && purchasableItems.length === 0

  const orderId = useMemo(() => `ORDER-${Date.now()}`, [])

  const handlePay = useCallback(async () => {
    if (isCreating) return

    if (Object.keys(errors).length > 0 || !isDetailsComplete(details)) {
      setShowErrors(true)
      return
    }
    if (!termsAccepted) {
      setTermsError(true)
      return
    }

    setShowErrors(false)
    setTermsError(false)
    setError(null)
    setIsCreating(true)

    // The frame's single "רחוב ומספר בית" field has to become the two the order
    // API wants. Done here rather than on every keystroke, so the house number
    // isn't torn off the street name while it's being typed.
    const { streetName, streetNumber } = splitStreetAddress(details.deliveryAddress.streetName)

    // However it was typed — +972, 00972, bare national — the order, the invoice
    // and the courier SMS all get the same 0XXXXXXXXX, which is the shape this
    // backend has always received. Validation above guarantees this parses.
    const e164 = normalizeIsraelPhoneInput(details.payer.mobile)
    const mobile = e164 ? formatIsraelE164ToLocalDigits(e164) : details.payer.mobile

    const payload: CheckoutFormData = {
      ...details,
      payer: { ...details.payer, mobile },
      deliveryAddress: { ...details.deliveryAddress, streetName, streetNumber }
    }

    // Tracking is wrapped separately and never rethrows: an analytics failure
    // must not stop someone paying.
    try {
      // add_shipping_info — the delivery choice is only confirmed once the form
      // passes, which is here rather than when the radio is clicked.
      trackAddShippingInfo(checkoutItems, payload.shippingMethod, 'ILS')

      // Restored from the modal: advanced matching improves pixel attribution,
      // and it has to be set before the purchase event fires on the Success page.
      setFacebookPixelAdvancedMatching({
        email: payload.payer.email,
        phone: payload.payer.mobile,
        firstName: payload.payer.firstName,
        lastName: payload.payer.lastName,
        city: payload.deliveryAddress.city,
        zip: payload.deliveryAddress.zipCode,
        country: 'israel'
      })
    } catch (dataLayerError) {
      console.warn('Data layer tracking error:', dataLayerError)
    }

    try {
      const authToken = user ? await user.getIdToken().catch(() => undefined) : undefined

      await markCartCheckedOut(orderId, authToken)
      await saveCheckoutInfo(payload)

      const result = await createPaymentSession({
        orderId,
        details: payload,
        items: purchasableItems,
        language,
        amount: finalTotal,
        subtotal,
        discountTotal: totalDiscount,
        deliveryFee,
        coupons: isBogoActive
          ? []
          : appliedCoupons.map(coupon => ({
              code: coupon.coupon.code,
              discountAmount: coupon.discountAmount,
              discountType: coupon.coupon.discountType,
              stackable: coupon.coupon.stackable,
              description: coupon.coupon.description?.[language] ?? undefined
            })),
        pointsToSpend: pointsToUse > 0 ? pointsToUse : undefined,
        bogoDiscountAmount: isBogoActive ? bogoDiscountAmount : undefined,
        termsAccepted,
        authToken
      })

      if (!result.success || !result.paymentUrl) {
        throw new Error(result.error || 'Failed to create payment session')
      }

      // add_payment_info — the gateway is about to open, so card details are the
      // next thing that happens. Cardcom is the only method wired up.
      try {
        trackAddPaymentInfo(checkoutItems, 'credit_card', 'ILS')
      } catch (dataLayerError) {
        console.warn('Data layer tracking error:', dataLayerError)
      }

      setRedirectUrl(result.paymentUrl)
      setLowProfileId(result.lowProfileId || '')
      setCreatedOrderId(result.orderId || orderId)
    } catch (err) {
      const code = (err as { code?: string } | null)?.code
      if (code && CART_INVALID_ERROR_CODES.has(code)) {
        setError(t.cartInvalid)
        await revalidateCart()
      } else {
        setError(err instanceof Error ? err.message : t.genericError)
      }
    } finally {
      setIsCreating(false)
    }
  }, [
    appliedCoupons,
    bogoDiscountAmount,
    checkoutItems,
    deliveryFee,
    details,
    errors,
    finalTotal,
    isBogoActive,
    isCreating,
    language,
    orderId,
    pointsToUse,
    purchasableItems,
    revalidateCart,
    subtotal,
    t,
    termsAccepted,
    totalDiscount,
    user
  ])

  const summary = (
    <OrderSummaryPanel
      pricing={pricing}
      language={language}
      shippingMethod={shippingMethod}
      showPoints={!!user}
      ctaLabel={isCreating ? t.preparing : t.cta}
      onCta={handlePay}
      ctaDisabled={isCreating || isEmpty || isValidatingStock || subtotal <= 0}
      notice={
        error ??
        (termsError
          ? t.termsRequired
          : showErrors && Object.keys(errors).length > 0
            ? t.incomplete
            : null)
      }
      className="lg:sticky lg:top-0"
    />
  )

  return (
    <>
      <CheckoutShell language={language} title={t.title} eyebrow={t.eyebrow} summary={summary}>
        {isEmpty ? (
          <div className="px-[16px] pb-[60px] text-start lg:px-[30px]">
            <h2 className="font-ploni text-[20px] font-black text-text-primary">{t.emptyTitle}</h2>
            <p className="mt-[10px] font-ploni text-[13px] leading-[16px] text-sako-gray-800">
              {t.emptyBody}
            </p>
            <Link
              href={`/${lng}`}
              className="mt-[24px] inline-flex border border-btn-primary-bg bg-btn-primary-bg px-[32px] py-[14px] font-ploni text-[16px] font-bold leading-none text-btn-primary-text transition-colors hover:bg-sako-ink-800"
            >
              {t.emptyCta}
            </Link>
          </div>
        ) : (
          <div className="px-[16px] pb-[40px] lg:px-[30px]">
            {/* 438:2740 — delivery choice */}
            <h2 className="font-ploni text-[24px] font-bold leading-[24px] text-start text-text-primary">
              {t.methodHeading}
            </h2>

            <div
              role="radiogroup"
              aria-label={t.methodHeading}
              className="mt-[10px] flex flex-col gap-[10px]"
            >
              {(['pickup', 'delivery'] as const).map(method => (
                <label
                  key={method}
                  className="flex cursor-pointer items-center gap-[10px] text-start font-ploni text-[14px] text-text-primary"
                >
                  <Checkbox
                    variant="sako"
                    role="radio"
                    aria-checked={shippingMethod === method}
                    checked={shippingMethod === method}
                    onCheckedChange={() => setShippingMethod(method)}
                  />
                  <span>{method === 'pickup' ? t.pickup : t.delivery}</span>
                </label>
              ))}
            </div>

            {shippingMethod === 'pickup' && (
              <p className="mt-[10px] font-ploni text-[12px] text-start text-sako-gray-800">
                {t.pickupNote}
              </p>
            )}

            {/* 438:2748 — the form. 681px in the frame; capped rather than fixed so
                it still fills a narrow column. */}
            <div className="mt-[30px] max-w-[681px]">
              <div className={ROW_GRID}>
                <Field
                  fieldClassName={CELL}
                  label={t.firstName}
                  required
                  autoComplete="given-name"
                  value={details.payer.firstName}
                  onChange={(e) => setPayer('firstName', e.target.value)}
                  error={errorFor('firstName')}
                />
                <Field
                  fieldClassName={CELL}
                  label={t.lastName}
                  required
                  autoComplete="family-name"
                  value={details.payer.lastName}
                  onChange={(e) => setPayer('lastName', e.target.value)}
                  error={errorFor('lastName')}
                />
              </div>

              <Field
                fieldClassName={CELL}
                label={t.email}
                type="email"
                required
                autoComplete="email"
                value={details.payer.email}
                onChange={(e) => setPayer('email', e.target.value)}
                error={errorFor('email')}
              />

              <Field
                fieldClassName={CELL}
                label={t.phone}
                type="tel"
                required
                autoComplete="tel"
                inputMode="tel"
                // dir="ltr": a phone number is not Hebrew text and reads backwards
                // if it inherits the page direction.
                dir="ltr"
                value={details.payer.mobile}
                onChange={(e) => setPayer('mobile', e.target.value)}
                error={errorFor('mobile')}
              />

              {shippingMethod === 'delivery' && (
                <>
                  <Field
                    fieldClassName={CELL}
                    label={t.street}
                    required
                    autoComplete="street-address"
                    value={details.deliveryAddress.streetName}
                    onChange={(e) => setAddress('streetName', e.target.value)}
                    error={errorFor('streetName')}
                  />

                  <div className={ROW_GRID}>
                    <Field
                      fieldClassName={CELL}
                      label={t.city}
                      required
                      autoComplete="address-level2"
                      value={details.deliveryAddress.city}
                      onChange={(e) => setAddress('city', e.target.value)}
                      error={errorFor('city')}
                    />
                    <Field
                      fieldClassName={CELL}
                      label={t.zip}
                      autoComplete="postal-code"
                      inputMode="numeric"
                      dir="ltr"
                      value={details.deliveryAddress.zipCode ?? ''}
                      onChange={(e) => setAddress('zipCode', e.target.value)}
                    />
                  </div>

                  <div className={ROW_GRID}>
                    <Field
                      fieldClassName={CELL}
                      label={t.floor}
                      inputMode="numeric"
                      value={details.deliveryAddress.floor ?? ''}
                      onChange={(e) => setAddress('floor', e.target.value)}
                    />
                    <Field
                      fieldClassName={CELL}
                      label={t.apartment}
                      inputMode="numeric"
                      value={details.deliveryAddress.apartmentNumber ?? ''}
                      onChange={(e) => setAddress('apartmentNumber', e.target.value)}
                    />
                  </div>

                  <Field
                    fieldClassName={CELL}
                    label={t.notes}
                    value={details.notes ?? ''}
                    onChange={(e) => setDetails(prev => ({ ...prev, notes: e.target.value }))}
                  />
                </>
              )}

              {/* Not in the frame, but create-low-profile requires termsAccepted.
                  The link sits outside the <label> deliberately: nested in it, a
                  click on "terms of sale" would toggle the box instead of opening
                  them, which is the one thing this control must not do. */}
              <div className="mt-[20px] flex items-start gap-[10px] text-start font-ploni text-[14px] text-text-primary">
                <Checkbox
                  id="checkout-terms"
                  variant="sako"
                  className="mt-[2px]"
                  checked={termsAccepted}
                  onCheckedChange={(next) => {
                    setTermsAccepted(next === true)
                    if (next === true) setTermsError(false)
                  }}
                  aria-invalid={termsError || undefined}
                />
                <span>
                  <label htmlFor="checkout-terms" className="cursor-pointer">
                    {t.termsPrefix}
                  </label>
                  <Link
                    href={`/${lng}/terms`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline transition-opacity hover:opacity-60"
                  >
                    {t.termsLink}
                  </Link>
                </span>
              </div>

              {termsError && (
                <p role="alert" className="mt-[8px] font-ploni text-[12px] text-accent-error">
                  {t.termsRequired}
                </p>
              )}

              {error && (
                <div className="mt-[20px] border border-accent-error px-[16px] py-[12px]">
                  <p role="alert" className="font-ploni text-[13px] text-accent-error">
                    {error}
                  </p>
                  <Link
                    href={`/${lng}/cart`}
                    className="mt-[8px] inline-block font-ploni text-[9px] tracking-[0.72px] text-text-primary underline"
                  >
                    {t.backToCart}
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </CheckoutShell>

      {recommendations.length > 0 && (
        <ProductCarousel
          products={recommendations}
          title={t.recommendationsTitle}
          eyebrow={t.recommendationsEyebrow}
          language={language}
        />
      )}

      {/* The gateway. Undesigned, so it takes the system's own surfaces: a full
          ink scrim with a paper sheet and a single caption. */}
      {redirectUrl && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t.payTitle}
          className="fixed inset-0 z-50 flex items-center justify-center bg-sako-ink-900/80 p-[16px]"
        >
          <div className="flex h-full max-h-[860px] w-full max-w-[560px] flex-col bg-surface-secondary">
            <div className="flex items-center justify-between border-b border-sako-black px-[16px] py-[12px]">
              <h2 className="font-ploni text-[13px] font-bold text-text-primary">{t.payTitle}</h2>
              <button
                type="button"
                onClick={() => setRedirectUrl('')}
                className="font-ploni text-[9px] tracking-[0.72px] text-text-primary underline transition-opacity hover:opacity-60"
              >
                {t.close}
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <PaymentIframe
                redirectUrl={redirectUrl}
                lowProfileId={lowProfileId}
                orderId={createdOrderId}
                language={language}
                // No-op, as in the modal: PaymentIframe performs the redirect to
                // Success/Failed/Cancel itself, so there is nothing left to do here.
                onPaymentComplete={() => {}}
                onError={(message) => {
                  setRedirectUrl('')
                  setError(message || t.genericError)
                }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
