import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { render } from '@react-email/render'
import { OrderConfirmationEmailHebrew } from '../../app/emails/order-confirmation-hebrew'
import { toOrderAddressColumns, resolveOrderDeliveryAddress } from '../delivery-address'

/**
 * The whole chain, minus the gateway: the columns an order stores → the address the
 * email resolves → the HTML a customer actually receives.
 *
 * ORDER-1794778738486 was charged, confirmed, and emailed with an empty shipping
 * address. Its address was never in doubt — "אעבלין", submitted correctly — so the
 * check that matters is not whether a validator accepts it but whether it survives
 * all the way into the message. These tests assert on rendered HTML for that reason.
 */

const STORE_HE = { city: 'ראשון לציון', streetName: 'רוטשילד 51, ראשון לציון' }

/** Renders the Hebrew confirmation email for an order's stored address columns. */
async function renderEmailFor(
  submitted: Parameters<typeof toOrderAddressColumns>[0],
  shippingMethod: 'delivery' | 'pickup' = 'delivery'
): Promise<string> {
  const stored = toOrderAddressColumns(submitted)
  const deliveryAddress = resolveOrderDeliveryAddress(stored, shippingMethod, STORE_HE)

  return render(
    React.createElement(OrderConfirmationEmailHebrew, {
      customerName: 'חנין שיחאחמד',
      orderNumber: 'ORDER-TEST-1',
      orderDate: '15/11/2026',
      items: [{ name: 'SAKO WO LB 8002', quantity: 1, price: 699 }],
      total: 699,
      subtotal: 699,
      deliveryFee: 0,
      discountTotal: 0,
      payer: {
        firstName: 'חנין',
        lastName: 'שיחאחמד',
        email: 'qa@example.com',
        mobile: '0529572163',
        idNumber: ''
      },
      deliveryAddress,
      isHebrew: true,
      shippingMethod
    })
  )
}

describe('order confirmation email — delivery address', () => {
  it('contains an address that has no house number', async () => {
    // The exact address from the order that emailed a blank one.
    const html = await renderEmailFor({ city: 'אעבלין', streetName: 'אעבלין', streetNumber: '' })
    assert.ok(html.includes('אעבלין'), 'city/street must appear in the rendered email')
  })

  it('contains a block/parcel street value', async () => {
    const html = await renderEmailFor({ city: 'נצרת', streetName: '5026/2', streetNumber: '' })
    assert.ok(html.includes('נצרת'), 'city must appear')
    assert.ok(html.includes('5026/2'), 'block/parcel street must appear')
  })

  it('contains a full address including the optional fields', async () => {
    const html = await renderEmailFor({
      city: 'תל אביב',
      streetName: 'רוטשילד',
      streetNumber: '51',
      floor: '3',
      apartmentNumber: '25',
      zipCode: '1645102'
    })
    assert.ok(html.includes('תל אביב'), 'city must appear')
    assert.ok(html.includes('רוטשילד'), 'street must appear')
    assert.ok(html.includes('51'), 'house number must appear')
  })

  /**
   * The regression that motivated storing the address on the order: the email used
   * to resolve it from the newest checkout row for the customer's email address, so
   * a later order's address could be rendered onto an earlier order's confirmation.
   */
  it('renders each of two orders from the same customer with its own address', async () => {
    const firstEmail = await renderEmailFor({ city: 'אעבלין', streetName: 'אעבלין' })
    const secondEmail = await renderEmailFor({
      city: 'תל אביב',
      streetName: 'רוטשילד',
      streetNumber: '51'
    })

    assert.ok(firstEmail.includes('אעבלין'), 'first order keeps its own city')
    assert.ok(!firstEmail.includes('רוטשילד'), 'first order must not show the later address')

    assert.ok(secondEmail.includes('רוטשילד'), 'second order keeps its own street')
    assert.ok(!secondEmail.includes('אעבלין'), 'second order must not show the earlier address')
  })

  it('shows the store address for a pickup order', async () => {
    const html = await renderEmailFor(undefined, 'pickup')
    assert.ok(html.includes('ראשון לציון'), 'pickup email shows the store address')
  })
})
