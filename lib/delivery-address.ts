/**
 * The one delivery-address rule, shared by everything that enforces it.
 *
 * This exists because there were two copies of it. `/api/payments/create-low-profile`
 * and `/api/checkout` each validated the same address independently, and when the
 * checkout form stopped requiring a house number only the first was updated. The
 * second kept rejecting, and because the call that writes the checkout record is
 * best-effort, the rejection was invisible: customers paid, orders were created, and
 * their confirmation emails arrived with no delivery address at all (ORDER-1794778738486,
 * "אעבלין" — a town whose addresses have no house numbers).
 *
 * So: one function, one rule, imported by both routes and by the client's own
 * completeness check. A future change to what delivery requires happens here once.
 *
 *  - city and streetName are required for delivery, and whitespace is not a value.
 *  - streetNumber is NEVER required. Block/parcel addresses ("5026/2"), named
 *    squares, kibbutzim and whole towns have no house number.
 *  - pickup requires no address at all; the store's own is substituted downstream.
 */

/** The address fields this rule can report as missing. */
export type DeliveryAddressField = 'city' | 'streetName'

/** The required-for-delivery fields, in the order they are reported to a customer. */
const REQUIRED_FOR_DELIVERY = ['city', 'streetName'] as const

/** Only the parts of an address this rule reads; callers pass their own wider shape. */
export interface DeliveryAddressLike {
  city?: string | null
  streetName?: string | null
  streetNumber?: string | null
}

/**
 * Which required fields are missing. Empty array means the address is acceptable,
 * which for pickup is always, since no address is collected.
 */
export function missingDeliveryAddressFields(
  address: DeliveryAddressLike | null | undefined,
  shippingMethod?: string | null
): DeliveryAddressField[] {
  if ((shippingMethod ?? 'delivery') === 'pickup') return []
  return REQUIRED_FOR_DELIVERY.filter(field => !address?.[field]?.trim())
}

/** Convenience wrapper for callers that only need a yes/no. */
export function isDeliveryAddressComplete(
  address: DeliveryAddressLike | null | undefined,
  shippingMethod?: string | null
): boolean {
  return missingDeliveryAddressFields(address, shippingMethod).length === 0
}

/**
 * The address as one line, for an invoice or a courier label. A missing house
 * number must not leave a trailing space, so this joins rather than interpolates.
 */
export function formatStreetLine(address: DeliveryAddressLike | null | undefined): string {
  return [address?.streetName, address?.streetNumber]
    .map(part => part?.trim())
    .filter(Boolean)
    .join(' ')
}

/** Every address field a checkout can submit. */
export interface SubmittedAddress extends DeliveryAddressLike {
  floor?: string | null
  apartmentNumber?: string | null
  zipCode?: string | null
}

/** The `orders.shipping_*` columns, as stored. */
export interface StoredOrderAddress {
  shippingCity?: string | null
  shippingStreetName?: string | null
  shippingStreetNumber?: string | null
  shippingFloor?: string | null
  shippingApartment?: string | null
  shippingZip?: string | null
}

/** The shape emails and fulfillment views render. */
export interface RenderableAddress {
  city: string
  streetName: string
  streetNumber: string
  floor: string
  apartmentNumber: string
  zipCode: string
}

/**
 * Submitted address → the order's columns.
 *
 * Trims, and turns an empty optional into null rather than "", so "no house number"
 * reads identically whether the field was absent, empty or whitespace.
 */
export function toOrderAddressColumns(
  address: SubmittedAddress | null | undefined
): StoredOrderAddress {
  const value = (raw: string | null | undefined) => raw?.trim() || null
  return {
    shippingCity: value(address?.city),
    shippingStreetName: value(address?.streetName),
    shippingStreetNumber: value(address?.streetNumber),
    shippingFloor: value(address?.floor),
    shippingApartment: value(address?.apartmentNumber),
    shippingZip: value(address?.zipCode)
  }
}

/** True when the order actually has an address of its own stored. */
export function hasStoredAddress(order: StoredOrderAddress | null | undefined): boolean {
  return !!(order?.shippingCity || order?.shippingStreetName)
}

/**
 * The address to show for an order — strictly that order's own columns.
 *
 * Never consults the customer's profile or any other order. An order placed before
 * these columns existed renders blank, deliberately: the previous behaviour guessed
 * from the customer's most recent checkout row, which could render a newer address
 * onto an older order. A visible blank is the safer failure for a shipping address.
 */
export function resolveOrderDeliveryAddress(
  order: StoredOrderAddress | null | undefined,
  shippingMethod: string | null | undefined,
  storePickupAddress: { city: string; streetName: string }
): RenderableAddress {
  if ((shippingMethod ?? 'delivery') === 'pickup') {
    return {
      city: storePickupAddress.city,
      streetName: storePickupAddress.streetName,
      streetNumber: '',
      floor: '',
      apartmentNumber: '',
      zipCode: ''
    }
  }

  return {
    city: order?.shippingCity || '',
    streetName: order?.shippingStreetName || '',
    streetNumber: order?.shippingStreetNumber || '',
    floor: order?.shippingFloor || '',
    apartmentNumber: order?.shippingApartment || '',
    zipCode: order?.shippingZip || ''
  }
}
