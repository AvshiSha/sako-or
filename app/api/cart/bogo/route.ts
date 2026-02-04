import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { computeBogoForCartItems } from '@/lib/bogo'

const cartItemSchema = z.object({
  sku: z.string().min(1),
  quantity: z.number().int().nonnegative(),
  price: z.number().nonnegative(),
  salePrice: z.number().nonnegative().nullable().optional()
})

const requestSchema = z.object({
  items: z.array(cartItemSchema)
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const payload = requestSchema.parse(body)

    const result = await computeBogoForCartItems(
      payload.items.map(item => ({
        sku: item.sku,
        quantity: item.quantity,
        price: item.price,
        salePrice: item.salePrice ?? undefined
      }))
    )

    return NextResponse.json(
      {
        success: true,
        bogoDiscountAmount: result.bogoDiscountAmount,
        regularTotalEligible: result.regularTotalEligible,
        discountedTotalEligible: result.discountedTotalEligible,
        hasLeftover: result.hasLeftover,
        pairs: result.pairs
      },
      { status: 200 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          code: 'INVALID_REQUEST',
          message: 'Invalid BOGO calculation payload',
          details: error.flatten()
        },
        { status: 400 }
      )
    }

    console.error('[CART_BOGO_ERROR]', error)
    return NextResponse.json(
      {
        success: false,
        code: 'UNKNOWN_ERROR',
        message: 'Unable to calculate BOGO discount'
      },
      { status: 500 }
    )
  }
}

