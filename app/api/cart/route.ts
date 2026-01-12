import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUserAuth } from '@/lib/server/auth'

export async function GET(request: NextRequest) {
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

    const cartItems = await prisma.cartItem.findMany({
      where: { 
        userId,
        status: 'IN_CART'
      },
      orderBy: { updatedAt: 'desc' },
      select: {
        cartKey: true,
        baseSku: true,
        colorSlug: true,
        sizeSlug: true,
        quantity: true,
        unitPrice: true
      }
    })

    const response = {
      cartItems: cartItems.map((item) => ({
        cartKey: item.cartKey,
        baseSku: item.baseSku,
        colorSlug: item.colorSlug || null,
        sizeSlug: item.sizeSlug || null,
        quantity: item.quantity,
        unitPrice: item.unitPrice ? Number(item.unitPrice) : null
      }))
    }

    return NextResponse.json(response, { status: 200 })
  } catch (error: any) {
    const message =
      typeof error?.message === 'string' ? error.message : 'Unable to load cart'
    const status = message.includes('Bearer token') ? 401 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

