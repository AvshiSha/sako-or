import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  missingDeliveryAddressFields,
  isDeliveryAddressComplete,
  formatStreetLine,
  toOrderAddressColumns,
  resolveOrderDeliveryAddress,
  hasStoredAddress
} from '../delivery-address'

/**
 * These are regression tests for a specific production failure, not a general
 * exercise of the validator.
 *
 * A customer in אעבלין typed her town as both city and street and left the house
 * number empty, because her address has none. The payment route accepted it; the
 * checkout-record route still demanded a house number and rejected it silently;
 * her confirmation email arrived with no address (ORDER-1794778738486).
 *
 * The cases below are the ones that failure turned on: a real address with no house
 * number must pass, a genuinely empty one must not, and whitespace must not count
 * as a value.
 */
describe('missingDeliveryAddressFields', () => {
  it('accepts a delivery address with no house number', () => {
    // The exact address from ORDER-1794778738486.
    assert.deepEqual(
      missingDeliveryAddressFields(
        { city: 'אעבלין', streetName: 'אעבלין', streetNumber: '' },
        'delivery'
      ),
      []
    )
  })

  it('accepts a block/parcel street value', () => {
    // נצרת-style block/parcel numbering, the case that started all of this.
    assert.deepEqual(
      missingDeliveryAddressFields(
        { city: 'נצרת', streetName: '5026/2', streetNumber: '' },
        'delivery'
      ),
      []
    )
  })

  it('accepts an ordinary address with a house number', () => {
    assert.deepEqual(
      missingDeliveryAddressFields(
        { city: 'תל אביב', streetName: 'רוטשילד', streetNumber: '51' },
        'delivery'
      ),
      []
    )
  })

  it('rejects a missing city, and names it', () => {
    assert.deepEqual(
      missingDeliveryAddressFields({ city: '', streetName: 'רוטשילד' }, 'delivery'),
      ['city']
    )
  })

  it('rejects a missing street, and names it', () => {
    assert.deepEqual(
      missingDeliveryAddressFields({ city: 'תל אביב', streetName: '' }, 'delivery'),
      ['streetName']
    )
  })

  it('names every missing field, city first', () => {
    assert.deepEqual(missingDeliveryAddressFields({}, 'delivery'), ['city', 'streetName'])
  })

  it('treats whitespace as missing', () => {
    assert.deepEqual(
      missingDeliveryAddressFields({ city: '   ', streetName: '\t\n' }, 'delivery'),
      ['city', 'streetName']
    )
  })

  it('rejects an absent address object rather than skipping the check', () => {
    // The guard used to read through `body.deliveryAddress.city` and throw, turning
    // a 400 into a 500. Absent must mean "everything is missing".
    assert.deepEqual(missingDeliveryAddressFields(undefined, 'delivery'), ['city', 'streetName'])
    assert.deepEqual(missingDeliveryAddressFields(null, 'delivery'), ['city', 'streetName'])
  })

  it('defaults to delivery when the shipping method is absent', () => {
    assert.deepEqual(missingDeliveryAddressFields({}, undefined), ['city', 'streetName'])
    assert.deepEqual(missingDeliveryAddressFields({}, null), ['city', 'streetName'])
  })

  it('requires no address for store pickup', () => {
    assert.deepEqual(missingDeliveryAddressFields({}, 'pickup'), [])
    assert.deepEqual(missingDeliveryAddressFields(undefined, 'pickup'), [])
  })
})

describe('isDeliveryAddressComplete', () => {
  it('agrees with the field list', () => {
    assert.equal(isDeliveryAddressComplete({ city: 'אעבלין', streetName: 'אעבלין' }, 'delivery'), true)
    assert.equal(isDeliveryAddressComplete({ city: 'אעבלין' }, 'delivery'), false)
    assert.equal(isDeliveryAddressComplete(undefined, 'pickup'), true)
  })
})

describe('formatStreetLine', () => {
  it('leaves no trailing space when there is no house number', () => {
    assert.equal(formatStreetLine({ streetName: 'אעבלין', streetNumber: '' }), 'אעבלין')
    assert.equal(formatStreetLine({ streetName: '5026/2' }), '5026/2')
  })

  it('joins street and house number', () => {
    assert.equal(formatStreetLine({ streetName: 'רוטשילד', streetNumber: '51' }), 'רוטשילד 51')
  })

  it('survives an absent address', () => {
    assert.equal(formatStreetLine(undefined), '')
  })
})

const STORE_HE = { city: 'ראשון לציון', streetName: 'רוטשילד 51, ראשון לציון' }

describe('toOrderAddressColumns', () => {
  it('stores every submitted field, including the optional ones', () => {
    assert.deepEqual(
      toOrderAddressColumns({
        city: 'תל אביב',
        streetName: 'רוטשילד',
        streetNumber: '51',
        floor: '3',
        apartmentNumber: '25',
        zipCode: '1645102'
      }),
      {
        shippingCity: 'תל אביב',
        shippingStreetName: 'רוטשילד',
        shippingStreetNumber: '51',
        shippingFloor: '3',
        shippingApartment: '25',
        shippingZip: '1645102'
      }
    )
  })

  it('stores an address with no house number as null, not an empty string', () => {
    const stored = toOrderAddressColumns({ city: 'אעבלין', streetName: 'אעבלין', streetNumber: '' })
    assert.equal(stored.shippingCity, 'אעבלין')
    assert.equal(stored.shippingStreetName, 'אעבלין')
    assert.equal(stored.shippingStreetNumber, null)
  })

  it('trims, and treats whitespace-only optionals as absent', () => {
    const stored = toOrderAddressColumns({
      city: '  נצרת  ',
      streetName: ' 5026/2 ',
      streetNumber: '   ',
      floor: '\t'
    })
    assert.equal(stored.shippingCity, 'נצרת')
    assert.equal(stored.shippingStreetName, '5026/2')
    assert.equal(stored.shippingStreetNumber, null)
    assert.equal(stored.shippingFloor, null)
  })

  it('maps an absent address to all-null (pickup orders)', () => {
    assert.deepEqual(toOrderAddressColumns(undefined), {
      shippingCity: null,
      shippingStreetName: null,
      shippingStreetNumber: null,
      shippingFloor: null,
      shippingApartment: null,
      shippingZip: null
    })
  })
})

describe('resolveOrderDeliveryAddress', () => {
  it('renders the order\'s own stored address', () => {
    const order = toOrderAddressColumns({
      city: 'אעבלין',
      streetName: 'אעבלין',
      streetNumber: '',
      floor: '2'
    })
    assert.deepEqual(resolveOrderDeliveryAddress(order, 'delivery', STORE_HE), {
      city: 'אעבלין',
      streetName: 'אעבלין',
      streetNumber: '',
      floor: '2',
      apartmentNumber: '',
      zipCode: ''
    })
  })

  /**
   * The bug this whole change exists to prevent: the address was looked up by
   * customer email, newest first, so a second order would render its address onto
   * the first one. Each order must keep its own.
   */
  it('keeps two orders from the same customer on their own addresses', () => {
    const firstOrder = toOrderAddressColumns({ city: 'אעבלין', streetName: 'אעבלין' })
    const secondOrder = toOrderAddressColumns({
      city: 'תל אביב',
      streetName: 'רוטשילד',
      streetNumber: '51'
    })

    assert.equal(resolveOrderDeliveryAddress(firstOrder, 'delivery', STORE_HE).city, 'אעבלין')
    assert.equal(resolveOrderDeliveryAddress(secondOrder, 'delivery', STORE_HE).city, 'תל אביב')
    // And the later order's house number must not leak onto the earlier one.
    assert.equal(resolveOrderDeliveryAddress(firstOrder, 'delivery', STORE_HE).streetNumber, '')
    assert.equal(resolveOrderDeliveryAddress(secondOrder, 'delivery', STORE_HE).streetNumber, '51')
  })

  it('substitutes the store address for pickup, ignoring any stored address', () => {
    const order = toOrderAddressColumns({ city: 'אעבלין', streetName: 'אעבלין' })
    assert.deepEqual(resolveOrderDeliveryAddress(order, 'pickup', STORE_HE), {
      city: 'ראשון לציון',
      streetName: 'רוטשילד 51, ראשון לציון',
      streetNumber: '',
      floor: '',
      apartmentNumber: '',
      zipCode: ''
    })
  })

  it('renders blank for a pre-migration order rather than guessing', () => {
    assert.deepEqual(resolveOrderDeliveryAddress({}, 'delivery', STORE_HE), {
      city: '',
      streetName: '',
      streetNumber: '',
      floor: '',
      apartmentNumber: '',
      zipCode: ''
    })
    assert.deepEqual(resolveOrderDeliveryAddress(null, 'delivery', STORE_HE).city, '')
  })
})

describe('hasStoredAddress', () => {
  it('distinguishes a stored address from a pre-migration order', () => {
    assert.equal(hasStoredAddress(toOrderAddressColumns({ city: 'אעבלין', streetName: 'אעבלין' })), true)
    assert.equal(hasStoredAddress(toOrderAddressColumns(undefined)), false)
    assert.equal(hasStoredAddress({}), false)
    assert.equal(hasStoredAddress(null), false)
  })
})
