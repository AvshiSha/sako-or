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

async function getOrCreateNeonUserId(req: NextRequest): Promise<string> {
  const token = getBearerToken(req)
  if (!token) {
    throw new Error('Missing Authorization Bearer token')
  }

  const decoded = await adminAuth.verifyIdToken(token)
  const firebaseUid = decoded.uid
  const email = decoded.email ?? null
  const emailVerified = decoded.email_verified ?? false
  const now = new Date()

  const user = await prisma.user.upsert({
    where: { firebaseUid },
    update: {
      lastLoginAt: now,
      ...(email ? { email } : {}),
      emailVerified
    },
    create: {
      firebaseUid,
      email,
      emailVerified,
      authProvider: 'firebase',
      role: 'USER',
      lastLoginAt: now
    }
  })

  return user.id
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getOrCreateNeonUserId(request)

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


