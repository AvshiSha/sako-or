import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUserAuth } from '@/lib/server/auth'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUserAuth(request)
    if (auth instanceof NextResponse) return auth
    const firebaseUid = auth.firebaseUid

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { firebaseUid },
      select: { id: true }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Profile not found. Please complete your profile first.' },
        { status: 404 }
      )
    }

    // Get pagination params
    const { searchParams } = new URL(request.url)
    const limitParam = searchParams.get('limit')
    const limit = limitParam ? Math.min(parseInt(limitParam), 100) : undefined
    const offset = Math.max(parseInt(searchParams.get('offset') || '0'), 0)

    // Fetch orders with all related data
    const [orders, totalCount] = await Promise.all([
      prisma.order.findMany({
        where: { userId: user.id },
        include: {
          orderItems: {
            orderBy: { createdAt: 'asc' }
          },
          appliedCoupons: {
            orderBy: { createdAt: 'asc' }
          },
          points: {
            where: { kind: 'SPEND' }, // Only get points spent, not earned
            select: {
              delta: true,
              createdAt: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        ...(limit ? { take: limit } : {}),
        skip: offset
      }),
      prisma.order.count({
        where: { userId: user.id }
      })
    ])

    // Format orders for display
    const formattedOrders = orders.map(order => {
      // Calculate total loyalty points used
      const pointsUsed = order.points.reduce((sum, point) => sum + Math.abs(point.delta), 0)

      return {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        total: order.total,
        currency: order.currency,
        subtotal: order.subtotal,
        discountTotal: order.discountTotal,
        deliveryFee: order.deliveryFee,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        orderItems: order.orderItems.map(item => ({
          id: item.id,
          productName: item.productName,
          productSku: item.productSku,
          modelNumber: item.modelNumber,
          colorName: item.colorName,
          size: item.size,
          quantity: item.quantity,
          price: item.price,
          salePrice: item.salePrice,
          total: item.total,
          primaryImage: item.primaryImage
        })),
        appliedCoupons: order.appliedCoupons.map(coupon => ({
          code: coupon.code,
          discountAmount: coupon.discountAmount,
          discountType: coupon.discountType,
          description: coupon.description
        })),
        pointsUsed: pointsUsed > 0 ? pointsUsed : null
      }
    })

    return NextResponse.json(
      {
        ok: true,
        orders: formattedOrders,
        pagination: {
          total: totalCount,
          limit: limit || totalCount,
          offset,
          hasMore: limit ? offset + limit < totalCount : false
        }
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('[ME_ORDERS_GET_ERROR]', error)
    const message =
      typeof error?.message === 'string' ? error.message : 'Unable to load orders'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

