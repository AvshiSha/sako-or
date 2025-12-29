import { NextRequest, NextResponse } from 'next/server'
import { adminAuth } from '@/lib/firebase-admin'
import { prisma } from '@/lib/prisma'

function getBearerToken(req: NextRequest): string | null {
  const authHeader = req.headers.get('authorization') || ''
  const match = authHeader.match(/^Bearer\\s+(.+)$/i)
  return match?.[1] ?? null
}

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

export async function POST(request: NextRequest) {
  try {
    const userId = await getOrCreateNeonUserId(request)
    const body = await request.json().catch(() => ({}))
    const favoriteKeys: string[] = Array.isArray(body?.favoriteKeys)
      ? body.favoriteKeys.filter((k: any) => typeof k === 'string')
      : []

    // #region agent log
    const fs=require('fs');fs.appendFileSync('/Users/yardenrozenfeld/Projects/sako-or/.cursor/debug.log',JSON.stringify({location:'api/favorites/merge:entry',message:'Merge request',data:{userId,favoriteKeys,count:favoriteKeys.length},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})+ '\n');
    // #endregion

    if (favoriteKeys.length === 0) {
      return NextResponse.json({ merged: 0 }, { status: 200 })
    }

    const now = new Date()

    const uniqueKeys = Array.from(new Set(favoriteKeys.map((k) => k.trim()).filter(Boolean)))

    let merged = 0
    for (const favoriteKey of uniqueKeys) {
      const { productBaseSku, colorSlug } = parseFavoriteKey(favoriteKey)

      // #region agent log
      fs.appendFileSync('/Users/yardenrozenfeld/Projects/sako-or/.cursor/debug.log',JSON.stringify({location:'api/favorites/merge:parsing',message:'Parsing key',data:{favoriteKey,productBaseSku,colorSlug},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})+'\n');
      // #endregion

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

    // #region agent log
    fs.appendFileSync('/Users/yardenrozenfeld/Projects/sako-or/.cursor/debug.log',JSON.stringify({location:'api/favorites/merge:success',message:'Merge completed',data:{merged},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})+'\n');
    // #endregion

    return NextResponse.json({ merged }, { status: 200 })
  } catch (error: any) {
    // #region agent log
    const fs=require('fs');fs.appendFileSync('/Users/yardenrozenfeld/Projects/sako-or/.cursor/debug.log',JSON.stringify({location:'api/favorites/merge:error',message:'Merge error',data:{error:String(error),stack:error?.stack},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})+'\n');
    // #endregion
    const message =
      typeof error?.message === 'string' ? error.message : 'Unable to merge favorites'
    const status = message.includes('Bearer token') ? 401 : 400
    return NextResponse.json({ error: message }, { status })
  }
}


