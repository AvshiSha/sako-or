import { NextRequest, NextResponse } from 'next/server'
import { adminAuth } from '@/lib/firebase-admin'
import { prisma } from '@/lib/prisma'

function getBearerToken(req: NextRequest): string | null {
  const authHeader = req.headers.get('authorization') || ''
  const match = authHeader.match(/^Bearer\s+(.+)$/i)
  return match?.[1] ?? null
}

export async function GET(request: NextRequest) {
  try {
    const token = getBearerToken(request)
    if (!token) {
      return NextResponse.json(
        { error: 'Missing Authorization Bearer token' },
        { status: 401 }
      )
    }

    const decoded = await adminAuth.verifyIdToken(token)
    const firebaseUid = decoded.uid

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { firebaseUid },
      select: { id: true }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found. Call /api/me/sync first.' },
        { status: 404 }
      )
    }

    // Get pagination params
    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50)
    const offset = Math.max(parseInt(searchParams.get('offset') || '0'), 0)

    // Fetch orders with items
    const [orders, totalCount] = await Promise.all([
      prisma.order.findMany({
        where: { userId: user.id },
        include: {
          orderItems: true
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset
      }),
      prisma.order.count({
        where: { userId: user.id }
      })
    ])

    return NextResponse.json(
      {
        ok: true,
        orders,
        pagination: {
          total: totalCount,
          limit,
          offset,
          hasMore: offset + limit < totalCount
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

