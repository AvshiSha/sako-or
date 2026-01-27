/**
 * Cart Item API - Create/Update cart items
 * 
 * IMPORTANT: Cart Item Status Immutability Rules
 * 
 * - IN_CART, REMOVED, CHECKED_OUT: Mutable statuses - can be updated or reused
 * - PURCHASED: Immutable/historical status - once set, never modified or reused
 * 
 * When adding items to cart:
 * - Only search for items with mutable statuses (IN_CART, REMOVED, CHECKED_OUT)
 * - Never update or reuse PURCHASED items
 * - If no mutable item exists, create a new one
 * - If creation fails due to unique constraint (PURCHASED item exists), handle gracefully
 * 
 * This ensures data integrity for purchase history, analytics, and automations.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUserAuth } from '@/lib/server/auth'
import { buildCartKey } from '@/lib/cart'

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUserAuth(request)
    if (auth instanceof NextResponse) return auth
    const firebaseUid = auth.firebaseUid
    
    const neonUser = await prisma.user.findUnique({
      where: { firebaseUid },
      select: { id: true }
    })
    
    if (!neonUser) {
      return NextResponse.json(
        { error: 'Profile not found. Please complete your profile first.' },
        { status: 404 }
      )
    }
    
    const userId = neonUser.id

    const body = await request.json().catch(() => ({}))
    const baseSku = typeof body?.baseSku === 'string' ? body.baseSku.trim() : ''
    const colorSlug = typeof body?.colorSlug === 'string' ? body.colorSlug.trim() : null
    const sizeSlug = typeof body?.sizeSlug === 'string' ? body.sizeSlug.trim() : null
    const quantityDelta = typeof body?.quantityDelta === 'number' ? body.quantityDelta : null
    const quantitySet = typeof body?.quantitySet === 'number' ? body.quantitySet : null
    const unitPrice = typeof body?.unitPrice === 'number' ? body.unitPrice : null

    if (!baseSku) {
      return NextResponse.json(
        { error: 'Missing baseSku' },
        { status: 400 }
      )
    }

    const cartKey = buildCartKey(baseSku, colorSlug, sizeSlug)
    if (!cartKey) {
      return NextResponse.json(
        { error: 'Invalid cart key' },
        { status: 400 }
      )
    }

    // Validate stock availability before adding to cart
    // Only validate if we're adding items (not removing)
    const isAddingItems = (quantitySet !== null && quantitySet > 0) || 
                          (quantityDelta !== null && quantityDelta > 0) ||
                          (quantitySet === null && quantityDelta === null) // Default is +1
    
    if (isAddingItems && (colorSlug || sizeSlug)) {
      try {
        // Fetch product from database to check stock
        const product = await prisma.product.findFirst({
          where: { sku: baseSku },
          select: {
            id: true,
            sku: true,
            colorVariants: true,
          },
        })

        if (!product) {
          return NextResponse.json(
            { error: 'Product not found' },
            { status: 404 }
          )
        }

        const colorVariants = (product.colorVariants as any) || {}

        // Validate color variant exists
        if (colorSlug && !colorVariants[colorSlug]) {
          return NextResponse.json(
            { error: `Color variant "${colorSlug}" not found for product ${baseSku}` },
            { status: 400 }
          )
        }

        // Check if color variant is active
        if (colorSlug && colorVariants[colorSlug]?.isActive === false) {
          return NextResponse.json(
            { error: `Color variant "${colorSlug}" is not available` },
            { status: 400 }
          )
        }

        // Validate size and stock if size is specified
        if (sizeSlug && colorSlug) {
          const variant = colorVariants[colorSlug]
          if (!variant) {
            return NextResponse.json(
              { error: `Color variant "${colorSlug}" not found` },
              { status: 400 }
            )
          }

          const stockBySize = variant.stockBySize || {}
          const stock = stockBySize[sizeSlug]

          if (stock === undefined) {
            return NextResponse.json(
              { error: `Size "${sizeSlug}" not found for color variant "${colorSlug}"` },
              { status: 400 }
            )
          }

          if (stock <= 0) {
            return NextResponse.json(
              { error: `Size "${sizeSlug}" for color "${colorSlug}" is out of stock` },
              { status: 400 }
            )
          }

          // Check if requested quantity exceeds available stock
          const requestedQuantity = quantitySet !== null ? quantitySet : 
                                    (quantityDelta !== null ? (existing?.quantity ?? 0) + quantityDelta : 1)
          
          if (requestedQuantity > stock) {
            return NextResponse.json(
              { error: `Insufficient stock. Only ${stock} ${stock === 1 ? 'item' : 'items'} available` },
              { status: 400 }
            )
          }
        } else if (colorSlug && !sizeSlug) {
          // If color is specified but no size, check if color variant has any available sizes
          const variant = colorVariants[colorSlug]
          if (!variant) {
            return NextResponse.json(
              { error: `Color variant "${colorSlug}" not found` },
              { status: 400 }
            )
          }

          const stockBySize = variant.stockBySize || {}
          const totalStock = Object.values(stockBySize).reduce((sum: number, stock: any) => sum + (Number(stock) || 0), 0)

          if (totalStock <= 0) {
            return NextResponse.json(
              { error: `Color variant "${colorSlug}" is out of stock` },
              { status: 400 }
            )
          }
        }
      } catch (stockValidationError: any) {
        console.error('[cart/item] Stock validation error:', stockValidationError)
        // If validation fails due to database error, log but don't block
        // The UI should prevent this, but we log for monitoring
        if (stockValidationError?.code === 'P2002' || stockValidationError?.code === 'P2025') {
          // Prisma errors - continue with cart operation
          // UI validation should have caught this
        } else {
          // Other errors - return error response
          return NextResponse.json(
            { error: 'Failed to validate stock availability' },
            { status: 500 }
          )
        }
      }
    }

    const now = new Date()

    // IMPORTANT: Only search for mutable cart items (IN_CART, REMOVED, CHECKED_OUT)
    // PURCHASED items are immutable/historical and must never be updated or reused
    const existing = await prisma.cartItem.findFirst({
      where: {
        userId,
        cartKey,
        // Only consider mutable statuses - PURCHASED items are immutable
        status: {
          in: ['IN_CART', 'REMOVED', 'CHECKED_OUT']
        }
      }
    })

    // Check if a PURCHASED item exists (for better error handling)
    let purchasedItem = null
    if (!existing) {
      try {
        purchasedItem = await prisma.cartItem.findFirst({
          where: {
            userId,
            cartKey,
            status: 'PURCHASED'
          }
        })
      } catch (checkError) {
        // If check fails, log but continue - we'll handle the create error if it occurs
        console.warn('[cart/item] Error checking for PURCHASED item:', checkError)
      }
    }

    let finalQuantity: number

    if (quantitySet !== null) {
      finalQuantity = quantitySet
    } else if (quantityDelta !== null) {
      finalQuantity = (existing?.quantity ?? 0) + quantityDelta
    } else {
      finalQuantity = (existing?.quantity ?? 0) + 1
    }

    // Ensure quantity is not negative
    finalQuantity = Math.max(0, finalQuantity)

    if (!existing) {
      // No mutable cart item exists - check if PURCHASED item exists
      if (purchasedItem) {
        // A PURCHASED item exists - we need to create a new cart item with a modified cartKey
        // to work around the unique constraint while preserving the original cartKey for matching
        // Append timestamp to make it unique: {originalCartKey}::{timestamp}
        const timestamp = Date.now()
        const uniqueCartKey = `${cartKey}::${timestamp}`
        
        console.log(`[cart/item] PURCHASED item exists with cartKey: ${cartKey}. Creating new item with unique cartKey: ${uniqueCartKey}`);
        
        try {
          if (finalQuantity <= 0) {
            // Create as REMOVED
            await prisma.cartItem.create({
              data: {
                userId,
                cartKey: uniqueCartKey, // Use modified cartKey
                baseSku,
                colorSlug,
                sizeSlug,
                quantity: 0,
                unitPrice: unitPrice,
                status: 'REMOVED',
                removedAt: now
              }
            })
          } else {
            // Create as IN_CART
            await prisma.cartItem.create({
              data: {
                userId,
                cartKey: uniqueCartKey, // Use modified cartKey
                baseSku,
                colorSlug,
                sizeSlug,
                quantity: finalQuantity,
                unitPrice: unitPrice,
                status: 'IN_CART',
                removedAt: null
              }
            })
          }
        } catch (createError: any) {
          console.error('[cart/item] Error creating item with unique cartKey:', {
            code: createError?.code,
            message: createError?.message,
            meta: createError?.meta,
            uniqueCartKey,
            userId
          })
          throw createError
        }
        
        return NextResponse.json({ 
          success: true,
          message: 'Item added to cart (previous purchase exists as historical record)'
        }, { status: 200 })
      }

      // No item exists at all - create a new one with original cartKey
      try {
        if (finalQuantity <= 0) {
          // Create as REMOVED
          await prisma.cartItem.create({
            data: {
              userId,
              cartKey,
              baseSku,
              colorSlug,
              sizeSlug,
              quantity: 0,
              unitPrice: unitPrice,
              status: 'REMOVED',
              removedAt: now
            }
          })
        } else {
          // Create as IN_CART
          await prisma.cartItem.create({
            data: {
              userId,
              cartKey,
              baseSku,
              colorSlug,
              sizeSlug,
              quantity: finalQuantity,
              unitPrice: unitPrice,
              status: 'IN_CART',
              removedAt: null
            }
          })
        }
      } catch (createError: any) {
        // Log the error for debugging
        console.error('[cart/item] Create error:', {
          code: createError?.code,
          message: createError?.message,
          meta: createError?.meta,
          cartKey,
          userId
        })

        // Fallback: If creation fails due to unique constraint, handle it
        // This could happen if a PURCHASED item was created between our check and create
        if (createError?.code === 'P2002') {
          const target = createError?.meta?.target
          const targetStr = Array.isArray(target) ? target.join(',') : String(target ?? '')
          
          // Check if it's the userId_cartKey constraint
          if (targetStr.includes('userId') && targetStr.includes('cartKey')) {
            // Race condition: PURCHASED item was created between check and create
            // Retry with unique cartKey
            const timestamp = Date.now()
            const uniqueCartKey = `${cartKey}::${timestamp}`
            console.log(`[cart/item] Race condition detected - retrying with unique cartKey: ${uniqueCartKey}`);
            
            try {
              await prisma.cartItem.create({
                data: {
                  userId,
                  cartKey: uniqueCartKey,
                  baseSku,
                  colorSlug,
                  sizeSlug,
                  quantity: finalQuantity,
                  unitPrice: unitPrice,
                  status: 'IN_CART',
                  removedAt: null
                }
              })
              return NextResponse.json({ 
                success: true,
                message: 'Item added to cart'
              }, { status: 200 })
            } catch (retryError) {
              console.error('[cart/item] Retry with unique cartKey also failed:', retryError)
              throw retryError
            }
          }
          
          // Other unique constraint - return conflict
          return NextResponse.json(
            { error: 'Conflict: unique constraint violation', details: targetStr },
            { status: 409 }
          )
        }
        
        // Re-throw if it's not a unique constraint error we can handle
        throw createError
      }
    } else {
      // Update existing mutable cart item
      // This will never be a PURCHASED item due to the where clause above
      if (finalQuantity <= 0) {
        // Mark as REMOVED
        await prisma.cartItem.update({
          where: { id: existing.id },
          data: {
            quantity: 0,
            status: 'REMOVED',
            removedAt: now,
            updatedAt: now
          }
        })
      } else {
        // Update as IN_CART
        await prisma.cartItem.update({
          where: { id: existing.id },
          data: {
            quantity: finalQuantity,
            unitPrice: unitPrice !== null ? unitPrice : existing.unitPrice,
            status: 'IN_CART',
            removedAt: null,
            updatedAt: now
          }
        })
      }
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error: any) {
    // Log the full error for debugging
    console.error('[cart/item] Error:', {
      code: error?.code,
      message: error?.message,
      meta: error?.meta,
      stack: error?.stack
    })

    // Handle Prisma unique constraint violations
    if (error?.code === 'P2002') {
      const target = error?.meta?.target
      const targetStr = Array.isArray(target) ? target.join(',') : String(target ?? '')
      
      if (targetStr.includes('userId') && targetStr.includes('cartKey')) {
        // Unique constraint on userId + cartKey - likely a PURCHASED item exists
        console.warn(`[cart/item] Unique constraint violation - PURCHASED item may exist with cartKey`);
        return NextResponse.json({ 
          success: true,
          message: 'Item was previously purchased. Historical record exists.',
          purchased: true
        }, { status: 200 })
      }
      
      // Other unique constraint violations
      return NextResponse.json(
        { error: 'Conflict: unique constraint violation' },
        { status: 409 }
      )
    }

    const message =
      typeof error?.message === 'string' ? error.message : 'Unable to update cart item'
    const status = message.includes('Bearer token') ? 401 : 400
    return NextResponse.json({ error: message }, { status })
  }
}

