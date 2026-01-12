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

    const where = {
      userId_cartKey: { userId, cartKey }
    } as const

    const existing = await prisma.cartItem.findUnique({ where })
    const now = new Date()

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
      // Create new row
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
    } else {
      // Update existing row
      if (finalQuantity <= 0) {
        // Mark as REMOVED
        await prisma.cartItem.update({
          where,
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
          where,
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
    const message =
      typeof error?.message === 'string' ? error.message : 'Unable to update cart item'
    const status = message.includes('Bearer token') ? 401 : 400
    return NextResponse.json({ error: message }, { status })
  }
}

