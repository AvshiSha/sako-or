import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'

/**
 * Regression test for order ORDER-1795682631457.
 *
 * The customer typed `meira_sabag.@walla.com`. The customer and info@sako-or.com
 * shared one Resend call, and the team email was gated behind its success, so a
 * single 422 on that address meant all three emails were lost.
 *
 * These tests drive the real sendOrderConfirmationEmail with Resend's HTTP layer
 * stubbed, and assert that whatever happens to the customer's message, the shop
 * and team still get theirs.
 */

process.env.RESEND_API_KEY ??= 'test_key_for_isolation_tests'
process.env.DATABASE_URL ??= 'postgresql://user:pass@localhost:5432/unused'

const originalFetch = globalThis.fetch

interface SentMessage {
  to: string[]
  subject: string
}

/** Stub Resend's REST endpoint. `behaviour` decides each recipient's fate. */
function stubResend(behaviour: (to: string[]) => 'ok' | 'validation_error' | 'throw') {
  const sent: SentMessage[] = []
  const attempted: string[][] = []

  globalThis.fetch = (async (input: any, init?: any) => {
    const url = String(typeof input === 'string' ? input : input?.url ?? '')
    if (!url.includes('/emails')) {
      return originalFetch(input, init)
    }

    const body = JSON.parse(String(init?.body ?? '{}'))
    const to: string[] = Array.isArray(body.to) ? body.to : [body.to]
    attempted.push(to)

    const outcome = behaviour(to)

    if (outcome === 'throw') {
      throw new TypeError('fetch failed')
    }

    if (outcome === 'validation_error') {
      return new Response(
        JSON.stringify({
          statusCode: 422,
          name: 'validation_error',
          message:
            'Invalid `to` field. The email address needs to follow the `email@example.com` or `Name <email@example.com>` format.',
        }),
        { status: 422, headers: { 'content-type': 'application/json' } }
      )
    }

    sent.push({ to, subject: body.subject })
    return new Response(JSON.stringify({ id: `msg-${sent.length}` }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }) as typeof globalThis.fetch

  return { sent, attempted }
}

function orderData(customerEmail: string) {
  return {
    customerEmail,
    customerName: 'מאירה סבג',
    orderNumber: 'ORDER-TEST-ISOLATION',
    orderDate: '26/11/2026',
    items: [
      { name: 'SAKO BLEN BOW 9526', sku: '5129-9526', size: '40', quantity: 1, price: 386.1 },
    ],
    total: 386.1,
    subtotal: 386.1,
    deliveryFee: 0,
    discountTotal: 0,
    coupons: [],
    payer: {
      firstName: 'מאירה',
      lastName: 'סבג',
      email: customerEmail,
      mobile: '0543209346',
      idNumber: '',
    },
    deliveryAddress: {
      city: 'כרמיאל',
      streetName: 'משעול הכורם',
      streetNumber: '11/3',
      floor: '1',
      apartmentNumber: '3',
      zipCode: '2172759',
    },
    isHebrew: true,
    shippingMethod: 'delivery' as const,
  }
}

const recipientsOf = (sent: SentMessage[]) => sent.flatMap((m) => m.to).sort()

describe('order confirmation email isolation', () => {
  beforeEach(() => {
    globalThis.fetch = originalFetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('sends one separate message per recipient when all succeed', async () => {
    const { sent } = stubResend(() => 'ok')
    const { sendOrderConfirmationEmail } = await import('../email')

    const result = await sendOrderConfirmationEmail(orderData('meira_sabag@walla.com'))

    assert.equal(result.success, true)
    assert.equal(result.customerSuccess, true)
    assert.equal(sent.length, 3)
    assert.deepEqual(recipientsOf(sent), [
      'info@sako-or.com',
      'meira_sabag@walla.com',
      'moshe@sako-or.com',
    ])
    // Each message addresses exactly one recipient - no shared `to` array.
    for (const message of sent) {
      assert.equal(message.to.length, 1)
    }
  })

  it('still notifies shop and team when the customer address is rejected as invalid', async () => {
    // The address is syntactically valid here, so it reaches Resend and Resend
    // is the one that refuses it - the 422 path.
    const { sent } = stubResend((to) =>
      to[0] === 'rejected@walla.com' ? 'validation_error' : 'ok'
    )
    const { sendOrderConfirmationEmail } = await import('../email')

    const result = await sendOrderConfirmationEmail(orderData('rejected@walla.com'))

    assert.equal(result.customerSuccess, false)
    assert.equal(result.success, true, 'the attempt as a whole made progress')
    assert.deepEqual(recipientsOf(sent), ['info@sako-or.com', 'moshe@sako-or.com'])

    const byLabel = Object.fromEntries((result.results ?? []).map((r) => [r.label, r]))
    assert.equal(byLabel.customer.success, false)
    assert.equal(byLabel.shop.success, true)
    assert.equal(byLabel.team.success, true)
  })

  it('still notifies shop and team when the customer send throws', async () => {
    const { sent } = stubResend((to) => (to[0] === 'boom@walla.com' ? 'throw' : 'ok'))
    const { sendOrderConfirmationEmail } = await import('../email')

    const result = await sendOrderConfirmationEmail(orderData('boom@walla.com'))

    assert.equal(result.customerSuccess, false)
    assert.deepEqual(recipientsOf(sent), ['info@sako-or.com', 'moshe@sako-or.com'])
  })

  it('does not even attempt a malformed customer address, but still sends the rest', async () => {
    const { sent, attempted } = stubResend(() => 'ok')
    const { sendOrderConfirmationEmail } = await import('../email')

    // The exact address from ORDER-1795682631457.
    const result = await sendOrderConfirmationEmail(orderData('meira_sabag.@walla.com'))

    assert.equal(result.customerSuccess, false)
    assert.deepEqual(recipientsOf(sent), ['info@sako-or.com', 'moshe@sako-or.com'])
    assert.ok(
      !attempted.flat().includes('meira_sabag.@walla.com'),
      'a locally-invalid address should not cost a round trip'
    )
  })

  it('reports failure only when every recipient fails', async () => {
    stubResend(() => 'throw')
    const { sendOrderConfirmationEmail } = await import('../email')

    const result = await sendOrderConfirmationEmail(orderData('meira_sabag@walla.com'))

    assert.equal(result.success, false)
    assert.equal(result.customerSuccess, false)
  })

  it('gives each recipient a distinct idempotency key', async () => {
    const keys: string[] = []
    globalThis.fetch = (async (input: any, init?: any) => {
      const url = String(typeof input === 'string' ? input : input?.url ?? '')
      if (!url.includes('/emails')) return originalFetch(input, init)
      const headers = new Headers(init?.headers)
      const key = headers.get('Idempotency-Key')
      if (key) keys.push(key)
      return new Response(JSON.stringify({ id: 'msg' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as typeof globalThis.fetch

    const { sendOrderConfirmationEmail } = await import('../email')
    await sendOrderConfirmationEmail(orderData('meira_sabag@walla.com'))

    assert.equal(keys.length, 3, 'every send should carry an idempotency key')
    assert.equal(new Set(keys).size, 3, 'Resend rejects a reused key with a different payload')
  })
})
