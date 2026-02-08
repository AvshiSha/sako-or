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

function favoriteKeyFromParts(productBaseSku: string, colorSlug: string): string {
  return colorSlug ? `${productBaseSku}::${colorSlug}` : productBaseSku
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
    const favoriteKey = typeof body?.favoriteKey === 'string' ? body.favoriteKey : ''
    // Optional idempotent mode: client can request a specific state.
    // When provided, repeated calls will not "flip" the favorite unexpectedly.
    const desiredIsActive =
      typeof body?.isActive === 'boolean' ? (body.isActive as boolean) : null
    const { productBaseSku, colorSlug } = parseFavoriteKey(favoriteKey)

    const where = {
      userId_productBaseSku_colorSlug: { userId, productBaseSku, colorSlug }
    } as const

    const existing = await prisma.favorite.findUnique({ where })
    const now = new Date()

    // Idempotent "set" mode
    if (desiredIsActive !== null) {
      console.log('[Toggle API] Idempotent mode:', { 
        userId, 
        productBaseSku, 
        colorSlug, 
        desiredIsActive, 
        existingRecord: existing ? { isActive: existing.isActive } : null 
      })

      if (!existing) {
        if (!desiredIsActive) {
          console.log('[Toggle API] No existing record and desiredIsActive=false, returning early')
          return NextResponse.json(
            {
              favoriteKey: favoriteKeyFromParts(productBaseSku, colorSlug),
              isActive: false
            },
            { status: 200 }
          )
        }

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

        console.log('[Toggle API] Created new favorite:', { isActive: created.isActive })
        return NextResponse.json(
          {
            favoriteKey: favoriteKeyFromParts(created.productBaseSku, created.colorSlug),
            isActive: true
          },
          { status: 200 }
        )
      }

      const updated = await prisma.favorite.update({
        where,
        data: desiredIsActive
          ? { isActive: true, favoritedAt: now, unfavoritedAt: null }
          : { isActive: false, unfavoritedAt: now }
      })

      console.log('[Toggle API] Updated favorite:', { isActive: updated.isActive })
      return NextResponse.json(
        {
          favoriteKey: favoriteKeyFromParts(updated.productBaseSku, updated.colorSlug),
          isActive: updated.isActive
        },
        { status: 200 }
      )
    }

    // Legacy toggle mode (kept for backwards compatibility)
    console.log('[Toggle API] Legacy toggle mode:', { 
      userId, 
      productBaseSku, 
      colorSlug, 
      existingRecord: existing ? { isActive: existing.isActive } : null 
    })

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

      console.log('[Toggle API] Created new favorite (legacy):', { isActive: created.isActive })
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

    console.log('[Toggle API] Updated favorite (legacy):', { 
      wasActive: existing.isActive, 
      nowActive: updated.isActive 
    })
    return NextResponse.json(
      {
        favoriteKey: favoriteKeyFromParts(updated.productBaseSku, updated.colorSlug),
        isActive: updated.isActive
      },
      { status: 200 }
    )
  } catch (error: any) {
    const message =
      typeof error?.message === 'string' ? error.message : 'Unable to toggle favorite'
    const status = message.includes('Bearer token') ? 401 : 400
    return NextResponse.json({ error: message }, { status })
  }
}


