/**
 * Shared shapes and helpers for the single-page checkout (438:2725).
 *
 * Checkout is one screen: the form and the terms live together, and the CTA
 * opens the Cardcom gateway over the top of it. Nothing needs to survive a
 * navigation, so there is no cross-page session here — just the pieces the form
 * and the order payload both need.
 */

import type { CheckoutFormData } from '@/app/types/checkout'

export type ShippingMethod = 'delivery' | 'pickup'

/** Unchanged from the modal implementation, so a cart in flight keeps its choice. */
export const SHIPPING_METHOD_STORAGE_KEY = 'cart_shipping_method'

export const STORE_PICKUP_LOCATION = 'Rothschild 51, Rishon Lezion'

export function emptyCheckoutDetails(shippingMethod: ShippingMethod = 'delivery'): CheckoutFormData {
  return {
    payer: { firstName: '', lastName: '', email: '', mobile: '', idNumber: '' },
    deliveryAddress: {
      city: '',
      streetName: '',
      streetNumber: '',
      floor: '',
      apartmentNumber: '',
      zipCode: ''
    },
    shippingMethod,
    pickupLocation: STORE_PICKUP_LOCATION,
    notes: ''
  }
}

/**
 * The frame (438:2762) collects street and house number in ONE field, labelled
 * "רחוב ומספר בית", but DeliveryAddress — and the order API behind it — wants
 * them apart. Split on the trailing number so the designed single field still
 * produces the shape the gateway expects.
 *
 * "רוטשילד 51" → { streetName: "רוטשילד", streetNumber: "51" }
 * "רוטשילד 51ב" → { streetName: "רוטשילד", streetNumber: "51ב" }
 * "שדרות הנשיא" → { streetName: "שדרות הנשיא", streetNumber: "" }
 */
export function splitStreetAddress(combined: string): {
  streetName: string
  streetNumber: string
} {
  const value = combined.trim().replace(/\s+/g, ' ')
  if (!value) return { streetName: '', streetNumber: '' }

  // Last whitespace-delimited token that starts with a digit.
  const match = value.match(/^(.*?)[\s,]+(\d+\S*)$/)
  if (!match) return { streetName: value, streetNumber: '' }

  return { streetName: match[1].trim(), streetNumber: match[2].trim() }
}

/**
 * Everything required before a low-profile payment session can be created.
 *
 * streetNumber is deliberately NOT required: it is parsed out of the combined
 * field above and plenty of Israeli addresses (named squares, kibbutzim) have
 * no house number at all. Requiring it here made the designed single field
 * impossible to satisfy.
 */
export function isDetailsComplete(details: CheckoutFormData | null): boolean {
  if (!details) return false

  const { payer, deliveryAddress, shippingMethod } = details
  const hasPayer =
    !!payer.firstName.trim() &&
    !!payer.lastName.trim() &&
    !!payer.email.trim() &&
    !!payer.mobile.trim()

  if (!hasPayer) return false
  // Pickup needs no address; delivery needs somewhere to send it.
  if (shippingMethod === 'pickup') return true

  return !!deliveryAddress.city.trim() && !!deliveryAddress.streetName.trim()
}
