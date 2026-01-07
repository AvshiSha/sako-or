import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUserAuth } from '@/lib/server/auth'

function parseFavoriteKey(favoriteKey: string): { productBaseSku: string; colorSlug: string } {
  const key = (favoriteKey || '').trim()
  if (!key) {
    throw new Error('Missing favoriteKey')
  }

  if (!key.includes('::')) {
    return { productBaseSku: key, colorSlug: '' }
  }

  const parts = key.split('::')
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error('Invalid favoriteKey format')
  }

  return { productBaseSku: parts[0], colorSlug: parts[1] }
}

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
    const favoriteKeys: string[] = Array.isArray(body?.favoriteKeys)
      ? body.favoriteKeys.filter((k: any) => typeof k === 'string')
      : []

    if (favoriteKeys.length === 0) {
      return NextResponse.json({ merged: 0 }, { status: 200 })
    }

    const now = new Date()

    const uniqueKeys = Array.from(new Set(favoriteKeys.map((k) => k.trim()).filter(Boolean)))

    let merged = 0
    for (const favoriteKey of uniqueKeys) {
      const { productBaseSku, colorSlug } = parseFavoriteKey(favoriteKey)

      await prisma.favorite.upsert({
        where: {
          userId_productBaseSku_colorSlug: { userId, productBaseSku, colorSlug }
        },
        create: {
          userId,
          productBaseSku,
          colorSlug,
          isActive: true,
          favoritedAt: now,
          unfavoritedAt: null
        },
        update: {
          isActive: true,
          favoritedAt: now,
          unfavoritedAt: null
        }
      })

      merged++
    }

    return NextResponse.json({ merged }, { status: 200 })
  } catch (error: any) {
    const message =
      typeof error?.message === 'string' ? error.message : 'Unable to merge favorites'
    const status = message.includes('Bearer token') ? 401 : 400
    return NextResponse.json({ error: message }, { status })
  }
}


