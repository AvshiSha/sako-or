import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUserAuth } from '@/lib/server/auth'

function favoriteKeyFromParts(productBaseSku: string, colorSlug: string): string {
  return colorSlug ? `${productBaseSku}::${colorSlug}` : productBaseSku
}

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


