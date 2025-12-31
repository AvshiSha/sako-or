import { NextRequest, NextResponse } from 'next/server'
import { adminAuth } from '@/lib/firebase-admin'
import { prisma } from '@/lib/prisma'

function getBearerToken(req: NextRequest): string | null {
  const authHeader = req.headers.get('authorization') || ''
  const match = authHeader.match(/^Bearer\\s+(.+)$/i)
  return match?.[1] ?? null
}

function favoriteKeyFromParts(productBaseSku: string, colorSlug: string): string {
  return colorSlug ? `${productBaseSku}::${colorSlug}` : productBaseSku
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

    const neonUser = await prisma.user.findUnique({
      where: { firebaseUid },
      select: { id: true }
    })
    if (!neonUser) {
      return NextResponse.json(
        { error: 'Neon user not found; call /api/me/sync first.' },
        { status: 404 }
      )
    }
    const userId = neonUser.id

    const favorites = await prisma.favorite.findMany({
      where: { userId, isActive: true },
      orderBy: { favoritedAt: 'desc' },
      select: {
        productBaseSku: true,
        colorSlug: true
      }
    })

    return NextResponse.json(
      {
        favorites: favorites.map((f) => ({
          favoriteKey: favoriteKeyFromParts(f.productBaseSku, f.colorSlug),
          productBaseSku: f.productBaseSku,
          colorSlug: f.colorSlug || null
        }))
      },
      { status: 200 }
    )
  } catch (error: any) {
    const message =
      typeof error?.message === 'string' ? error.message : 'Unable to load favorites'
    const status = message.includes('Bearer token') ? 401 : 500
    return NextResponse.json({ error: message }, { status })
  }
}


