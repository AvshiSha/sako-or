import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { validateCartItems, type CartValidationInputItem } from '@/lib/cart-validation'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const items: CartValidationInputItem[] = Array.isArray(body?.items) ? body.items : []

    const validItems = items
      .map(item => ({
        sku: typeof item?.sku === 'string' ? item.sku.trim() : '',
        color: item.color ?? null,
        size: item.size ?? null,
        quantity: item.quantity
      }))
      .filter(item => item.sku)

    const { items: resultItems, hadAdjustments, purchasableSubtotal } = await validateCartItems(validItems)

    return NextResponse.json(
      {
        items: resultItems.map(item => ({
          sku: item.sku,
          color: item.color,
          size: item.size,
          requestedQuantity: item.requestedQuantity,
          finalQuantity: item.finalQuantity,
          stock: item.stock,
          outOfStock: !item.available,
          available: item.available,
          reasonCode: item.reasonCode,
          name: item.name,
          price: item.price,
          salePrice: item.salePrice,
          currency: item.currency,
          image: item.image
        })),
        hadAdjustments,
        purchasableSubtotal
      },
      { status: 200 }
    )
  } catch (error) {
    Sentry.captureException(error);
    console.error('[cart/validate] Error:', error)
    return NextResponse.json(
      { error: 'Failed to validate cart' },
      { status: 500 }
    )
  }
}
