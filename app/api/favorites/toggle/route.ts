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

export async function POST(request: NextRequest) {
  try {
    const userId = await getOrCreateNeonUserId(request)
    const body = await request.json().catch(() => ({}))
    const favoriteKey = typeof body?.favoriteKey === 'string' ? body.favoriteKey : ''
    const { productBaseSku, colorSlug } = parseFavoriteKey(favoriteKey)

    // #region agent log
    const fs=require('fs');fs.appendFileSync('/Users/yardenrozenfeld/Projects/sako-or/.cursor/debug.log',JSON.stringify({location:'api/favorites/toggle:parsed',message:'Parsed favoriteKey',data:{favoriteKey,productBaseSku,colorSlug,userId},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'D'})+'\n');
    // #endregion

    const where = {
      userId_productBaseSku_colorSlug: { userId, productBaseSku, colorSlug }
    } as const

    const existing = await prisma.favorite.findUnique({ where })
    const now = new Date()

    // #region agent log
    fs.appendFileSync('/Users/yardenrozenfeld/Projects/sako-or/.cursor/debug.log',JSON.stringify({location:'api/favorites/toggle:existing',message:'Existing favorite check',data:{found:!!existing,isActive:existing?.isActive},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'D'})+'\n');
    // #endregion

    if (!existing) {
      const created = await prisma.favorite.create({
        data: {
          userId,
          productBaseSku,
          colorSlug,
          isActive: true,
          favoritedAt: now,
          unfavoritedAt: null
        }
      })

      // #region agent log
      fs.appendFileSync('/Users/yardenrozenfeld/Projects/sako-or/.cursor/debug.log',JSON.stringify({location:'api/favorites/toggle:created',message:'Created new favorite',data:{id:created.id},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'D'})+'\n');
      // #endregion

      return NextResponse.json(
        {
          favoriteKey: favoriteKeyFromParts(created.productBaseSku, created.colorSlug),
          isActive: true
        },
        { status: 200 }
      )
    }

    const nextIsActive = !existing.isActive
    const updated = await prisma.favorite.update({
      where,
      data: nextIsActive
        ? { isActive: true, favoritedAt: now, unfavoritedAt: null }
        : { isActive: false, unfavoritedAt: now }
    })

    // #region agent log
    fs.appendFileSync('/Users/yardenrozenfeld/Projects/sako-or/.cursor/debug.log',JSON.stringify({location:'api/favorites/toggle:updated',message:'Updated existing favorite',data:{id:updated.id,isActive:updated.isActive},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'D'})+'\n');
    // #endregion

    return NextResponse.json(
      {
        favoriteKey: favoriteKeyFromParts(updated.productBaseSku, updated.colorSlug),
        isActive: updated.isActive
      },
      { status: 200 }
    )
  } catch (error: any) {
    // #region agent log
    const fs=require('fs');fs.appendFileSync('/Users/yardenrozenfeld/Projects/sako-or/.cursor/debug.log',JSON.stringify({location:'api/favorites/toggle:error',message:'Toggle error',data:{error:String(error),stack:error?.stack},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'D'})+'\n');
    // #endregion
    const message =
      typeof error?.message === 'string' ? error.message : 'Unable to toggle favorite'
    const status = message.includes('Bearer token') ? 401 : 400
    return NextResponse.json({ error: message }, { status })
  }
}


