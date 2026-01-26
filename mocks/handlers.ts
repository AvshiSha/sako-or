import { http, HttpResponse } from 'msw'
import { mockProducts, mockCartItems, mockCoupons, mockUser, mockOrder, createCartItemResponse } from './fixtures'

const baseUrl = 'http://localhost:3000'

export const handlers = [
  // Cart API handlers
  http.post(`${baseUrl}/api/cart/item`, async ({ request }) => {
    const body = await request.json() as any
    const item = {
      sku: body.baseSku,
      quantity: body.quantitySet || body.quantityDelta || 1,
      price: body.unitPrice || 300,
      salePrice: null,
      color: body.colorSlug || null,
      size: body.sizeSlug || null,
    }
    return HttpResponse.json(createCartItemResponse(item))
  }),

  http.get(`${baseUrl}/api/cart`, async () => {
    return HttpResponse.json({
      items: mockCartItems,
      total: 650,
      totalItems: 3,
    })
  }),

  http.post(`${baseUrl}/api/cart/checkout`, async () => {
    return HttpResponse.json({
      success: true,
      count: mockCartItems.length,
    })
  }),

  // Product API handlers
  http.get(`${baseUrl}/api/products`, async ({ request }) => {
    const url = new URL(request.url)
    const category = url.searchParams.get('category')
    const limit = parseInt(url.searchParams.get('limit') || '20')

    let products = mockProducts
    if (category) {
      products = products.filter(p => p.category === category)
    }

    return HttpResponse.json({
      products: products.slice(0, limit),
      pagination: {
        total: products.length,
        limit,
      },
    })
  }),

  http.get(`${baseUrl}/api/products/:id`, async ({ params }) => {
    const product = mockProducts.find(p => p.id === params.id || p.sku === params.id)
    if (!product) {
      return HttpResponse.json({ error: 'Product not found' }, { status: 404 })
    }
    return HttpResponse.json({ product })
  }),

  // OTP API handlers
  http.post(`${baseUrl}/api/otp/send`, async ({ request }) => {
    const body = await request.json() as any
    const { otpType, otpValue } = body

    // Simulate cooldown error
    if (otpValue === '+972501111111') {
      return HttpResponse.json(
        {
          error: 'COOLDOWN',
          message: 'Please wait 60s before requesting another code.',
        },
        { status: 429 }
      )
    }

    // Simulate invalid phone
    if (otpType === 'sms' && !otpValue.startsWith('+972') && !otpValue.startsWith('0')) {
      return HttpResponse.json(
        { error: 'Invalid phone number format.' },
        { status: 400 }
      )
    }

    // Simulate invalid email
    if (otpType === 'email' && !otpValue.includes('@')) {
      return HttpResponse.json(
        { error: 'Invalid email address.' },
        { status: 400 }
      )
    }

    return HttpResponse.json({ ok: true })
  }),

  http.post(`${baseUrl}/api/otp/verify`, async ({ request }) => {
    const body = await request.json() as any
    const { otpCode } = body

    // Simulate invalid OTP
    if (otpCode === '000000') {
      return HttpResponse.json(
        { error: 'Invalid or expired code.' },
        { status: 400 }
      )
    }

    return HttpResponse.json({
      success: true,
      token: 'mock-auth-token',
    })
  }),

  // Coupon API handlers
  http.post(`${baseUrl}/api/coupons/apply`, async ({ request }) => {
    const body = await request.json() as any
    const { code, cartItems } = body
    const normalizedCode = code.trim().toUpperCase()

    // Find coupon
    const couponKey = Object.keys(mockCoupons).find(
      key => mockCoupons[key as keyof typeof mockCoupons].code === normalizedCode
    )

    if (!couponKey) {
      return HttpResponse.json({
        success: false,
        code: 'COUPON_NOT_FOUND',
        messages: {
          en: 'Coupon not found',
          he: 'קופון לא נמצא',
        },
      })
    }

    const coupon = mockCoupons[couponKey as keyof typeof mockCoupons]

    // Check if expired
    if (coupon.expiresAt && coupon.expiresAt < new Date()) {
      return HttpResponse.json({
        success: false,
        code: 'COUPON_EXPIRED',
        messages: {
          en: 'This coupon has expired',
          he: 'קופון זה פג תוקף',
        },
      })
    }

    // Check if inactive
    if (!coupon.isActive) {
      return HttpResponse.json({
        success: false,
        code: 'COUPON_INACTIVE',
        messages: {
          en: 'This coupon is not active',
          he: 'קופון זה לא פעיל',
        },
      })
    }

    // Calculate discount (simplified)
    const subtotal = cartItems.reduce((sum: number, item: any) => {
      return sum + (item.salePrice || item.price) * item.quantity
    }, 0)

    let discountAmount = 0
    if (coupon.discountType === 'percent_all') {
      discountAmount = subtotal * (coupon.discountValue! / 100)
    } else if (coupon.discountType === 'fixed') {
      discountAmount = Math.min(coupon.discountValue!, subtotal)
    }

    return HttpResponse.json({
      success: true,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        name: coupon.name,
        description: coupon.description,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        discountAmount,
        discountLabel: {
          en: `${coupon.discountValue}% off`,
          he: `${coupon.discountValue}% הנחה`,
        },
        stackable: coupon.stackable,
        minCartValue: coupon.minCartValue,
        autoApply: coupon.autoApply,
      },
      subtotal,
      newSubtotal: Math.max(0, subtotal - discountAmount),
      discountAmount,
      discountedItems: [],
      messages: {
        en: 'Coupon applied successfully',
        he: 'קופון הוחל בהצלחה',
      },
      warnings: [],
    })
  }),

  http.post(`${baseUrl}/api/coupons/auto-apply`, async ({ request }) => {
    const body = await request.json() as any
    // Return empty array for auto-apply (no auto-apply coupons in test)
    return HttpResponse.json({
      appliedCoupons: [],
    })
  }),

  // Checkout API handlers
  http.post(`${baseUrl}/api/checkout`, async ({ request }) => {
    const body = await request.json() as any

    // Validate required fields
    if (!body.payer?.firstName || !body.payer?.email) {
      return HttpResponse.json(
        { error: 'Missing required payer information' },
        { status: 400 }
      )
    }

    return HttpResponse.json({
      success: true,
      checkoutId: 'checkout-123',
      message: 'Checkout information saved successfully',
    })
  }),

  // Payment API handlers
  http.post(`${baseUrl}/api/payments/create-low-profile`, async ({ request }) => {
    const body = await request.json() as any

    // Simulate payment session creation
    return HttpResponse.json({
      success: true,
      paymentUrl: 'https://secure.cardcom.solutions/?token=mock-token',
      lowProfileId: 'lp-12345',
      orderId: body.orderId || 'order-123',
    })
  }),

  http.get(`${baseUrl}/api/payments/check-status`, async ({ request }) => {
    const url = new URL(request.url)
    const lowProfileId = url.searchParams.get('lowProfileId')

    if (lowProfileId === 'failed') {
      return HttpResponse.json({
        status: 'failed',
        message: 'Payment failed',
      })
    }

    return HttpResponse.json({
      status: 'success',
      message: 'Payment successful',
    })
  }),

  // User/Points API handlers
  http.get(`${baseUrl}/api/me/points`, async () => {
    return HttpResponse.json({
      balance: mockUser.pointsBalance,
      totalEarned: 2000,
      totalSpent: 1000,
    })
  }),

  http.post(`${baseUrl}/api/me/points`, async ({ request }) => {
    const body = await request.json() as any
    return HttpResponse.json({
      success: true,
      newBalance: mockUser.pointsBalance - (body.amount || 0),
    })
  }),

  // Favorites API handlers
  http.get(`${baseUrl}/api/favorites`, async () => {
    return HttpResponse.json({
      favorites: [],
    })
  }),

  http.post(`${baseUrl}/api/favorites/toggle`, async ({ request }) => {
    const body = await request.json() as any
    return HttpResponse.json({
      success: true,
      isFavorite: body.isFavorite !== false,
    })
  }),
]
