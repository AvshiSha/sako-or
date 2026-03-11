import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type IncomingItem = {
  sku: string
  color?: string | null
  size?: string | null
  quantity: number
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const items: IncomingItem[] = Array.isArray(body?.items) ? body.items : []

    const resultItems: any[] = []
    let hadAdjustments = false

    const productCache = new Map<string, any>()

    for (const item of items) {
      const baseSku = typeof item?.sku === 'string' ? item.sku.trim() : ''
      if (!baseSku) continue

      const requestedQuantity = Number.isFinite(item.quantity)
        ? Math.max(0, Math.floor(item.quantity))
        : 0

      let product = productCache.get(baseSku)
      if (!product) {
        product = await prisma.product.findFirst({
          where: { sku: baseSku },
          select: {
            sku: true,
            title_en: true,
            title_he: true,
            price: true,
            salePrice: true,
            currency: true,
            colorVariants: true
          }
        })
        productCache.set(baseSku, product)
      }

      if (!product) {
        // Product missing – treat as out of stock and drop from purchasable set
        hadAdjustments = true
        resultItems.push({
          sku: baseSku,
          color: item.color ?? null,
          size: item.size ?? null,
          requestedQuantity,
          finalQuantity: 0,
          stock: 0,
          outOfStock: true,
          name: { en: '', he: '' },
          price: 0,
          salePrice: null,
          currency: 'ILS',
          image: null
        })
        continue
      }

      const colorSlug = item.color || null
      const sizeSlug = item.size || null
      const colorVariants = (product.colorVariants as any) || {}

      let variant: any = null
      let stockBySize: any = {}
      let stock = 0

      if (colorSlug) {
        // Color-specific variant
        variant = colorVariants[colorSlug] || null
        stockBySize = variant?.stockBySize || {}

        if (sizeSlug) {
          stock = Number(stockBySize[sizeSlug] || 0)
        } else {
          stock = Object.values(stockBySize).reduce(
            (sum: number, s: any) => sum + Number(s || 0),
            0
          )
        }
      } else {
        // No specific color selected – validate against total available stock
        const variantsArray: any[] = Object.values(colorVariants || {})

        if (sizeSlug) {
          // Sum stock for this size across all color variants
          stock = variantsArray.reduce((sum, v: any) => {
            const s = v?.stockBySize?.[sizeSlug]
            return sum + Number(s || 0)
          }, 0)

          // Choose a representative variant for pricing/image (prefer one with stock)
          variant =
            variantsArray.find(v => Number(v?.stockBySize?.[sizeSlug] || 0) > 0) ||
            variantsArray[0] ||
            null
        } else {
          // No size either – sum all stock across all variants and sizes
          stock = variantsArray.reduce((sum, v: any) => {
            const bySize = v?.stockBySize || {}
            const variantTotal = Object.values(bySize).reduce(
              (inner, s: any) => inner + Number(s || 0),
              0
            )
            return sum + variantTotal
          }, 0)

          // Representative variant for pricing/image
          variant = variantsArray[0] || null
        }
      }

      let finalQuantity = requestedQuantity
      let outOfStock = false

      // Use computed stock only – items without an explicit color should not be
      // treated as out of stock just because there is no single color variant.
      if (stock <= 0) {
        finalQuantity = 0
        outOfStock = true
      } else if (requestedQuantity > stock) {
        finalQuantity = stock
      }

      if (finalQuantity !== requestedQuantity || outOfStock) {
        hadAdjustments = true
      }

      const basePrice = variant?.priceOverride || product.price
      const salePrice = variant?.salePrice || product.salePrice || null
      const image =
        variant?.primaryImage ||
        (Array.isArray(variant?.images) ? variant.images[0] : null)

      resultItems.push({
        sku: baseSku,
        color: colorSlug,
        size: sizeSlug,
        requestedQuantity,
        finalQuantity,
        stock,
        outOfStock,
        name: {
          en: product.title_en || '',
          he: product.title_he || ''
        },
        price: Number(basePrice || 0),
        salePrice: salePrice != null ? Number(salePrice) : null,
        currency: product.currency || 'ILS',
        image
      })
    }

    return NextResponse.json(
      {
        items: resultItems,
        hadAdjustments
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('[cart/validate] Error:', error)
    return NextResponse.json(
      { error: 'Failed to validate cart' },
      { status: 500 }
    )
  }
}

