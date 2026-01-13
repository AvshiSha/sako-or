import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUserAuth } from '@/lib/server/auth'

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
    const tempOrderId = typeof body?.orderId === 'string' ? body.orderId : null
    const now = new Date()

    // Mark all IN_CART items as CHECKED_OUT
    // IMPORTANT: Only updates IN_CART items - PURCHASED items are immutable/historical
    const result = await prisma.cartItem.updateMany({
      where: {
        userId,
        status: 'IN_CART' // Only mutable status - PURCHASED items are never touched
      },
      data: {
        status: 'CHECKED_OUT',
        orderId: tempOrderId,
        removedAt: null,
        updatedAt: now
      }
    })

    return NextResponse.json({ 
      success: true,
      count: result.count 
    }, { status: 200 })
  } catch (error: any) {
    const message =
      typeof error?.message === 'string' ? error.message : 'Unable to mark cart as checked out'
    const status = message.includes('Bearer token') ? 401 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
