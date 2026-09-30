/**
 * Creating a Cardcom low-profile payment session.
 *
 * Lifted out of CheckoutModal so the routed checkout can open the gateway with
 * exactly the same payload. This is the money path: the request shape here is a
 * faithful copy of the modal's, field for field, and should stay that way until
 * the modal is retired.
 *
 * Nothing here touches card data — Cardcom collects that inside its own iframe.
 * We only create the session and hand back the URL to mount.
 */

import type { CartItem } from '@/app/hooks/useCart'
import type {
  CheckoutFormData,
  CreateLowProfileRequest,
  CreateLowProfileResponse
} from '@/app/types/checkout'

export interface AppliedCouponPayload {
  code: string
  discountAmount: number
  discountType: 'percent_all' | 'percent_specific' | 'fixed' | 'bogo'
  stackable: boolean
  description?: string
}

export interface CreateSessionParams {
  orderId: string
  details: CheckoutFormData
  items: CartItem[]
  language: 'he' | 'en'
  currency?: 'ILS' | 'USD'
  amount: number
  subtotal: number
  discountTotal: number
  deliveryFee: number
  coupons?: AppliedCouponPayload[]
  pointsToSpend?: number
  bogoDiscountAmount?: number
  termsAccepted: boolean
  /** Firebase ID token; omitted for guest checkout. */
  authToken?: string
}

/** Errors the caller should surface as "your cart changed", not as a crash. */
export const CART_INVALID_ERROR_CODES = new Set([
  'CART_EMPTY',
  'CART_ITEM_UNAVAILABLE',
  'CART_ITEM_OUT_OF_STOCK',
  'CART_PRICE_MISMATCH'
])

/** Persists the address/contact block. Best-effort — never blocks payment. */
export async function saveCheckoutInfo(details: CheckoutFormData): Promise<string | null> {
  try {
    const response = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(details)
    })
    if (!response.ok) return null
    const result = await response.json().catch(() => null)
    return result?.checkoutId ?? null
  } catch (error) {
    console.warn('[checkout] Failed to save checkout info:', error)
    return null
  }
}

/** Marks the server-side cart as checked out. Best-effort, signed-in users only. */
export async function markCartCheckedOut(orderId: string, authToken?: string): Promise<void> {
  if (!authToken) return
  try {
    await fetch('/api/cart/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({ orderId })
    })
  } catch (error) {
    console.warn('[checkout] Failed to mark cart as checked out:', error)
  }
}

export async function createPaymentSession(
  params: CreateSessionParams
): Promise<CreateLowProfileResponse> {
  const {
    orderId,
    details,
    items,
    language,
    currency = 'ILS',
    amount,
    subtotal,
    discountTotal,
    deliveryFee,
    coupons = [],
    pointsToSpend,
    bogoDiscountAmount,
    termsAccepted,
    authToken
  } = params

  if (!items || items.length === 0) {
    throw Object.assign(new Error('Cart is empty'), { code: 'CART_EMPTY' })
  }

  const orderItems = items.map(item => ({
    productName: item.name[language] || item.sku,
    productSku: item.sku,
    quantity: item.quantity,
    price: item.salePrice || item.price,
    color: item.color,
    size: item.size
  }))

  const firstItem = items[0]
  const legacyProductName = firstItem.name[language] || firstItem.sku

  const payload: CreateLowProfileRequest = {
    orderId,
    amount,
    currencyIso: currency === 'USD' ? 2 : 1,
    language,
    // Legacy single-product fields the endpoint still expects alongside `items`.
    productName: legacyProductName,
    productSku: firstItem.sku,
    quantity: items.reduce((sum, item) => sum + item.quantity, 0),
    items: orderItems,
    customer: details.payer,
    deliveryAddress: details.deliveryAddress,
    notes: details.notes,
    subtotal,
    discountTotal,
    deliveryFee,
    coupons,
    ui: {
      isCardOwnerPhoneRequired: true,
      cssUrl: `${window.location.origin}/cardcom.css`
    },
    advanced: {
      jValidateType: 5,
      threeDSecureState: 'Auto',
      minNumOfPayments: 1,
      maxNumOfPayments: 1
    },
    pointsToSpend: pointsToSpend && pointsToSpend > 0 ? pointsToSpend : undefined,
    shippingMethod: details.shippingMethod,
    pickupLocation: details.pickupLocation,
    bogoDiscountAmount:
      bogoDiscountAmount && bogoDiscountAmount > 0 ? bogoDiscountAmount : undefined,
    termsAccepted
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (authToken) headers.Authorization = `Bearer ${authToken}`

  const response = await fetch('/api/payments/create-low-profile', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    const message =
      errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`
    console.error('Payment session creation failed:', { status: response.status, errorData })
    throw Object.assign(new Error(message), { code: errorData.code })
  }

  try {
    return await response.json()
  } catch (error) {
    console.error('Failed to parse payment response:', error)
    throw new Error('Invalid response from server')
  }
}
