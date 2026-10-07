/**
 * Shared shapes and helpers for the single-page checkout (438:2725).
 *
 * Checkout is one screen: the form and the terms live together, and the CTA
 * opens the Cardcom gateway over the top of it. Nothing needs to survive a
 * navigation, so there is no cross-page session here — just the pieces the form
 * and the order payload both need.
 */

import { formatIsraelE164ToLocalDigits } from '@/lib/phone'
import type { CheckoutFormData } from '@/app/types/checkout'
// Type-only, so this module keeps no runtime dependency on the SWR cache.
import type { UserProfile } from '@/lib/user-profile-cache'

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
 * Joins the profile's separate street and house number back into the one field
 * the frame draws. The inverse of splitStreetAddress, so a prefilled address
 * that is never touched round-trips to the same two columns it came from.
 *
 * A stored house number with no street is dropped: on its own it would land in
 * the combined field as a bare "51", which splitStreetAddress reads back as a
 * street named "51" with no number.
 */
function joinStreetAddress(
  street: string | null | undefined,
  streetNumber: string | null | undefined
): string {
  const name = (street ?? '').trim()
  const number = (streetNumber ?? '').trim()
  if (!name) return ''
  return number ? `${name} ${number}` : name
}

/** A profile value is worth prefilling only if it is actually there. */
const filled = (value: string | null | undefined): string => (value ?? '').trim()

/**
 * Prefills the checkout form from the signed-in customer's saved profile.
 *
 * Three rules, in order of importance:
 *
 *  - Only blank fields are written. Anything already typed wins, so a profile
 *    that resolves late (the row is fetched, not bundled with the auth state)
 *    can never overwrite what someone is in the middle of entering, and an
 *    edited value stays edited if this runs again.
 *  - Only fields the profile actually holds are written. Everything else is
 *    left empty to be completed by hand — the row is nullable throughout, and
 *    there is no postal code column at all, so a partial profile is normal
 *    rather than exceptional.
 *  - `details` is returned by reference when nothing changed, so a signed-out
 *    visitor, or a second pass over an already-prefilled form, does not cost a
 *    render.
 *
 * The profile stores phone in E.164 (+972…) and the form collects the local
 * 0XXXXXXXXX that the order, invoice and courier SMS all carry; converting here
 * means the prefilled value is identical to the one someone would have typed.
 */
export function applyProfileToCheckoutDetails(
  details: CheckoutFormData,
  profile: Partial<UserProfile> | null | undefined,
  fallbackEmail?: string | null
): CheckoutFormData {
  const payer = { ...details.payer }
  const deliveryAddress = { ...details.deliveryAddress }
  let changed = false

  const put = <T extends Record<string, unknown>>(target: T, key: keyof T, value: string) => {
    if (!value) return
    if (filled(target[key] as string | null | undefined)) return
    target[key] = value as T[keyof T]
    changed = true
  }

  put(payer, 'firstName', filled(profile?.firstName))
  put(payer, 'lastName', filled(profile?.lastName))
  // The Firebase account's email is the fallback: it is the address she signed
  // in with, and it is present even when no profile row exists yet.
  put(payer, 'email', filled(profile?.email) || filled(fallbackEmail))
  put(payer, 'mobile', filled(formatIsraelE164ToLocalDigits(filled(profile?.phone) || null)))

  put(deliveryAddress, 'city', filled(profile?.addressCity))
  put(
    deliveryAddress,
    'streetName',
    joinStreetAddress(profile?.addressStreet, profile?.addressStreetNumber)
  )
  put(deliveryAddress, 'floor', filled(profile?.addressFloor))
  put(deliveryAddress, 'apartmentNumber', filled(profile?.addressApt))

  if (!changed) return details
  return { ...details, payer, deliveryAddress }
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
