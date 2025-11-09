import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  evaluateAutoApplyCoupons,
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
  cartItems: z.array(cartItemSchema).min(1),
  currency: z.string().optional(),
  locale: z.enum(['en', 'he'] as [SupportedLocale, SupportedLocale]).optional(),
  userIdentifier: z.string().optional()
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const payload = requestSchema.parse(body)

    const result = await evaluateAutoApplyCoupons(
      payload.cartItems as CouponCartItemInput[],
      {
        currency: payload.currency,
        locale: payload.locale,
        userIdentifier: payload.userIdentifier
      }
    )

    if (!result) {
      return NextResponse.json(
        {
          success: false,
          code: 'NO_AUTO_COUPON_AVAILABLE',
          messages: {
            en: 'No automatic coupons available for this cart.',
            he: 'לא נמצאו קופונים אוטומטיים עבור עגלה זו.'
          }
        },
        { status: 200 }
      )
    }

    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          code: 'INVALID_REQUEST',
          messages: {
            en: 'Invalid auto-apply coupon request payload.',
            he: 'נתוני בקשת הקופון האוטומטי שגויים.'
          },
          details: error.flatten()
        },
        { status: 400 }
      )
    }

    console.error('[COUPON_AUTO_APPLY_ERROR]', error)
    return NextResponse.json(
      {
        success: false,
        code: 'UNKNOWN_ERROR',
        messages: {
          en: 'Unable to evaluate automatic coupons at the moment.',
          he: 'לא ניתן להעריך קופונים אוטומטיים כעת.'
        }
      },
      { status: 500 }
    )
  }
}

