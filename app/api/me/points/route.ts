import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUserAuth } from '@/lib/server/auth'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUserAuth(request)
    if (auth instanceof NextResponse) return auth
    const firebaseUid = auth.firebaseUid

    // Get user from database with points balance
    const user = await prisma.user.findUnique({
      where: { firebaseUid },
      select: { id: true, pointsBalance: true }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Profile not found. Please complete your profile first.' },
        { status: 404 }
      )
    }

    // Get pagination params
    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50)
    const offset = Math.max(parseInt(searchParams.get('offset') || '0'), 0)

    // Fetch points history with order references
    const [pointsHistory, totalCount] = await Promise.all([
      prisma.points.findMany({
        where: { userId: user.id },
        include: {
          order: {
            select: {
              orderNumber: true,
              total: true,
              currency: true,
              createdAt: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset
      }),
      prisma.points.count({
        where: { userId: user.id }
      })
    ])

    return NextResponse.json(
      {
        ok: true,
        pointsBalance: Number(user.pointsBalance),
        pointsHistory: pointsHistory.map(p => ({
          ...p,
          delta: Number(p.delta)
        })),
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
    console.error('[ME_POINTS_GET_ERROR]', error)
    const message =
      typeof error?.message === 'string' ? error.message : 'Unable to load points'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

