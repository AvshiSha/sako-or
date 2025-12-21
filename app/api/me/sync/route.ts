import { NextRequest, NextResponse } from 'next/server'
import { adminAuth } from '@/lib/firebase-admin'
import { prisma } from '@/lib/prisma'

function getBearerToken(req: NextRequest): string | null {
  const authHeader = req.headers.get('authorization') || ''
  const match = authHeader.match(/^Bearer\s+(.+)$/i)
  return match?.[1] ?? null
}

export async function POST(request: NextRequest) {
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

    return NextResponse.json(
      {
        id: user.id,
        firebaseUid: user.firebaseUid,
        email: user.email,
        role: user.role,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('[ME_SYNC_ERROR]', error)
    const message =
      typeof error?.message === 'string' ? error.message : 'Unable to sync user'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}


