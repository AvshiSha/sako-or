import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  validateCouponForCart,
  CouponCartItemInput,
  SupportedLocale
} from '@/lib/coupons'

const cartItemSchema = z.object({
  sku: z.string().min(1),
  quantity: z.number().int().nonnegative(),
  price: z.number().nonnegative(),
  salePrice: z.number().nonnegative().nullable().optional(),
  color: z.string().nullable().optional(),
  size: z.string().nullable().optional()
})

const requestSchema = z.object({
  code: z.string().min(1),
  cartItems: z.array(cartItemSchema).min(1),
  currency: z.string().optional(),
  locale: z.enum(['en', 'he'] as [SupportedLocale, SupportedLocale]).optional(),
  userIdentifier: z.string().optional(),
  existingCouponCodes: z.array(z.string()).optional()
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const payload = requestSchema.parse(body)

    const result = await validateCouponForCart({
      code: payload.code,
      cartItems: payload.cartItems as CouponCartItemInput[],
      currency: payload.currency,
      locale: payload.locale,
      userIdentifier: payload.userIdentifier,
      existingCouponCodes: payload.existingCouponCodes
    })

    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          code: 'INVALID_REQUEST',
          messages: {
            en: 'Invalid coupon request payload.',
            he: 'נתוני בקשת הקופון שגויים.'
          },
          details: error.flatten()
        },
        { status: 400 }
      )
    }

    console.error('[COUPON_APPLY_ERROR]', error)
    return NextResponse.json(
      {
        success: false,
        code: 'UNKNOWN_ERROR',
        messages: {
          en: 'Unable to apply coupon at the moment.',
          he: 'לא ניתן להחיל את הקופון כעת.'
        }
      },
      { status: 500 }
    )
  }
}

